'use server'

import * as XLSX from 'xlsx'
import { importInventoryData } from '@/lib/inventory-data'

/**
 * Excel文件中的列名映射
 * 根据实际Excel文件的列名进行调整
 */
const EXCEL_COLUMNS = {
  SKU: '马帮SKU',
  WAREHOUSE: '仓库',
  INVENTORY: '库存数量',
  PENDING_SHIPMENT: '待发货量',
  IN_TRANSIT: '在途量',
  SALES: '最近7天销量',
} as const

// 不再需要筛选仓库，处理所有仓库的数据

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
      EXCEL_COLUMNS.SKU,
      EXCEL_COLUMNS.WAREHOUSE,
      EXCEL_COLUMNS.INVENTORY,
      EXCEL_COLUMNS.PENDING_SHIPMENT,
      EXCEL_COLUMNS.IN_TRANSIT,
      EXCEL_COLUMNS.SALES,
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
 * 将字符串转换为整数
 * @param value 输入值
 * @param defaultValue 默认值
 * @returns 整数值
 */
function parseNumber(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue
  }
  const num = typeof value === 'string' ? parseFloat(value) : Number(value)
  return isNaN(num) ? defaultValue : Math.round(num)
}

/**
 * 计算库存数量
 * @param rows 筛选后的数据行
 * @returns 计算后的库存数量（整数）
 */
function calculateInventoryNum(rows: any[]): number {
  let totalInventory = 0
  let totalPendingShipment = 0
  let totalInTransit = 0

  rows.forEach((row) => {
    totalInventory += parseNumber(row[EXCEL_COLUMNS.INVENTORY])
    totalPendingShipment += parseNumber(row[EXCEL_COLUMNS.PENDING_SHIPMENT])
    totalInTransit += parseNumber(row[EXCEL_COLUMNS.IN_TRANSIT])
  })

  return Math.round(totalInventory - totalPendingShipment + totalInTransit)
}

/**
 * 计算最近7天销量
 * @param rows 筛选后的数据行
 * @returns 计算后的销量（整数）
 */
function calculateSalesNum(rows: any[]): number {
  let totalSales = 0

  rows.forEach((row) => {
    totalSales += parseNumber(row[EXCEL_COLUMNS.SALES])
  })

  return Math.round(totalSales)
}

/**
 * 按SKU分组并计算数据
 * @param excelData Excel解析后的数据
 * @returns 计算后的库存数据数组
 */
function calculateInventoryData(
  excelData: any[]
): Omit<import('@/lib/inventory-data').InventoryRecord, 'id' | 'created_at' | 'updated_at'>[] {
  // 使用Map按SKU分组
  const skuMap = new Map<
    string,
    {
      sku: string
      inventoryRows: any[]
      salesRows: any[]
    }
  >()

  // 按SKU分组，处理所有仓库的数据
  excelData.forEach((row) => {
    const sku = row[EXCEL_COLUMNS.SKU]
    if (!sku || sku === '') {
      return // 跳过SKU为空的行
    }

    const skuKey = String(sku).trim() // 确保SKU是字符串并去除空格

    if (!skuMap.has(skuKey)) {
      skuMap.set(skuKey, {
        sku: skuKey,
        inventoryRows: [],
        salesRows: [],
      })
    }

    // 不再筛选仓库，处理所有仓库的数据
    const skuData = skuMap.get(skuKey)!
    skuData.inventoryRows.push(row)
    skuData.salesRows.push(row)
  })

  // 计算每个SKU的值
  // 注意：每次导入都会根据新的库存数量和最近七天销量重新计算可售天数和标签
  const result: Omit<
    import('@/lib/inventory-data').InventoryRecord,
    'id' | 'created_at' | 'updated_at'
  >[] = []

  skuMap.forEach((value) => {
    // 根据Excel数据计算库存数量和最近七天销量（所有仓库数据相加）
    const inventoryNum = calculateInventoryNum(value.inventoryRows)
    const salesNum = calculateSalesNum(value.salesRows)

    // 根据导入的库存数量和最近七天销量，重新计算可售天数
    // 公式：可售天数 = 库存数量 * 7 / 最近七天销量
    // 如果最近七天销量为0，则sale_day为null
    let saleDay: number | null = null
    if (salesNum > 0) {
      saleDay = Math.round((inventoryNum * 7) / salesNum)
    }

    // 根据导入的库存数量和最近七天销量，重新生成标签列表
    const labels: number[] = []
    if (inventoryNum === 0) {
      labels.push(1) // inventory_num为0（无库存）
    }
    if (salesNum === 0) {
      labels.push(2) // sales_num为0（无销量）
    }
    if (salesNum > 300) {
      labels.push(3) // sales_num大于300（爆款）
    }
    // 在售天数预警：如果有爆款标签（3），需要大于30天；否则大于15天
    if (saleDay !== null) {
      const hasHotProduct = salesNum > 300 // 是否有爆款标签
      if (hasHotProduct && saleDay > 30) {
        labels.push(4) // 有爆款且sale_day大于30（在售天数预警）
      } else if (!hasHotProduct && saleDay > 15) {
        labels.push(4) // 无爆款且sale_day大于15（在售天数预警）
      }
    }
    if (inventoryNum < 0) {
      labels.push(5) // inventory_num为负数（库存待冲平）
    }

    const record = {
      ware_sku: value.sku,
      inventory_num: inventoryNum,
      sales_num: salesNum,
      sale_day: saleDay ?? undefined, // 将null转换为undefined以匹配接口类型
      label: labels.length > 0 ? labels : undefined,
    }

    // 调试日志（开发时可以查看）
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `SKU: ${value.sku}, 库存: ${inventoryNum}, 销量: ${salesNum}, 销售天数: ${saleDay}, 标签: [${labels.join(',')}]`
      )
    }

    result.push(record)
  })

  return result
}

