/**
 * 订单数据服务
 * 处理订单数据的数据库操作
 */
import { query, execute, getConnection } from '@/lib/db'
import { PoolClient } from 'pg'
import { getOperatorByStoreName } from '@/lib/operator-mapping'

export interface OrderRecord {
  id?: number
  order_number: string
  store_name?: string
  operator?: string // 运营人员
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
 * 检查orders表是否存在operator字段
 * @param client 数据库客户端（可选）
 * @returns 是否存在operator字段
 */
async function checkOperatorFieldExists(client?: PoolClient): Promise<boolean> {
  try {
    const checkSql = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'operator'
    `
    const result = client 
      ? await client.query(checkSql)
      : await query<{ column_name: string }>(checkSql)
    return result.length > 0
  } catch (error) {
    console.warn('检查operator字段失败:', error)
    return false
  }
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

    // 检查operator字段是否存在（只检查一次）
    const hasOperatorField = await checkOperatorFieldExists(client)

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

        // 根据店铺名称自动匹配运营人员
        const operator = order.operator || (order.store_name ? getOperatorByStoreName(order.store_name) : null)
        
        const rowPlaceholders: string[] = []
        const fieldCount = hasOperatorField ? 15 : 14 // 如果有operator字段，则15个字段
        for (let i = 0; i < fieldCount; i++) {
          rowPlaceholders.push(`$${paramIndex++}`)
        }
        placeholders.push(`(${rowPlaceholders.join(', ')})`)

        // 确保所有值都符合数据库字段类型
        const rowValues: any[] = [
          String(order.order_number), // VARCHAR(255)
          order.store_name ? String(order.store_name) : null, // VARCHAR(255)
        ]
        
        // 如果有operator字段，添加运营人员
        if (hasOperatorField) {
          rowValues.push(operator) // 在store_name之后添加operator
        }
        
        // 添加其他字段
        rowValues.push(
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
        
        values.push(...rowValues)
      }

      // 使用 INSERT ... ON CONFLICT 进行批量插入/更新
      // 明确指定NUMERIC类型转换，确保PostgreSQL正确理解数据类型
      const insertFields = hasOperatorField
        ? `order_number, store_name, operator, payment_time, platform_sku, logistics_channel, order_status, total_product_cost, actual_shipping_fee, product_and_shipping_cost, profit, profit_rate, sales_refund, shipping_refund, total_amount`
        : `order_number, store_name, payment_time, platform_sku, logistics_channel, order_status, total_product_cost, actual_shipping_fee, product_and_shipping_cost, profit, profit_rate, sales_refund, shipping_refund, total_amount`
      
      const updateFields = hasOperatorField
        ? `store_name = EXCLUDED.store_name,
          operator = EXCLUDED.operator,
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
          updated_at = CURRENT_TIMESTAMP`
        : `store_name = EXCLUDED.store_name,
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
          updated_at = CURRENT_TIMESTAMP`
      
      const insertSql = `
        INSERT INTO orders (${insertFields})
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (order_number) 
        DO UPDATE SET ${updateFields}
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
 * @param operator 运营人员（可选）
 * @param filterType 筛选类型（可选）
 * @returns 订单数据数组
 */
export async function getOrdersData(
  dateFrom?: string,
  dateTo?: string,
  storeName?: string,
  operator?: string,
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

    // 运营筛选
    if (operator && operator !== 'all') {
      // 检查operator字段是否存在
      const hasOperatorField = await checkOperatorFieldExists()
      if (hasOperatorField) {
        sql += ` AND operator = $${paramIndex}`
        params.push(operator)
        paramIndex++
      } else {
        // 如果operator字段不存在，根据店铺名称筛选
        // 获取该运营人员对应的店铺列表
        const { getStoresByOperator } = await import('@/lib/operator-mapping')
        const stores = getStoresByOperator(operator)
        if (stores.length > 0) {
          const storePlaceholders = stores.map((_, i) => `$${paramIndex + i}`).join(',')
          sql += ` AND store_name IN (${storePlaceholders})`
          params.push(...stores)
          paramIndex += stores.length
        } else {
          // 如果没有找到对应的店铺，返回空结果
          sql += ` AND 1=0`
        }
      }
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
 * @param operator 运营人员（可选）
 * @returns 统计数据
 */
export async function getOrdersStatistics(
  dateFrom?: string,
  dateTo?: string,
  storeName?: string,
  operator?: string
): Promise<{
  totalAmount: number // 结算总金额（total_amount字段的总和）
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
    const { query } = await import('@/lib/db')
    
    // 构建基础WHERE条件
    let whereConditions = ['payment_time IS NOT NULL']
    const params: any[] = []
    let paramIndex = 1

    if (dateFrom) {
      whereConditions.push(`payment_time::date >= $${paramIndex}::date`)
      params.push(dateFrom)
      paramIndex++
    }

    if (dateTo) {
      whereConditions.push(`payment_time::date <= $${paramIndex}::date`)
      params.push(dateTo)
      paramIndex++
    }

    if (storeName && storeName !== 'all') {
      whereConditions.push(`store_name = $${paramIndex}`)
      params.push(storeName)
      paramIndex++
    }

    // 运营筛选
    if (operator && operator !== 'all') {
      // 检查operator字段是否存在
      const { checkOperatorFieldExists } = await import('@/lib/orders-data')
      const hasOperatorField = await checkOperatorFieldExists()
      if (hasOperatorField) {
        whereConditions.push(`operator = $${paramIndex}`)
        params.push(operator)
        paramIndex++
      } else {
        // 如果operator字段不存在，根据店铺名称筛选
        const { getStoresByOperator } = await import('@/lib/operator-mapping')
        const stores = getStoresByOperator(operator)
        if (stores.length > 0) {
          const storePlaceholders = stores.map((_, i) => `$${paramIndex + i}`).join(',')
          whereConditions.push(`store_name IN (${storePlaceholders})`)
          params.push(...stores)
          paramIndex += stores.length
        } else {
          // 如果没有找到对应的店铺，返回空结果
          whereConditions.push(`1=0`)
        }
      }
    }

    const whereClause = whereConditions.join(' AND ')

    // 使用SQL聚合查询直接在数据库层面计算统计数据，大幅提升性能
    const statsSql = `
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(SUM(actual_shipping_fee), 0) as total_shipping,
        COUNT(CASE WHEN profit_rate IS NOT NULL AND profit_rate < 20 THEN 1 END) as low_profit_rate_count,
        COUNT(CASE WHEN shipping_refund IS NULL OR shipping_refund = 0 THEN 1 END) as no_shipping_refund_count
      FROM orders
      WHERE ${whereClause}
    `

    // 按日期分组统计每日数据
    const dailyDataSql = `
      SELECT 
        payment_time::date as date,
        COALESCE(SUM(profit), 0) as profit,
        COALESCE(SUM(actual_shipping_fee), 0) as shipping
      FROM orders
      WHERE ${whereClause}
      GROUP BY payment_time::date
      ORDER BY payment_time::date ASC
    `

    const [statsResult, dailyDataResult] = await Promise.all([
      query<{
        total_orders: string
        total_amount: string
        total_profit: string
        total_shipping: string
        low_profit_rate_count: string
        no_shipping_refund_count: string
      }>(statsSql, params),
      query<{
        date: Date | string
        profit: string
        shipping: string
      }>(dailyDataSql, params),
    ])

    const stats = statsResult[0]
    const totalAmount = parseFloat(stats?.total_amount || '0')
    const totalProfit = parseFloat(stats?.total_profit || '0')
    const totalShipping = parseFloat(stats?.total_shipping || '0')
    const totalOrders = parseInt(stats?.total_orders || '0', 10)
    const lowProfitRateCount = parseInt(stats?.low_profit_rate_count || '0', 10)
    const noShippingRefundCount = parseInt(stats?.no_shipping_refund_count || '0', 10)

    // 格式化每日数据
    const dailyData = dailyDataResult.map(row => {
      let dateStr: string
      if (row.date instanceof Date) {
        const year = row.date.getFullYear()
        const month = String(row.date.getMonth() + 1).padStart(2, '0')
        const day = String(row.date.getDate()).padStart(2, '0')
        dateStr = `${year}-${month}-${day}`
      } else {
        dateStr = String(row.date).split('T')[0].split(' ')[0]
      }
      return {
        date: dateStr,
        profit: parseFloat(row.profit || '0'),
        shipping: parseFloat(row.shipping || '0'),
      }
    })

    return {
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalShipping: Math.round(totalShipping * 100) / 100,
      totalOrders,
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
 * 批量更新现有订单的operator字段
 * 根据店铺名称匹配运营人员
 * @returns 更新结果
 */
export async function updateOperatorsForExistingOrders(): Promise<{
  success: boolean
  updated: number
  error?: string
}> {
  try {
    // 检查operator字段是否存在
    const hasOperatorField = await checkOperatorFieldExists()
    if (!hasOperatorField) {
      return {
        success: false,
        updated: 0,
        error: 'operator字段不存在，请先执行数据库迁移脚本',
      }
    }

    const { getOperatorByStoreName } = await import('@/lib/operator-mapping')

    // 获取所有有店铺名称但operator为空的订单
    const selectSql = `
      SELECT DISTINCT store_name 
      FROM orders 
      WHERE store_name IS NOT NULL 
        AND store_name != '' 
        AND (operator IS NULL OR operator = '')
      ORDER BY store_name
    `
    const stores = await query<{ store_name: string }>(selectSql)

    if (stores.length === 0) {
      return {
        success: true,
        updated: 0,
      }
    }

    console.log(`找到 ${stores.length} 个需要更新operator的店铺`)

    let client: PoolClient | null = null
    let totalUpdated = 0

    try {
      client = await getConnection()
      await client.query('BEGIN')

      // 批量更新每个店铺的operator
      for (const store of stores) {
        const operator = getOperatorByStoreName(store.store_name)
        if (operator) {
          const updateSql = `
            UPDATE orders 
            SET operator = $1, updated_at = CURRENT_TIMESTAMP
            WHERE store_name = $2 
              AND (operator IS NULL OR operator = '')
          `
          const result = await client.query(updateSql, [operator, store.store_name])
          const updated = result.rowCount || 0
          totalUpdated += updated
          console.log(`更新店铺 "${store.store_name}" 的 ${updated} 条订单，运营人员: ${operator}`)
        } else {
          console.warn(`未找到店铺 "${store.store_name}" 对应的运营人员`)
        }
      }

      await client.query('COMMIT')
      console.log(`成功更新 ${totalUpdated} 条订单的operator字段`)

      return {
        success: true,
        updated: totalUpdated,
      }
    } catch (error: any) {
      if (client) {
        await client.query('ROLLBACK')
      }
      throw error
    } finally {
      if (client) {
        client.release()
      }
    }
  } catch (error: any) {
    console.error('批量更新operator字段失败:', error)
    return {
      success: false,
      updated: 0,
      error: error.message || '批量更新operator字段失败',
    }
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

/**
 * 获取异常SKU数据（按SKU分组统计）
 * @param dateFrom 开始日期（可选，格式：YYYY-MM-DD）
 * @param dateTo 结束日期（可选，格式：YYYY-MM-DD）
 * @param storeName 店铺名称（可选）
 * @param operator 运营人员（可选）
 * @returns 异常SKU数据
 */
export async function getAnomalySKUs(
  dateFrom?: string,
  dateTo?: string,
  storeName?: string,
  operator?: string
): Promise<{
  totalCount: number // 筛选范围内的总订单数量
  lowProfitRateCount: number // 毛利率低的订单数量
  noShippingRefundCount: number // 无运费补贴的订单数量
  anomalyCount: number // 异常订单总数（毛利率低 + 无运费补贴，去重）
  anomalyRate: number // 异常率（异常订单数 / 总订单数 * 100）
  lowProfitRateSKUs: Array<{
    platform_sku: string
    totalCount: number // 该SKU在筛选范围内的总订单数
    anomalyCount: number // 该SKU毛利率低的订单数
    anomalyRate: number // 该SKU的异常率
    avg_profit_rate: number // 平均毛利率
  }>
  noShippingRefundSKUs: Array<{
    platform_sku: string
    totalCount: number // 该SKU在筛选范围内的总订单数
    anomalyCount: number // 该SKU无运费补贴的订单数
    anomalyRate: number // 该SKU的异常率
  }>
}> {
  try {
    const { query } = await import('@/lib/db')
    
    // 构建基础WHERE条件
    let whereConditions = ['payment_time IS NOT NULL', 'platform_sku IS NOT NULL', "platform_sku != ''"]
    const params: any[] = []
    let paramIndex = 1

    if (dateFrom) {
      whereConditions.push(`payment_time::date >= $${paramIndex}::date`)
      params.push(dateFrom)
      paramIndex++
    }

    if (dateTo) {
      whereConditions.push(`payment_time::date <= $${paramIndex}::date`)
      params.push(dateTo)
      paramIndex++
    }

    if (storeName && storeName !== 'all') {
      whereConditions.push(`store_name = $${paramIndex}`)
      params.push(storeName)
      paramIndex++
    }

    // 运营筛选
    if (operator && operator !== 'all') {
      // 检查operator字段是否存在
      const hasOperatorField = await checkOperatorFieldExists()
      if (hasOperatorField) {
        whereConditions.push(`operator = $${paramIndex}`)
        params.push(operator)
        paramIndex++
      } else {
        // 如果operator字段不存在，根据店铺名称筛选
        const { getStoresByOperator } = await import('@/lib/operator-mapping')
        const stores = getStoresByOperator(operator)
        if (stores.length > 0) {
          const storePlaceholders = stores.map((_, i) => `$${paramIndex + i}`).join(',')
          whereConditions.push(`store_name IN (${storePlaceholders})`)
          params.push(...stores)
          paramIndex += stores.length
        } else {
          // 如果没有找到对应的店铺，返回空结果
          whereConditions.push(`1=0`)
        }
      }
    }

    const whereClause = whereConditions.join(' AND ')

    // 查询总订单数量
    const totalCountSql = `
      SELECT COUNT(*) as count
      FROM orders
      WHERE ${whereClause}
    `

    // 查询毛利率低的订单数量
    const lowProfitRateCountSql = `
      SELECT COUNT(*) as count
      FROM orders
      WHERE ${whereClause}
        AND profit_rate IS NOT NULL 
        AND profit_rate < 20
    `

    // 查询无运费补贴的订单数量
    const noShippingRefundCountSql = `
      SELECT COUNT(*) as count
      FROM orders
      WHERE ${whereClause}
        AND (shipping_refund IS NULL OR shipping_refund = 0)
    `

    // 查询异常订单总数（毛利率低或无运费补贴，去重）
    const anomalyCountSql = `
      SELECT COUNT(DISTINCT id) as count
      FROM orders
      WHERE ${whereClause}
        AND (
          (profit_rate IS NOT NULL AND profit_rate < 20)
          OR (shipping_refund IS NULL OR shipping_refund = 0)
        )
    `

    // 查询毛利率低数量最多的SKU（前10个）
    // 毛利率低于20%的订单，按SKU分组统计
    // 使用子查询获取每个SKU的总订单数和异常订单数
    const lowProfitRateSql = `
      WITH anomaly_skus AS (
        SELECT 
          platform_sku,
          COUNT(*) as anomaly_count,
          ROUND(AVG(profit_rate)::numeric, 2) as avg_profit_rate
        FROM orders
        WHERE ${whereClause}
          AND profit_rate IS NOT NULL 
          AND profit_rate < 20
        GROUP BY platform_sku
        ORDER BY anomaly_count DESC
        LIMIT 10
      )
      SELECT 
        a.platform_sku,
        a.anomaly_count,
        a.avg_profit_rate,
        COALESCE(t.total_count, 0) as total_count
      FROM anomaly_skus a
      LEFT JOIN (
        SELECT 
          platform_sku,
          COUNT(*) as total_count
        FROM orders
        WHERE ${whereClause}
        GROUP BY platform_sku
      ) t ON a.platform_sku = t.platform_sku
      ORDER BY a.anomaly_count DESC
    `

    // 查询无运费补贴数量最多的SKU（前10个）
    // 运费回款为0或null的订单，按SKU分组统计
    // 使用子查询获取每个SKU的总订单数和异常订单数
    const noShippingRefundSql = `
      WITH anomaly_skus AS (
        SELECT 
          platform_sku,
          COUNT(*) as anomaly_count
        FROM orders
        WHERE ${whereClause}
          AND (shipping_refund IS NULL OR shipping_refund = 0)
        GROUP BY platform_sku
        ORDER BY anomaly_count DESC
        LIMIT 10
      )
      SELECT 
        a.platform_sku,
        a.anomaly_count,
        COALESCE(t.total_count, 0) as total_count
      FROM anomaly_skus a
      LEFT JOIN (
        SELECT 
          platform_sku,
          COUNT(*) as total_count
        FROM orders
        WHERE ${whereClause}
        GROUP BY platform_sku
      ) t ON a.platform_sku = t.platform_sku
      ORDER BY a.anomaly_count DESC
    `

    const [
      totalCountResult,
      lowProfitRateCountResult,
      noShippingRefundCountResult,
      anomalyCountResult,
      lowProfitRateResults,
      noShippingRefundResults,
    ] = await Promise.all([
      query<{ count: string }>(totalCountSql, params),
      query<{ count: string }>(lowProfitRateCountSql, params),
      query<{ count: string }>(noShippingRefundCountSql, params),
      query<{ count: string }>(anomalyCountSql, params),
      query<{ platform_sku: string; anomaly_count: string; avg_profit_rate: string; total_count: string }>(lowProfitRateSql, params),
      query<{ platform_sku: string; anomaly_count: string; total_count: string }>(noShippingRefundSql, params),
    ])

    const totalCount = parseInt(totalCountResult[0]?.count || '0', 10)
    const lowProfitRateCount = parseInt(lowProfitRateCountResult[0]?.count || '0', 10)
    const noShippingRefundCount = parseInt(noShippingRefundCountResult[0]?.count || '0', 10)
    const anomalyCount = parseInt(anomalyCountResult[0]?.count || '0', 10)
    const anomalyRate = totalCount > 0 ? (anomalyCount / totalCount) * 100 : 0

    return {
      totalCount,
      lowProfitRateCount,
      noShippingRefundCount,
      anomalyCount,
      anomalyRate: Math.round(anomalyRate * 100) / 100, // 保留2位小数
      lowProfitRateSKUs: lowProfitRateResults.map(r => {
        const totalCount = parseInt(r.total_count, 10)
        const anomalyCount = parseInt(r.anomaly_count, 10)
        const anomalyRate = totalCount > 0 ? (anomalyCount / totalCount) * 100 : 0
        return {
          platform_sku: r.platform_sku,
          totalCount,
          anomalyCount,
          anomalyRate: Math.round(anomalyRate * 100) / 100, // 保留2位小数
          avg_profit_rate: parseFloat(r.avg_profit_rate),
        }
      }),
      noShippingRefundSKUs: noShippingRefundResults.map(r => {
        const totalCount = parseInt(r.total_count, 10)
        const anomalyCount = parseInt(r.anomaly_count, 10)
        const anomalyRate = totalCount > 0 ? (anomalyCount / totalCount) * 100 : 0
        return {
          platform_sku: r.platform_sku,
          totalCount,
          anomalyCount,
          anomalyRate: Math.round(anomalyRate * 100) / 100, // 保留2位小数
        }
      }),
    }
  } catch (error) {
    console.error('获取异常SKU数据失败:', error)
    throw error
  }
}

