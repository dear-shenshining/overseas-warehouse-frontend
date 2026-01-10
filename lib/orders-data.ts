/**
 * 订单数据服务
 * 处理订单数据的数据库操作
 */
import { query, execute, getConnection } from '@/lib/db'
import { PoolClient } from 'pg'

export interface OrderRecord {
  id?: number
  order_number: string
  store_name?: string
  payment_time?: Date | string
  platform_sku?: string
  logistics_channel?: string
  order_status?: string
  total_product_cost?: number
  actual_shipping_fee?: number
  product_and_shipping_cost?: number // 商品及运费成本（商品总成本 + 实际运费）
  profit?: number // 毛利（总计金额 - 商品及运费成本）
  profit_rate?: number // 利润率（毛利 / 商品及运费成本 * 100%）
  sales_refund?: number
  shipping_refund?: number
  total_amount?: number
  created_at?: string
  updated_at?: string
}

/**
 * 物流渠道运费匹配规则
 * 当运费为0时，根据物流渠道自动匹配运费
 */
const LOGISTICS_CHANNEL_FEE_MAP: Record<string, number> = {
  '金焱焱海外仓日邮小包': 23,
  '大阪海外仓HW105黑猫小包': 23,
  '大阪海外仓HW105佐川': 23,
  '大阪海外仓HW105日邮': 23,
  '大阪海外仓HW105黑猫投函': 12,
  '金焱焱海外仓': 12,
}

/**
 * 根据物流渠道获取运费
 * @param logisticsChannel 物流渠道名称
 * @param currentFee 当前运费
 * @returns 匹配后的运费
 */
export function getShippingFeeByChannel(
  logisticsChannel: string | null | undefined,
  currentFee: number | null | undefined
): number {
  // 如果运费不为0，直接返回原值
  if (currentFee !== null && currentFee !== undefined && currentFee !== 0) {
    return currentFee
  }

  // 如果运费为0或空，根据物流渠道匹配
  if (!logisticsChannel) {
    return 0
  }

  // 精确匹配
  if (LOGISTICS_CHANNEL_FEE_MAP[logisticsChannel]) {
    return LOGISTICS_CHANNEL_FEE_MAP[logisticsChannel]
  }

  // 模糊匹配（包含关系）
  for (const [key, value] of Object.entries(LOGISTICS_CHANNEL_FEE_MAP)) {
    if (logisticsChannel.includes(key) || key.includes(logisticsChannel)) {
      return value
    }
  }

  // 如果没有匹配到，返回0
  return 0
}

/**
 * 导入订单数据（优化版本：使用批量插入和 ON CONFLICT）
 * @param orders 订单数据数组
 * @returns 导入结果
 */
