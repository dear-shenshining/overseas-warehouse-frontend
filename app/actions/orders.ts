'use server'

import * as XLSX from 'xlsx'
import { importOrdersData } from '@/lib/orders-data'
import { revalidatePath } from 'next/cache'

/**
 * Excel文件中的列名映射
 * 根据实际Excel文件的列名进行调整
 */
const EXCEL_COLUMNS = {
  ORDER_NUMBER: '订单编号',
  STORE_NAME: '店铺名',
  PAYMENT_TIME: '付款时间',
  PLATFORM_SKU: '平台SKU',
  LOGISTICS_CHANNEL: '物流渠道',
  ORDER_STATUS: '订单状态',
  TOTAL_PRODUCT_COST: '商品总成本',
  ACTUAL_SHIPPING_FEE: '实际运费',
  SALES_REFUND: '销售回款',
  SHIPPING_REFUND: '运费回款',
  TOTAL_AMOUNT: '总计金额',
} as const

/**
 * 解析Excel文件
 * @param fileBuffer Excel文件的Buffer
 * @returns 解析后的数据数组
 */
function parseExcelFile(fileBuffer: Buffer): any[] {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0] // 读取第一个工作表
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: null }) // 转换为JSON数组

    // 验证必要列是否存在
    if (data.length === 0) {
      throw new Error('Excel文件为空或没有数据')
    }

    // 检查第一行数据是否包含必要的列
    const firstRow = data[0] as any
    const requiredColumns = [
      EXCEL_COLUMNS.ORDER_NUMBER,
    ]

    const missingColumns = requiredColumns.filter(
      (col) => !(col in firstRow)
    )

    if (missingColumns.length > 0) {
      throw new Error(
        `Excel文件缺少必要的列：${missingColumns.join('、')}`
      )
    }

    return data
  } catch (error: any) {
    if (error.message) {
      throw error
    }
    throw new Error('解析Excel文件失败：' + error.message)
  }
}

/**
 * 将值转换为 NUMERIC(10, 2) 格式的数字
 * 数据库字段类型：NUMERIC(10, 2) - 最多10位数字，小数点后2位
 * @param value 输入值
 * @param defaultValue 默认值
 * @returns 数字值（符合 NUMERIC(10, 2) 格式）
 */
function parseNumber(value: any, defaultValue: number = 0): number {
  // 处理 null、undefined、空字符串
  if (value === null || value === undefined || value === '') {
    return defaultValue
  }
  
  // 如果已经是数字类型
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      return defaultValue
    }
    // 限制为 NUMERIC(10, 2) 格式：最多10位数字，小数点后2位
    // 先四舍五入到2位小数
    const rounded = Math.round(value * 100) / 100
    // 检查是否超出范围（10位数字，包括小数点）
    if (Math.abs(rounded) >= 1000000000) { // 10位数字的最大值
      console.warn(`数字超出范围: ${value}，将被限制为 ${rounded}`)
    }
    return rounded
  }
  
  // 如果是字符串类型
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') {
      return defaultValue
    }
    
    // 移除所有空格、逗号等分隔符
    let cleaned = trimmed.replace(/[\s,，]/g, '')
    
    // 处理多个小数点的情况：只保留第一个小数点
    const firstDotIndex = cleaned.indexOf('.')
    if (firstDotIndex !== -1) {
      const beforeDot = cleaned.substring(0, firstDotIndex + 1)
      const afterDot = cleaned.substring(firstDotIndex + 1).replace(/\./g, '')
      cleaned = beforeDot + afterDot
    }
    
    // 移除所有非数字字符（保留小数点和负号）
    cleaned = cleaned.replace(/[^\d.-]/g, '')
    
    // 处理多个负号：只保留第一个（如果存在）
    const negativeCount = (cleaned.match(/-/g) || []).length
    if (negativeCount > 1) {
      cleaned = '-' + cleaned.replace(/-/g, '')
    } else if (negativeCount === 1 && cleaned.indexOf('-') !== 0) {
      // 如果负号不在开头，移到开头
      cleaned = '-' + cleaned.replace(/-/g, '')
    }
    
    // 尝试解析为数字
    const num = parseFloat(cleaned)
    if (isNaN(num) || !isFinite(num)) {
      // 如果解析失败，尝试提取第一个有效的数字部分
      const match = cleaned.match(/^-?\d+\.?\d*/)
      if (match) {
        const extractedNum = parseFloat(match[0])
        if (!isNaN(extractedNum) && isFinite(extractedNum)) {
          console.warn(`数字解析警告: "${value}" 被解析为 ${extractedNum}`)
          // 四舍五入到2位小数
          return Math.round(extractedNum * 100) / 100
        }
      }
      console.warn(`数字解析失败: "${value}" 无法转换为数字，使用默认值 ${defaultValue}`)
      return defaultValue
    }
    
    // 四舍五入到2位小数（符合 NUMERIC(10, 2) 格式）
    return Math.round(num * 100) / 100
  }
  
  // 其他类型，尝试转换为数字
  try {
    const num = Number(value)
    if (isNaN(num) || !isFinite(num)) {
      return defaultValue
    }
    // 四舍五入到2位小数
    return Math.round(num * 100) / 100
  } catch (error) {
    console.warn(`数字转换失败: ${value}，使用默认值 ${defaultValue}`)
    return defaultValue
  }
}