/**
 * 导入库存Excel文件
 * @param formData 包含文件的FormData
 * @returns 导入结果
 */
export async function importInventoryFile(
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

    // 解析Excel文件
    const excelData = parseExcelFile(buffer)

    // 计算数据
    const inventoryData = calculateInventoryData(excelData)

    if (inventoryData.length === 0) {
      return {
        success: false,
        error: '没有找到有效的数据，请检查Excel文件格式',
      }
    }

    // 导入数据库
    const result = await importInventoryData(inventoryData)

    if (result.success) {
      return {
        success: true,
        message: `成功导入 ${inventoryData.length} 条记录（新增：${result.inserted}，更新：${result.updated}）`,
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
    console.error('导入库存文件失败:', error)
    return {
      success: false,
      error: error.message || '导入失败，请检查文件格式',
    }
  }
}

/**
 * 获取库存数据
 * @param searchSku 搜索SKU（可选）
 * @param labelFilter 标签筛选（可选）：'normal'=正常销售，4=在售天数超15天，5=库存待冲平，'2_not_1'=有库存无销量
 * @returns 库存数据
 */
export async function fetchInventoryData(searchSku?: string, labelFilter?: 'normal' | 4 | 5 | '2_not_1') {
  try {
    const { getInventoryData } = await import('@/lib/inventory-data')
    const data = await getInventoryData(searchSku, labelFilter)
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('获取库存数据失败:', error)
    return {
      success: false,
      error: error.message || '获取库存数据失败',
      data: [],
    }
  }
}

/**
 * 获取库存统计数据
 * @returns 统计数据
 */
export async function fetchInventoryStatistics() {
  try {
    const { getInventoryStatistics } = await import('@/lib/inventory-data')
    const data = await getInventoryStatistics()
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('获取库存统计数据失败:', error)
    return {
      success: false,
      error: error.message || '获取库存统计数据失败',
      data: {
        normal_sales: 0,
        over_15_days: 0,
        negative_inventory: 0,
        has_inventory_no_sales: 0,
      },
    }
  }
}

/**
 * 刷新 task 表
 * 从 inventory 表同步 label 包含 2 或 4 的记录到 task 表
 * @returns 刷新结果
 */
export async function refreshTaskTable() {
  try {
    const { syncInventoryToTask, updateTaskCountDown } = await import('@/lib/inventory-data')
    // 先同步数据
    const result = await syncInventoryToTask()
    if (result.success) {
      // 然后更新 count_down
      await updateTaskCountDown()
      return {
        success: true,
        message: '任务表刷新成功',
      }
    } else {
      return {
        success: false,
        error: result.error || '刷新失败',
      }
    }
  } catch (error: any) {
    console.error('刷新任务表失败:', error)
    return {
      success: false,
      error: error.message || '刷新任务表失败',
    }
  }
}

/**
 * 获取任务数据（从 task 表）
 * @param searchSku 搜索SKU（可选）
 * @param labelFilter 标签筛选（可选）：'over_15_days'=在售天数超15天，'has_inventory_no_sales'=有库存无销量
 * @param statusFilter 状态筛选（可选）：'no_solution'=未选择方案，'in_progress'=任务正在进行中，'timeout'=超时任务
 * @param chargeFilter 负责人筛选（可选）
 * @returns 任务数据
 */
export async function fetchTaskData(
  searchSku?: string,
  labelFilter?: 'over_15_days' | 'has_inventory_no_sales',
  statusFilter?: 'no_solution' | 'in_progress' | 'timeout',
  chargeFilter?: string
) {
  try {
    const { getTaskData } = await import('@/lib/inventory-data')
    const data = await getTaskData(searchSku, labelFilter, statusFilter, chargeFilter)
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('获取任务数据失败:', error)
    return {
      success: false,
      error: error.message || '获取任务数据失败',
      data: [],
    }
  }
}

/**
 * 获取任务负责人列表
 * @returns 负责人列表
 */
export async function fetchTaskChargeList() {
  try {
    const { getTaskChargeList } = await import('@/lib/inventory-data')
    const data = await getTaskChargeList()
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('获取负责人列表失败:', error)
    return {
      success: false,
      error: error.message || '获取负责人列表失败',
      data: [],
    }
  }
}

/**
 * 获取任务统计数据
 * @param chargeFilter 负责人筛选（可选）
 * @returns 统计数据
 */
export async function fetchTaskStatistics(chargeFilter?: string) {
  try {
    const { getTaskStatistics } = await import('@/lib/inventory-data')
    const data = await getTaskStatistics(chargeFilter)
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('获取任务统计数据失败:', error)
    return {
      success: false,
      error: error.message || '获取任务统计数据失败',
      data: {
        over_15_days: 0,
        has_inventory_no_sales: 0,
        no_solution: 0,
        in_progress: 0,
        timeout: 0,
      },
    }
  }
}

/**
 * 更新任务方案选择
 * @param wareSku SKU货号
 * @param promisedLand 方案选择：0=未选择，1=退回厂家，2=降价清仓，3=打处理
 * @returns 更新结果
 */
export async function updateTaskPromisedLand(wareSku: string, promisedLand: 0 | 1 | 2 | 3) {
  try {
    const { updateTaskPromisedLand: updateTask } = await import('@/lib/inventory-data')
    const result = await updateTask(wareSku, promisedLand)
    return result
  } catch (error: any) {
    console.error('更新任务方案失败:', error)
    return {
      success: false,
      error: error.message || '更新方案失败',
    }
  }
}

/**
 * 获取历史任务数据
 * @param searchSku 搜索SKU（可选）
 * @param chargeFilter 负责人筛选（可选）
 * @param promisedLandFilter 方案筛选（可选）：0=未选择，1=退回厂家，2=降价清仓，3=打处理
 * @param dateFrom 开始日期（可选，格式：YYYY-MM-DD）
 * @param dateTo 结束日期（可选，格式：YYYY-MM-DD）
 * @returns 历史任务数据
 */
export async function fetchTaskHistoryData(
  searchSku?: string,
  chargeFilter?: string,
  promisedLandFilter?: number,
  dateFrom?: string,
  dateTo?: string
) {
  try {
    const { getTaskHistoryData } = await import('@/lib/inventory-data')
    const data = await getTaskHistoryData(searchSku, chargeFilter, promisedLandFilter, dateFrom, dateTo)
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('获取历史任务数据失败:', error)
    return {
      success: false,
      error: error.message || '获取历史任务数据失败',
      data: [],
    }
  }
}

/**
 * 获取历史任务统计数据
 * @returns 统计数据
 */
export async function fetchTaskHistoryStatistics() {
  try {
    const { getTaskHistoryStatistics } = await import('@/lib/inventory-data')
    const stats = await getTaskHistoryStatistics()
    return {
      success: true,
      data: stats,
    }
  } catch (error: any) {
    console.error('获取历史任务统计数据失败:', error)
    return {
      success: false,
      error: error.message || '获取历史任务统计数据失败',
      data: {
        total: 0,
        total_failed: 0,
        promised_land_1: 0,
        promised_land_2: 0,
        promised_land_3: 0,
      },
    }
  }
}

/**
 * 获取历史任务负责人列表
 * @returns 负责人列表
 */
export async function fetchTaskHistoryChargeList() {
  try {
    const { getTaskHistoryChargeList } = await import('@/lib/inventory-data')
    const list = await getTaskHistoryChargeList()
    return {
      success: true,
      data: list,
    }
  } catch (error: any) {
    console.error('获取历史任务负责人列表失败:', error)
    return {
      success: false,
      error: error.message || '获取历史任务负责人列表失败',
      data: [],
    }
  }
}