export async function importOrdersData(
  orders: Omit<OrderRecord, 'id' | 'created_at' | 'updated_at'>[]
): Promise<{
  success: boolean
  inserted: number
  updated: number
  error?: string
}> {
  if (!orders || orders.length === 0) {
    return {
      success: false,
      inserted: 0,
      updated: 0,
      error: '没有要导入的数据',
    }
  }

  console.log(`开始导入 ${orders.length} 条订单数据...`)
  const startTime = Date.now()

  let inserted = 0
  let updated = 0
  let client: PoolClient | null = null

  try {
    client = await getConnection()
    await client.query('BEGIN')

    // 批量处理：每1000条一批
    const batchSize = 1000
    const batches = Math.ceil(orders.length / batchSize)

    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const start = batchIndex * batchSize
      const end = Math.min(start + batchSize, orders.length)
      const batch = orders.slice(start, end)

      console.log(`处理第 ${batchIndex + 1}/${batches} 批数据（${start + 1}-${end} 条）...`)

      // 构建批量插入的 VALUES 和参数
      const values: any[] = []
      const placeholders: string[] = []
      let paramIndex = 1

      for (const order of batch) {
        // 辅助函数：将值转换为 NUMERIC(10, 2) 格式
        const toNumeric = (value: any): number => {
          if (value === null || value === undefined || value === '') {
            return 0
          }
          const num = typeof value === 'number' ? value : parseFloat(String(value))
          if (isNaN(num) || !isFinite(num)) {
            return 0
          }
          // 四舍五入到2位小数，符合 NUMERIC(10, 2) 格式
          return Math.round(num * 100) / 100
        }
        
        // 处理运费：如果为0，根据物流渠道匹配
        const shippingFee = getShippingFeeByChannel(
          order.logistics_channel,
          order.actual_shipping_fee
        )
        
        // 将所有数字字段转换为 NUMERIC(10, 2) 格式
        const productCost = toNumeric(order.total_product_cost)
        const shippingFeeNum = toNumeric(shippingFee)
        const totalAmount = toNumeric(order.total_amount)
        const salesRefund = toNumeric(order.sales_refund)
        const shippingRefund = toNumeric(order.shipping_refund)
        
        // 计算商品及运费成本 = 商品总成本 + 实际运费
        // 使用精确的数值计算，然后四舍五入到2位小数
        const productAndShippingCost = toNumeric(productCost + shippingFeeNum)
        
        // 计算毛利 = 总计金额 - 商品及运费成本
        const profit = toNumeric(totalAmount - productAndShippingCost)
        
        // 计算利润率 = (毛利 / 商品及运费成本) * 100%
        // 利润率也应该是 NUMERIC(10, 2) 格式
        const profitRate = productAndShippingCost > 0 
          ? toNumeric((profit / productAndShippingCost) * 100)
          : 0

        const rowPlaceholders: string[] = []
        for (let i = 0; i < 14; i++) { // 14个字段
          rowPlaceholders.push(`$${paramIndex++}`)
        }
        placeholders.push(`(${rowPlaceholders.join(', ')})`)

        // 确保所有值都符合数据库字段类型
        values.push(
          String(order.order_number), // VARCHAR(255)
          order.store_name ? String(order.store_name) : null, // VARCHAR(255)
          order.payment_time || null, // TIMESTAMP
          order.platform_sku ? String(order.platform_sku) : null, // VARCHAR(255)
          order.logistics_channel ? String(order.logistics_channel) : null, // VARCHAR(255)
          order.order_status ? String(order.order_status) : null, // VARCHAR(255)
          productCost, // NUMERIC(10, 2)
          shippingFeeNum, // NUMERIC(10, 2)
          productAndShippingCost, // NUMERIC(10, 2)
          profit, // NUMERIC(10, 2)
          profitRate, // NUMERIC(10, 2)
          salesRefund, // NUMERIC(10, 2)
          shippingRefund, // NUMERIC(10, 2)
          totalAmount // NUMERIC(10, 2)
        )
      }

      // 使用 INSERT ... ON CONFLICT 进行批量插入/更新
      // 明确指定NUMERIC类型转换，确保PostgreSQL正确理解数据类型
      const insertSql = `
        INSERT INTO orders (
          order_number,
          store_name,
          payment_time,
          platform_sku,
          logistics_channel,
          order_status,
          total_product_cost,
          actual_shipping_fee,
          product_and_shipping_cost,
          profit,
          profit_rate,
          sales_refund,
          shipping_refund,
          total_amount
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (order_number) 
        DO UPDATE SET
          store_name = EXCLUDED.store_name,
          payment_time = EXCLUDED.payment_time,
          platform_sku = EXCLUDED.platform_sku,
          logistics_channel = EXCLUDED.logistics_channel,
          order_status = EXCLUDED.order_status,
          total_product_cost = EXCLUDED.total_product_cost::NUMERIC(10, 2),
          actual_shipping_fee = EXCLUDED.actual_shipping_fee::NUMERIC(10, 2),
          product_and_shipping_cost = EXCLUDED.product_and_shipping_cost::NUMERIC(10, 2),
          profit = EXCLUDED.profit::NUMERIC(10, 2),
          profit_rate = EXCLUDED.profit_rate::NUMERIC(10, 2),
          sales_refund = EXCLUDED.sales_refund::NUMERIC(10, 2),
          shipping_refund = EXCLUDED.shipping_refund::NUMERIC(10, 2),
          total_amount = EXCLUDED.total_amount::NUMERIC(10, 2),
          updated_at = CURRENT_TIMESTAMP
      `

      const result = await client.query(insertSql, values)
      
      // 统计插入和更新的数量（PostgreSQL 的 ON CONFLICT 不直接返回，我们需要估算）
      // 先查询已存在的订单编号
      const orderNumbers = batch.map(o => o.order_number)
      const checkSql = `SELECT order_number FROM orders WHERE order_number = ANY($1)`
      const existingResult = await client.query(checkSql, [orderNumbers])
      const existingNumbers = new Set(existingResult.rows.map((r: any) => r.order_number))
      
      batch.forEach(order => {
        if (existingNumbers.has(order.order_number)) {
          updated++
        } else {
          inserted++
        }
      })
    }

    await client.query('COMMIT')
    
    const duration = Date.now() - startTime
    console.log(`导入完成！共 ${orders.length} 条，新增 ${inserted} 条，更新 ${updated} 条，耗时 ${(duration / 1000).toFixed(2)} 秒`)

    return {
      success: true,
      inserted,
      updated,
    }
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK')
    }
    console.error('导入订单数据失败:', error)
    console.error('错误详情:', error.stack)
    return {
      success: false,
      inserted,
      updated,
      error: error.message || '导入订单数据失败',
    }
  } finally {
    if (client) {
      client.release()
    }
  }
}