/**
 * 解析日期字符串
 * @param value 输入值
 * @returns 日期字符串或null
 */
function parseDate(value: any): string | null {
  if (!value) {
    return null
  }

  // 如果是日期对象
  if (value instanceof Date) {
    return value.toISOString().split('T')[0] + ' ' + value.toTimeString().split(' ')[0]
  }

  // 如果是数字（Excel日期序列号）
  if (typeof value === 'number') {
    // Excel日期从1900-01-01开始计算
    const excelEpoch = new Date(1899, 11, 30)
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000)
    return date.toISOString().replace('T', ' ').substring(0, 19)
  }

  // 如果是字符串
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') {
      return null
    }
    // 尝试解析常见日期格式
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) {
      return date.toISOString().replace('T', ' ').substring(0, 19)
    }
  }

  return null
}

/**
 * 将Excel数据转换为订单数据
 * @param excelData Excel解析后的数据
 * @returns 订单数据数组
 */
function convertToOrdersData(
  excelData: any[]
): Omit<import('@/lib/orders-data').OrderRecord, 'id' | 'created_at' | 'updated_at'>[] {
  const orders: Omit<import('@/lib/orders-data').OrderRecord, 'id' | 'created_at' | 'updated_at'>[] = []

  excelData.forEach((row, index) => {
    const orderNumber = row[EXCEL_COLUMNS.ORDER_NUMBER]
    
    // 跳过订单编号为空的行
    if (!orderNumber || String(orderNumber).trim() === '') {
      return
    }

    const order: Omit<import('@/lib/orders-data').OrderRecord, 'id' | 'created_at' | 'updated_at'> = {
      order_number: String(orderNumber).trim(),
      store_name: row[EXCEL_COLUMNS.STORE_NAME] ? String(row[EXCEL_COLUMNS.STORE_NAME]).trim() : undefined,
      payment_time: parseDate(row[EXCEL_COLUMNS.PAYMENT_TIME]) || undefined,
      platform_sku: row[EXCEL_COLUMNS.PLATFORM_SKU] ? String(row[EXCEL_COLUMNS.PLATFORM_SKU]).trim() : undefined,
      logistics_channel: row[EXCEL_COLUMNS.LOGISTICS_CHANNEL] ? String(row[EXCEL_COLUMNS.LOGISTICS_CHANNEL]).trim() : undefined,
      order_status: row[EXCEL_COLUMNS.ORDER_STATUS] ? String(row[EXCEL_COLUMNS.ORDER_STATUS]).trim() : undefined,
      total_product_cost: parseNumber(row[EXCEL_COLUMNS.TOTAL_PRODUCT_COST], 0),
      actual_shipping_fee: parseNumber(row[EXCEL_COLUMNS.ACTUAL_SHIPPING_FEE], 0),
      sales_refund: parseNumber(row[EXCEL_COLUMNS.SALES_REFUND], 0),
      shipping_refund: parseNumber(row[EXCEL_COLUMNS.SHIPPING_REFUND], 0),
      total_amount: parseNumber(row[EXCEL_COLUMNS.TOTAL_AMOUNT], 0),
    }

    orders.push(order)
  })

  return orders
}