/**
 * 获取订单数据（带筛选条件）
 * @param dateFrom 开始日期
 * @param dateTo 结束日期
 * @param storeName 店铺名（可选）
 * @param filterType 筛选类型（可选）
 * @returns 订单数据数组
 */
export async function getOrdersData(
  dateFrom?: string,
  dateTo?: string,
  storeName?: string,
  filterType?: 'lowProfitRate' | 'noShippingRefund'
): Promise<OrderRecord[]> {
  try {
    // 构建SQL查询，只查询需要的字段（提高性能）
    // 根据是否有筛选类型决定查询哪些字段
    const selectFields = filterType 
      ? 'order_number, store_name, payment_time, platform_sku, logistics_channel, total_product_cost, actual_shipping_fee, profit, profit_rate, shipping_refund'
      : '*'
    
    let sql = `SELECT ${selectFields} FROM orders WHERE payment_time IS NOT NULL`
    const params: any[] = []
    let paramIndex = 1

    if (dateFrom) {
      // 确保日期格式正确，payment_time 是 TIMESTAMP 类型
      // dateFrom 格式: '2025-12-06'，需要转换为当天的开始时间（使用数据库时区）
      // 使用 ::date 转换确保使用数据库时区（Asia/Shanghai）来比较日期
      sql += ` AND payment_time::date >= $${paramIndex}::date`
      params.push(dateFrom)
      paramIndex++
    }

    if (dateTo) {
      // dateTo 格式: '2025-12-06'，需要转换为当天的结束时间
      // 使用 ::date 转换确保使用数据库时区（Asia/Shanghai）来比较日期
      sql += ` AND payment_time::date <= $${paramIndex}::date`
      params.push(dateTo)
      paramIndex++
    }

    if (storeName && storeName !== 'all') {
      sql += ` AND store_name = $${paramIndex}`
      params.push(storeName)
      paramIndex++
    }

    // 根据筛选类型添加SQL条件（在数据库层面过滤，提高性能）
    if (filterType === 'lowProfitRate') {
      // 毛利率低于20%的订单
      sql += ` AND profit_rate IS NOT NULL AND profit_rate < 20`
    } else if (filterType === 'noShippingRefund') {
      // 运费回款为0的订单
      sql += ` AND (shipping_refund IS NULL OR shipping_refund = 0)`
    }

    sql += ' ORDER BY payment_time DESC'
    
    const results = await query<OrderRecord>(sql, params)
    
    return results
  } catch (error) {
    console.error('获取订单数据失败:', error)
    throw error
  }
}

/**
 * 获取订单统计数据
 * @param dateFrom 开始日期
 * @param dateTo 结束日期
 * @param storeName 店铺名（可选）
 * @returns 统计数据
 */