/**
 * 导入订单Excel文件
 * @param formData 包含文件的FormData
 * @returns 导入结果
 */
export async function importOrdersFile(
  formData: FormData
): Promise<{
  success: boolean
  message?: string
  error?: string
  inserted?: number
  updated?: number
}> {
  try {
    const file = formData.get('file') as File | null

    if (!file) {
      return {
        success: false,
        error: '未选择文件',
      }
    }

    // 验证文件类型
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return {
        success: false,
        error: '请选择Excel文件（.xlsx或.xls格式）',
      }
    }

    // 验证文件大小（限制10MB）
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: '文件大小不能超过10MB',
      }
    }

    // 读取文件
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log('开始解析Excel文件...')
    // 解析Excel文件
    const excelData = parseExcelFile(buffer)
    console.log(`Excel文件解析完成，共 ${excelData.length} 行数据`)

    // 转换为订单数据
    const ordersData = convertToOrdersData(excelData)
    console.log(`数据转换完成，共 ${ordersData.length} 条有效订单`)

    if (ordersData.length === 0) {
      return {
        success: false,
        error: '没有找到有效的数据，请检查Excel文件格式',
      }
    }

    console.log('开始导入数据库...')
    // 导入数据库
    const result = await importOrdersData(ordersData)
    console.log('数据库导入完成:', result)

    if (result.success) {
      // 重新验证路径，刷新数据
      revalidatePath('/')
      
      return {
        success: true,
        message: `成功导入 ${ordersData.length} 条记录（新增：${result.inserted}，更新：${result.updated}）`,
        inserted: result.inserted,
        updated: result.updated,
      }
    } else {
      return {
        success: false,
        error: result.error || '导入失败',
        inserted: result.inserted,
        updated: result.updated,
      }
    }
  } catch (error: any) {
    console.error('导入订单文件失败:', error)
    return {
      success: false,
      error: error.message || '导入订单文件失败',
    }
  }
}

/**
 * 获取订单统计数据
 */
export async function fetchOrdersStatistics(
  dateFrom?: string,
  dateTo?: string,
  storeName?: string,
  operator?: string
) {
  try {
    const { getOrdersStatistics } = await import('@/lib/orders-data')
    const stats = await getOrdersStatistics(dateFrom, dateTo, storeName, operator)
    return {
      success: true,
      data: {
        totalAmount: stats.totalAmount,
        totalProfit: stats.totalProfit,
        totalShipping: stats.totalShipping,
        totalOrders: stats.totalOrders,
        lowProfitRateCount: stats.lowProfitRateCount,
        noShippingRefundCount: stats.noShippingRefundCount,
        dailyData: stats.dailyData,
      },
    }
  } catch (error: any) {
    console.error('获取订单统计数据失败:', error)
    return {
      success: false,
      error: error.message || '获取订单统计数据失败',
      data: {
        totalAmount: 0,
        totalProfit: 0,
        totalShipping: 0,
        totalOrders: 0,
        lowProfitRateCount: 0,
        noShippingRefundCount: 0,
        dailyData: [],
      },
    }
  }
}

/**
 * 获取店铺列表
 */
export async function fetchStoreList() {
  try {
    const { getStoreList } = await import('@/lib/orders-data')
    const stores = await getStoreList()
    return {
      success: true,
      data: stores,
    }
  } catch (error: any) {
    console.error('获取店铺列表失败:', error)
    return {
      success: false,
      error: error.message || '获取店铺列表失败',
      data: [],
    }
  }
}

/**
 * 获取运营人员列表
 */
export async function fetchOperatorList() {
  try {
    const { getAllOperators } = await import('@/lib/operator-mapping')
    const operators = getAllOperators()
    return {
      success: true,
      data: operators,
    }
  } catch (error: any) {
    console.error('获取运营人员列表失败:', error)
    return {
      success: false,
      error: error.message || '获取运营人员列表失败',
      data: [],
    }
  }
}

/**
 * 获取订单列表（带筛选条件）
 */