export async function getOrdersStatistics(
  dateFrom?: string,
  dateTo?: string,
  storeName?: string
): Promise<{
  totalProfit: number // 总毛利（profit字段的总和）
  totalShipping: number
  totalOrders: number
  lowProfitRateCount: number // 毛利率低于20的数量
  noShippingRefundCount: number // 运费回款为0的数量
  dailyData: Array<{
    date: string
    profit: number // 毛利
    shipping: number
  }>
}> {
  try {
    console.log('getOrdersStatistics 调用参数:', { dateFrom, dateTo, storeName })
    const orders = await getOrdersData(dateFrom, dateTo, storeName)
    console.log(`获取到 ${orders.length} 条订单`)

    // 按日期分组统计
    const dailyMap = new Map<string, { profit: number; shipping: number }>()

    let totalProfit = 0 // 总毛利
    let totalShipping = 0
    let lowProfitRateCount = 0 // 毛利率低于20的数量
    let noShippingRefundCount = 0 // 运费回款为0的数量

    orders.forEach((order, index) => {
      // 处理payment_time，提取日期部分
      // 数据库时区设置为 Asia/Shanghai，返回的时间已经是数据库时区的时间
      // 直接提取日期部分，避免时区转换问题
      let date: string | null = null
      if (order.payment_time) {
        if (typeof order.payment_time === 'string') {
          // 如果是字符串，直接提取日期部分（格式：YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS）
          // 数据库返回的时间格式可能是：'2025-12-05 23:00:00' 或 '2025-12-05T23:00:00'
          const dateMatch = order.payment_time.match(/^(\d{4}-\d{2}-\d{2})/)
          if (dateMatch) {
            date = dateMatch[1]
          } else {
            // 如果没有匹配到，尝试直接分割
            date = order.payment_time.split('T')[0].split(' ')[0]
          }
        } else {
          // 如果是Date对象，PostgreSQL返回的Date对象已经是数据库时区的时间
          // 直接使用本地时间的日期部分（因为数据库时区是 Asia/Shanghai，与本地时区一致）
          const dateObj = new Date(order.payment_time)
          // 使用本地时间方法获取日期部分（数据库返回的时间已经是数据库时区）
          const year = dateObj.getFullYear()
          const month = String(dateObj.getMonth() + 1).padStart(2, '0')
          const day = String(dateObj.getDate()).padStart(2, '0')
          date = `${year}-${month}-${day}`
        }
      }

      if (!date) {
        console.warn('订单缺少payment_time:', order.order_number)
        return
      }

      // 辅助函数：将值转换为数字（NUMERIC(10, 2) 格式）
      const toNumeric = (value: any): number => {
        if (value === null || value === undefined || value === '') {
          return 0
        }
        const num = typeof value === 'number' ? value : parseFloat(String(value))
        if (isNaN(num) || !isFinite(num)) {
          return 0
        }
        // 四舍五入到2位小数，符合 NUMERIC(10, 2) 格式
        return Math.round(num * 100) / 100
      }
      
      // 使用profit字段作为毛利，如果profit为null或undefined，尝试重新计算
      let profit = toNumeric(order.profit)
      
      // 如果profit为0或null，尝试重新计算（可能是旧数据没有计算profit）
      if (profit === 0 && order.total_amount && toNumeric(order.total_amount) !== 0) {
        // 优先使用已存储的product_and_shipping_cost字段
        let productAndShippingCost = toNumeric(order.product_and_shipping_cost)
        if (productAndShippingCost === 0) {
          // 如果没有存储，则重新计算
          const productCost = toNumeric(order.total_product_cost)
          const shippingFee = toNumeric(order.actual_shipping_fee)
          productAndShippingCost = toNumeric(productCost + shippingFee)
        }
        const totalAmount = toNumeric(order.total_amount)
        profit = toNumeric(totalAmount - productAndShippingCost)
        console.log(`订单 ${order.order_number} profit字段为0，重新计算: total_amount=${totalAmount}, product_and_shipping_cost=${productAndShippingCost}, profit=${profit}`)
      }
      
      const shipping = toNumeric(order.actual_shipping_fee)

      // 前10条订单的详细日志（增加日志数量以便排查）
      if (index < 10) {
        console.log(`订单 ${index + 1} 详情:`, {
          order_number: order.order_number,
          payment_time: order.payment_time,
          date,
          total_amount: order.total_amount,
          total_product_cost: order.total_product_cost,
          actual_shipping_fee: order.actual_shipping_fee,
          product_and_shipping_cost: order.product_and_shipping_cost,
          profit_raw: order.profit,
          profit_type: typeof order.profit,
          profit_calculated: profit,
          profit_rate_raw: order.profit_rate,
          profit_rate_type: typeof order.profit_rate,
          shipping_refund_raw: order.shipping_refund,
          shipping_refund_type: typeof order.shipping_refund,
          store_name: order.store_name,
        })
      }

      totalProfit += profit
      totalShipping += shipping

      // 统计毛利率低于20的数量
      const profitRate = toNumeric(order.profit_rate)
      if (profitRate !== 0 && profitRate < 20) {
        lowProfitRateCount++
      }

      // 统计运费回款为0的数量（包括null、undefined和0）
      const shippingRefund = toNumeric(order.shipping_refund)
      if (shippingRefund === 0) {
        noShippingRefundCount++
      }

      if (!dailyMap.has(date)) {
        dailyMap.set(date, { profit: 0, shipping: 0 })
      }

      const daily = dailyMap.get(date)!
      daily.profit += profit
      daily.shipping += shipping
    })

    // 转换为数组并排序
    const dailyData = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        profit: data.profit,
        shipping: data.shipping,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    console.log('统计结果:', {
      totalProfit,
      totalShipping,
      totalOrders: orders.length,
      lowProfitRateCount,
      noShippingRefundCount,
      dailyDataCount: dailyData.length,
    })

    return {
      totalProfit,
      totalShipping,
      totalOrders: orders.length,
      lowProfitRateCount,
      noShippingRefundCount,
      dailyData,
    }
  } catch (error) {
    console.error('获取订单统计数据失败:', error)
    throw error
  }
}

/**
 * 获取店铺列表
 */
export async function getStoreList(): Promise<string[]> {
  try {
    const sql = `SELECT DISTINCT store_name FROM orders WHERE store_name IS NOT NULL AND store_name != '' ORDER BY store_name`
    const results = await query<{ store_name: string }>(sql)
    return results.map(r => r.store_name)
  } catch (error) {
    console.error('获取店铺列表失败:', error)
    return []
  }
}

/**
 * 批量重新计算profit字段（用于修复旧数据）
 * 如果profit为0或null，但total_amount不为0，则重新计算profit
 */
export async function recalculateProfit(): Promise<{
  success: boolean
  updated: number
  error?: string
}> {
  try {
    console.log('开始重新计算profit字段...')
    
    // 查询需要更新的订单（profit为0或null，但total_amount不为0）
    const checkSql = `
      SELECT 
        order_number,
        total_amount,
        total_product_cost,
        actual_shipping_fee,
        product_and_shipping_cost,
        profit
      FROM orders
      WHERE (profit IS NULL OR profit = 0)
        AND total_amount IS NOT NULL
        AND total_amount != 0
    `
    
    const ordersToUpdate = await query<{
      order_number: string
      total_amount: number
      total_product_cost: number | null
      actual_shipping_fee: number | null
      product_and_shipping_cost: number | null
      profit: number | null
    }>(checkSql)
    
    console.log(`找到 ${ordersToUpdate.length} 条需要更新的订单`)
    
    if (ordersToUpdate.length === 0) {
      return {
        success: true,
        updated: 0,
      }
    }
    
    let client: PoolClient | null = null
    let updated = 0
    
    try {
      client = await getConnection()
      await client.query('BEGIN')
      
      // 辅助函数：将值转换为 NUMERIC(10, 2) 格式
      const toNumeric = (value: any): number => {
        if (value === null || value === undefined || value === '') {
          return 0
        }
        const num = typeof value === 'number' ? value : parseFloat(String(value))
        if (isNaN(num) || !isFinite(num)) {
          return 0
        }
        // 四舍五入到2位小数，符合 NUMERIC(10, 2) 格式
        return Math.round(num * 100) / 100
      }
      
      for (const order of ordersToUpdate) {
        // 重新计算profit，确保所有数字都是 NUMERIC(10, 2) 格式
        const productCost = toNumeric(order.total_product_cost)
        const shippingFee = toNumeric(order.actual_shipping_fee)
        const productAndShippingCost = toNumeric(productCost + shippingFee)
        const totalAmount = toNumeric(order.total_amount)
        const profit = toNumeric(totalAmount - productAndShippingCost)
        
        // 计算利润率
        const profitRate = productAndShippingCost > 0 
          ? toNumeric((profit / productAndShippingCost) * 100)
          : 0
        
        // 更新订单
        const updateSql = `
          UPDATE orders
          SET 
            product_and_shipping_cost = $1::NUMERIC(10, 2),
            profit = $2::NUMERIC(10, 2),
            profit_rate = $3::NUMERIC(10, 2),
            updated_at = CURRENT_TIMESTAMP
          WHERE order_number = $4
        `
        
        await client.query(updateSql, [
          productAndShippingCost,
          profit,
          profitRate,
          order.order_number,
        ])
        
        updated++
      }
      
      await client.query('COMMIT')
      console.log(`成功更新 ${updated} 条订单的profit字段`)
      
      return {
        success: true,
        updated,
      }
    } catch (error: any) {
      if (client) {
        await client.query('ROLLBACK')
      }
      console.error('重新计算profit字段失败:', error)
      return {
        success: false,
        updated,
        error: error.message || '重新计算profit字段失败',
      }
    } finally {
      if (client) {
        client.release()
      }
    }
  } catch (error: any) {
    console.error('重新计算profit字段失败:', error)
    return {
      success: false,
      updated: 0,
      error: error.message || '重新计算profit字段失败',
    }
  }
}