export async function fetchOrdersList(
  dateFrom?: string,
  dateTo?: string,
  storeName?: string,
  operator?: string,
  filterType?: 'lowProfitRate' | 'noShippingRefund'
) {
  try {
    const { getOrdersData } = await import('@/lib/orders-data')
    // 直接在数据库层面过滤，提高性能
    const orders = await getOrdersData(dateFrom, dateTo, storeName, operator, filterType)
    
    // 转换数据格式，确保类型正确
    const formattedOrders = orders.map(order => ({
      order_number: order.order_number,
      store_name: order.store_name || undefined,
      payment_time: order.payment_time || undefined,
      platform_sku: order.platform_sku || undefined,
      logistics_channel: order.logistics_channel || undefined,
      total_product_cost: order.total_product_cost || 0,
      actual_shipping_fee: order.actual_shipping_fee || 0,
      profit: order.profit || 0,
      profit_rate: order.profit_rate !== null && order.profit_rate !== undefined ? order.profit_rate : undefined,
      shipping_refund: order.shipping_refund || 0,
    }))
    
    return {
      success: true,
      data: formattedOrders,
    }
  } catch (error: any) {
    console.error('获取订单列表失败:', error)
    return {
      success: false,
      error: error.message || '获取订单列表失败',
      data: [],
    }
  }
}

/**
 * 重新计算profit字段（用于修复旧数据）
 */
export async function recalculateProfit() {
  try {
    const { recalculateProfit: recalculateProfitFn } = await import('@/lib/orders-data')
    const result = await recalculateProfitFn()
    
    if (result.success) {
      // 重新验证路径，刷新数据
      revalidatePath('/')
    }
    
    return {
      success: result.success,
      updated: result.updated,
      error: result.error,
      message: result.success 
        ? `成功更新 ${result.updated} 条订单的profit字段`
        : result.error || '重新计算失败',
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
 * @param dateFrom 开始日期
 * @param dateTo 结束日期
 * @param storeName 店铺名称（可选）
 * @param operator 运营人员（可选）
 * @returns 异常SKU数据
 */
export async function fetchAnomalySKUs(
  dateFrom?: string,
  dateTo?: string,
  storeName?: string,
  operator?: string
) {
  try {
    const { getAnomalySKUs } = await import('@/lib/orders-data')
    const result = await getAnomalySKUs(dateFrom, dateTo, storeName, operator)
    return {
      success: true,
      data: result,
    }
  } catch (error: any) {
    console.error('获取异常SKU数据失败:', error)
    return {
      success: false,
      error: error.message || '获取异常SKU数据失败',
      data: {
        totalCount: 0,
        lowProfitRateCount: 0,
        noShippingRefundCount: 0,
        anomalyCount: 0,
        anomalyRate: 0,
        lowProfitRateSKUs: [],
        noShippingRefundSKUs: [],
      },
    }
  }
}

/**
 * 批量更新现有订单的operator字段
 * 根据店铺名称匹配运营人员
 */
export async function updateOperatorsForExistingOrders() {
  try {
    const { updateOperatorsForExistingOrders: updateOperators } = await import('@/lib/orders-data')
    const result = await updateOperators()
    
    if (result.success) {
      // 重新验证路径，刷新数据
      revalidatePath('/')
    }
    
    return {
      success: result.success,
      updated: result.updated,
      error: result.error,
      message: result.success 
        ? `成功更新 ${result.updated} 条订单的operator字段`
        : result.error || '批量更新失败',
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
 * 获取特定SKU的异常订单详情
 */
export async function fetchAnomalyOrderDetails(
  platformSku: string,
  anomalyType: 'lowProfitRate' | 'noShippingRefund',
  dateFrom?: string,
  dateTo?: string,
  storeName?: string,
  operator?: string
) {
  try {
    const { getAnomalyOrderDetails } = await import('@/lib/orders-data')
    const orders = await getAnomalyOrderDetails(
      platformSku,
      anomalyType,
      dateFrom,
      dateTo,
      storeName,
      operator
    )
    return {
      success: true,
      data: orders,
    }
  } catch (error: any) {
    console.error('获取异常订单详情失败:', error)
    return {
      success: false,
      error: error.message || '获取异常订单详情失败',
      data: [],
    }
  }
}

