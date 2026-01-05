/**
 * 库存数据服务
 * 处理库存数据的数据库操作
 */
import { query, execute, getConnection } from '@/lib/db'
import mysql from 'mysql2/promise'

export interface InventoryRecord {
  id?: number
  ware_sku: string
  inventory_num: number
  sales_num: number
  sale_day?: number
  charge?: string
  label?: number[] | string // 标签列表，存储为数组或JSON字符串
  promised_land?: number // 方案选择：0=未选择，1=退回厂家，2=降价清仓，3=打处理
  count_down?: number // 倒计时数字，默认值为1
  created_at?: string
  updated_at?: string
}

/**
 * 从 per_charge 表获取所有 SKU 和 charge 的映射
 * 用于匹配：inventory.ware_sku 包含 per_charge.sku 时，使用 per_charge.charge
 * @returns SKU到charge的映射数组
 */
export async function getChargeMap(): Promise<Array<{ sku: string; charge: string }>> {
  try {
    // 获取所有 per_charge 记录
    const sql = `SELECT sku, charge FROM per_charge`
    const results = await query<{ sku: string; charge: string }>(sql)

    return results
  } catch (error) {
    console.error('获取charge映射失败:', error)
    // 如果per_charge表不存在或查询失败，返回空数组
    return []
  }
}

/**
 * 根据 ware_sku 查找匹配的 charge
 * 匹配规则：
 * 1. 如果 ware_sku 包含 "ZMT"，直接返回 "朱梦婷"
 * 2. 否则，ware_sku 包含 per_charge.sku 时，返回对应的 charge
 * @param wareSku inventory 表的 ware_sku
 * @param chargeMap per_charge 表的记录数组
 * @returns 匹配的 charge 值，如果没有匹配则返回 null
 */
function findChargeBySku(
  wareSku: string,
  chargeMap: Array<{ sku: string; charge: string }>
): string | null {
  // 特殊规则：如果包含 ZMT，直接返回 "朱梦婷"
  if (wareSku.includes('ZMT')) {
    return '朱梦婷'
  }

  // 遍历所有 per_charge 记录，找到第一个 ware_sku 包含其 sku 的记录
  for (const record of chargeMap) {
    if (wareSku.includes(record.sku)) {
      return record.charge
    }
  }
  return null
}

/**
 * 批量导入库存数据
 * 对于已存在的SKU执行UPDATE，对于不存在的SKU执行INSERT
 * 
 * 更新逻辑：
 * - 根据导入的库存数量（inventory_num）和最近七天销量（sales_num）重新计算可售天数（sale_day）和标签（label）
 * - SKU货号（ware_sku）是唯一标识，用于匹配记录
 * - charge字段：如果记录已存在且已有charge值，则保持不变；否则根据匹配规则设置
 * 
 * @param data 库存数据数组（已包含计算好的inventory_num、sales_num、sale_day、label）
 * @returns 导入结果统计
 */
export async function importInventoryData(
  data: Omit<InventoryRecord, 'id' | 'created_at' | 'updated_at'>[]
): Promise<{ success: boolean; inserted: number; updated: number; error?: string }> {
  const connection = await getConnection()
  await connection.beginTransaction()

  let inserted = 0
  let updated = 0

  try {
    // 获取所有 per_charge 记录用于匹配
    const chargeMap = await getChargeMap()

    for (const record of data) {
      // 检查是否存在该SKU（使用事务连接）
      const [existingRows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT id, charge, sale_day FROM inventory WHERE ware_sku = ?',
        [record.ware_sku]
      )
      const existing = existingRows as { id: number; charge: string | null; sale_day: number | null }[]

      // 检查该SKU是否在task表中（用于检测任务完成，使用事务连接）
      const [taskRows] = await connection.execute<mysql.RowDataPacket[]>(
        'SELECT ware_sku, sale_day, charge, promised_land, inventory_num, sales_num, label FROM task WHERE ware_sku = ?',
        [record.ware_sku]
      )
      const existingTask = taskRows as {
        ware_sku: string
        sale_day: number | null
        charge: string | null
        promised_land: number
        inventory_num: number
        sales_num: number
        label: string | null
      }[]

      // 处理label字段：如果是数组，转换为JSON字符串；如果是字符串，直接使用；如果是undefined，设为null
      let labelValue: string | null = null
      if (record.label) {
        if (Array.isArray(record.label)) {
          labelValue = JSON.stringify(record.label)
        } else if (typeof record.label === 'string') {
          labelValue = record.label
        }
      }

      // 检测任务完成：如果旧sale_day >= 15 且 新sale_day < 15 且 该SKU在task表中
      const oldSaleDay = existingTask.length > 0 ? existingTask[0].sale_day : null
      const newSaleDay = record.sale_day ?? null
      
      if (existingTask.length > 0 && oldSaleDay !== null && oldSaleDay >= 15 && newSaleDay !== null && newSaleDay < 15) {
        // 任务完成，保存到历史表
        const taskRecord = existingTask[0]
        let taskLabelValue: string | null = null
        if (taskRecord.label) {
          if (Array.isArray(taskRecord.label)) {
            taskLabelValue = JSON.stringify(taskRecord.label)
          } else if (typeof taskRecord.label === 'string') {
            taskLabelValue = taskRecord.label
          }
        }
        
        // 使用事务连接执行插入历史记录
        await connection.execute(
          `INSERT INTO task_history (
            ware_sku, completed_sale_day, charge, promised_land,
            inventory_num, sales_num, label, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            taskRecord.ware_sku,
            newSaleDay, // 完成时的可售天数（新的值）
            taskRecord.charge ?? null,
            taskRecord.promised_land ?? 0,
            taskRecord.inventory_num ?? 0,
            taskRecord.sales_num ?? 0,
            taskLabelValue,
          ]
        )
        
        // 从task表中删除已完成的任务（使用事务连接）
        await connection.execute('DELETE FROM task WHERE ware_sku = ?', [record.ware_sku])
      }

      if (existing.length > 0) {
        // 更新已存在的记录
        // 根据导入的库存数量、最近七天销量，重新进行可售天数和标签的写入
        // charge字段保持不变（如果已存在），否则根据匹配规则设置
        let charge: string | null = existing[0].charge
        if (!charge) {
          // 如果原有记录没有charge，从chargeMap中查找匹配的charge
          charge = record.charge || findChargeBySku(record.ware_sku, chargeMap) || null
        }
        
        // 使用事务连接执行更新
        await connection.execute(
          'UPDATE inventory SET inventory_num = ?, sales_num = ?, sale_day = ?, charge = ?, label = ?, updated_at = NOW() WHERE ware_sku = ?',
          [
            record.inventory_num,
            record.sales_num,
            record.sale_day ?? null,
            charge,
            labelValue,
            record.ware_sku,
          ]
        )
        updated++
      } else {
        // 插入新记录
        // 如果record中没有charge值，从chargeMap中查找匹配的charge
        // 匹配规则：ware_sku 包含 per_charge.sku
        const charge = record.charge || findChargeBySku(record.ware_sku, chargeMap) || null
        
        // 使用事务连接执行插入
        await connection.execute(
          'INSERT INTO inventory (ware_sku, inventory_num, sales_num, sale_day, charge, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
          [
            record.ware_sku,
            record.inventory_num,
            record.sales_num,
            record.sale_day ?? null,
            charge,
            labelValue,
          ]
        )
        inserted++
      }
    }

    await connection.commit()
    
    // 导入完成后，同步数据到 task 表（label包含2或4的记录）
    await syncInventoryToTask()
    
    return {
      success: true,
      inserted,
      updated,
    }
  } catch (error: any) {
    await connection.rollback()
    console.error('导入库存数据失败:', error)
    return {
      success: false,
      inserted,
      updated,
      error: error.message || '导入失败',
    }
  } finally {
    connection.release()
  }
}

/**
 * 更新 task 表中所有记录的 count_down 字段
 * 根据 promised_land 的值使用不同的计算逻辑：
 * - promised_land = 0 时：count_down = 1 - DATEDIFF(NOW(), created_at)
 * - promised_land != 0 时：count_down = 7 - DATEDIFF(NOW(), created_at)
 */
export async function updateTaskCountDown(): Promise<{ success: boolean; error?: string }> {
  const connection = await getConnection()
  await connection.beginTransaction()

  try {
    // 使用 SQL 的 CASE WHEN 根据 promised_land 的值选择不同的计算方式
    await execute(
      `UPDATE task SET count_down = CASE 
        WHEN promised_land = 0 THEN 1 - DATEDIFF(NOW(), created_at)
        ELSE 7 - DATEDIFF(NOW(), created_at)
      END
      WHERE created_at IS NOT NULL`
    )

    await connection.commit()
    return { success: true }
  } catch (error: any) {
    await connection.rollback()
    console.error('更新 count_down 失败:', error)
    return {
      success: false,
      error: error.message || '更新失败',
    }
  } finally {
    connection.release()
  }
}

/**
 * 同步 inventory 表的数据到 task 表
 * 只同步符合以下条件的记录：
 * - label 包含 4（在售天数预警）
 * - 或者 label 包含 2 但不包含 1（有库存无销量）
 */
export async function syncInventoryToTask(): Promise<{ success: boolean; error?: string }> {
  const connection = await getConnection()
  await connection.beginTransaction()

  try {
    // 1. 先清空 task 表
    await execute('DELETE FROM task')

    // 2. 从 inventory 表查询符合条件的记录
    // 条件：label 包含 4（在售天数预警）或者 (label 包含 2 但不包含 1 且不包含 5)（有库存无销量）
    // 使用 JSON_CONTAINS 或 JSON_SEARCH 来查询 JSON 字段
    const sql = `
      SELECT id, ware_sku, inventory_num, sales_num, sale_day, charge, label, created_at, updated_at
      FROM inventory
      WHERE (JSON_CONTAINS(label, CAST('4' AS JSON)) OR JSON_SEARCH(label, 'one', '4') IS NOT NULL)
         OR ((JSON_CONTAINS(label, CAST('2' AS JSON)) OR JSON_SEARCH(label, 'one', '2') IS NOT NULL)
             AND (NOT JSON_CONTAINS(label, CAST('1' AS JSON)) AND JSON_SEARCH(label, 'one', '1') IS NULL)
             AND (NOT JSON_CONTAINS(label, CAST('5' AS JSON)) AND JSON_SEARCH(label, 'one', '5') IS NULL))
    `
    
    const results = await query<any>(sql)

    // 3. 将查询结果插入到 task 表
    for (const record of results) {
      // 处理 label 字段
      let labelValue: string | null = null
      if (record.label) {
        if (Array.isArray(record.label)) {
          labelValue = JSON.stringify(record.label)
        } else if (typeof record.label === 'string') {
          labelValue = record.label
        }
      }

      // 使用 INSERT ... ON DUPLICATE KEY UPDATE 来处理唯一键冲突
      // count_down 会在查询时通过 DATEDIFF 计算，这里不需要设置
      await execute(
        `INSERT INTO task (ware_sku, inventory_num, sales_num, sale_day, charge, label, promised_land, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         inventory_num = VALUES(inventory_num),
         sales_num = VALUES(sales_num),
         sale_day = VALUES(sale_day),
         charge = VALUES(charge),
         label = VALUES(label),
         promised_land = VALUES(promised_land),
         updated_at = VALUES(updated_at)`,
        [
          record.ware_sku,
          record.inventory_num,
          record.sales_num,
          record.sale_day ?? null,
          record.charge ?? null,
          labelValue,
          record.promised_land ?? 0, // Default to 0 if null/undefined
          record.created_at || new Date(),
          record.updated_at || new Date(),
        ]
      )
    }

    await connection.commit()
    return { success: true }
  } catch (error: any) {
    await connection.rollback()
    console.error('同步数据到 task 表失败:', error)
    
    // 如果 JSON 函数不支持，使用备用方法
    try {
      // 重新开始事务
      await connection.beginTransaction()
      await execute('DELETE FROM task')
      
      // 获取所有 inventory 记录，在前端筛选
      const allRecords = await query<any>('SELECT * FROM inventory')
      
      for (const record of allRecords) {
        let labels: number[] = []
        if (record.label) {
          try {
            labels = typeof record.label === 'string' ? JSON.parse(record.label) : record.label
          } catch (e) {
            // 忽略解析错误
          }
        }
        
        // 检查 label 是否符合条件：
        // - label 包含 4（在售天数预警）
        // - 或者 label 包含 2 但不包含 1 且不包含 5（有库存无销量）
        const isOver15Days = labels.includes(4)
        const hasInventoryNoSales = labels.includes(2) && !labels.includes(1) && !labels.includes(5)
        
        if (Array.isArray(labels) && (isOver15Days || hasInventoryNoSales)) {
          let labelValue: string | null = null
          if (Array.isArray(labels)) {
            labelValue = JSON.stringify(labels)
          } else if (typeof record.label === 'string') {
            labelValue = record.label
          }
          
          await execute(
            `INSERT INTO task (ware_sku, inventory_num, sales_num, sale_day, charge, label, promised_land, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             inventory_num = VALUES(inventory_num),
             sales_num = VALUES(sales_num),
             sale_day = VALUES(sale_day),
             charge = VALUES(charge),
             label = VALUES(label),
             promised_land = VALUES(promised_land),
             updated_at = VALUES(updated_at)`,
            [
              record.ware_sku,
              record.inventory_num,
              record.sales_num,
              record.sale_day ?? null,
              record.charge ?? null,
              labelValue,
              record.promised_land ?? 0,
              record.created_at || new Date(),
              record.updated_at || new Date(),
            ]
          )
        }
      }
      
      await connection.commit()
      return { success: true }
    } catch (fallbackError: any) {
      await connection.rollback()
      return {
        success: false,
        error: fallbackError.message || '同步失败',
      }
    }
  } finally {
    connection.release()
  }
}

/**
 * 获取库存统计数据
 * 统计不同label的数量
 * @returns 统计数据
 */
export async function getInventoryStatistics(): Promise<{
  normal_sales: number // label不包含1、2、4、5的数量（正常销售）
  over_15_days: number // label包含4的数量（在售天数超15天）
  no_sales: number // label包含2的数量（无销量）
  negative_inventory: number // label包含5的数量（库存待冲平）
  has_inventory_no_sales: number // label包含2但不包含1的数量（有库存无销量）
}> {
  try {
    // 统计label包含4的数量（在售天数超15天）
    const over15DaysResult = await query<{ count: string | number }>(
      "SELECT COUNT(*) as count FROM inventory WHERE JSON_CONTAINS(label, '4') OR JSON_SEARCH(label, 'one', '4') IS NOT NULL"
    )
    const over_15_days = Number(over15DaysResult[0]?.count) || 0

    // 统计label包含2的数量（无销量）
    const noSalesResult = await query<{ count: string | number }>(
      "SELECT COUNT(*) as count FROM inventory WHERE JSON_CONTAINS(label, '2') OR JSON_SEARCH(label, 'one', '2') IS NOT NULL"
    )
    const no_sales = Number(noSalesResult[0]?.count) || 0

    // 统计label包含5的数量（库存待冲平）
    const negativeInventoryResult = await query<{ count: string | number }>(
      "SELECT COUNT(*) as count FROM inventory WHERE JSON_CONTAINS(label, '5') OR JSON_SEARCH(label, 'one', '5') IS NOT NULL"
    )
    const negative_inventory = Number(negativeInventoryResult[0]?.count) || 0

    // 统计label包含2但不包含1且不包含5的数量（有库存无销量）
    const hasInventoryNoSalesResult = await query<{ count: string | number }>(
      "SELECT COUNT(*) as count FROM inventory WHERE (JSON_CONTAINS(label, '2') OR JSON_SEARCH(label, 'one', '2') IS NOT NULL) AND (NOT JSON_CONTAINS(label, '1') AND JSON_SEARCH(label, 'one', '1') IS NULL) AND (NOT JSON_CONTAINS(label, '5') AND JSON_SEARCH(label, 'one', '5') IS NULL)"
    )
    const has_inventory_no_sales = Number(hasInventoryNoSalesResult[0]?.count) || 0

    // 统计label不包含1、2、4、5的数量（正常销售）
    const normalSalesResult = await query<{ count: string | number }>(
      "SELECT COUNT(*) as count FROM inventory WHERE (label IS NULL OR label = '[]' OR (NOT JSON_CONTAINS(label, '1') AND JSON_SEARCH(label, 'one', '1') IS NULL) AND (NOT JSON_CONTAINS(label, '2') AND JSON_SEARCH(label, 'one', '2') IS NULL) AND (NOT JSON_CONTAINS(label, '4') AND JSON_SEARCH(label, 'one', '4') IS NULL) AND (NOT JSON_CONTAINS(label, '5') AND JSON_SEARCH(label, 'one', '5') IS NULL))"
    )
    const normal_sales = Number(normalSalesResult[0]?.count) || 0

    return {
      normal_sales,
      over_15_days,
      no_sales,
      negative_inventory,
      has_inventory_no_sales,
    }
  } catch (error) {
    console.error('获取库存统计数据失败:', error)
    // 如果JSON函数不支持，使用备用方法
    try {
      const allData = await query<any>('SELECT label FROM inventory')
      let normal_sales = 0
      let over_15_days = 0
      let no_sales = 0
      let negative_inventory = 0
      let has_inventory_no_sales = 0

      allData.forEach((row: any) => {
        let labels: number[] = []
        if (row.label) {
          try {
            labels = typeof row.label === 'string' ? JSON.parse(row.label) : row.label
          } catch (e) {
            // 忽略解析错误
          }
        }

        if (Array.isArray(labels)) {
          // label不包含1、2、4、5（正常销售）
          if (!labels.includes(1) && !labels.includes(2) && !labels.includes(4) && !labels.includes(5)) {
            normal_sales++
          }
          if (labels.includes(4)) over_15_days++
          if (labels.includes(2)) no_sales++
          if (labels.includes(5)) negative_inventory++
          // label包含2但不包含1且不包含5（有库存无销量）
          if (labels.includes(2) && !labels.includes(1) && !labels.includes(5)) {
            has_inventory_no_sales++
          }
        } else {
          // 如果label为空或不是数组，也算作正常销售
          normal_sales++
        }
      })

      return { normal_sales, over_15_days, no_sales, negative_inventory, has_inventory_no_sales }
    } catch (fallbackError) {
      console.error('备用统计方法失败:', fallbackError)
      return { normal_sales: 0, over_15_days: 0, no_sales: 0, negative_inventory: 0, has_inventory_no_sales: 0 }
    }
  }
}

/**
 * 获取所有库存数据
 * @param searchSku 搜索SKU（可选）
 * @param labelFilter 标签筛选（可选）：'normal'=正常销售，4=在售天数超15天，2=无销量，5=库存待冲平，'2_not_1'=有库存无销量
 * @returns 库存数据数组
 */
export async function getInventoryData(
  searchSku?: string,
  labelFilter?: 'normal' | 4 | 2 | 5 | '2_not_1'
): Promise<InventoryRecord[]> {
  try {
    let sql =
      'SELECT id, ware_sku, inventory_num, sales_num, sale_day, charge, label, created_at, updated_at FROM inventory WHERE 1=1'
    const params: any[] = []

    if (searchSku) {
      sql += ' AND ware_sku LIKE ?'
      params.push(`%${searchSku}%`)
    }

    // 根据label筛选
    if (labelFilter !== undefined) {
      if (labelFilter === 'normal') {
        // 正常销售：label不包含1、2、4、5
        sql += ` AND (label IS NULL OR label = '[]' OR ((NOT JSON_CONTAINS(label, '1') AND JSON_SEARCH(label, 'one', '1') IS NULL) AND (NOT JSON_CONTAINS(label, '2') AND JSON_SEARCH(label, 'one', '2') IS NULL) AND (NOT JSON_CONTAINS(label, '4') AND JSON_SEARCH(label, 'one', '4') IS NULL) AND (NOT JSON_CONTAINS(label, '5') AND JSON_SEARCH(label, 'one', '5') IS NULL)))`
      } else if (labelFilter === '2_not_1') {
        // 特殊筛选：label包含2但不包含1且不包含5（有库存无销量）
        sql += ` AND (JSON_CONTAINS(label, '2') OR JSON_SEARCH(label, 'one', '2') IS NOT NULL) AND (NOT JSON_CONTAINS(label, '1') AND JSON_SEARCH(label, 'one', '1') IS NULL) AND (NOT JSON_CONTAINS(label, '5') AND JSON_SEARCH(label, 'one', '5') IS NULL)`
      } else {
        // 普通筛选：label包含指定值
        sql += ` AND (JSON_CONTAINS(label, '${labelFilter}') OR JSON_SEARCH(label, 'one', '${labelFilter}') IS NOT NULL)`
      }
    }

    sql += ' ORDER BY updated_at DESC, id DESC'

    const results = await query<any>(sql, params)

    // 将label字段从JSON字符串转换为数组
    const parsedResults = results.map((row: any) => {
      if (row.label) {
        try {
          row.label = typeof row.label === 'string' ? JSON.parse(row.label) : row.label
        } catch (e) {
          // 如果解析失败，保持原值
          console.warn('解析label字段失败:', row.label)
        }
      }
      return row as InventoryRecord
    })

    // 如果数据库不支持JSON函数，在前端筛选
    if (labelFilter !== undefined) {
      return parsedResults.filter((row) => {
        const labels = Array.isArray(row.label) ? row.label : []
        if (labelFilter === 'normal') {
          // 正常销售：label不包含1、2、4、5，或者label为空
          return !labels.includes(1) && !labels.includes(2) && !labels.includes(4) && !labels.includes(5)
        } else if (labelFilter === '2_not_1') {
          // label包含2但不包含1且不包含5（有库存无销量）
          return labels.includes(2) && !labels.includes(1) && !labels.includes(5)
        } else {
          return labels.includes(labelFilter)
        }
      })
    }

    return parsedResults
  } catch (error) {
    console.error('获取库存数据失败:', error)
    throw error
  }
}

/**
 * 获取所有任务数据（从 task 表）
 * @param searchSku 搜索SKU（可选）
 * @param labelFilter 标签筛选（可选）：'over_15_days'=在售天数超15天，'has_inventory_no_sales'=有库存无销量
 * @param statusFilter 状态筛选（可选）：'no_solution'=未选择方案，'in_progress'=任务正在进行中，'timeout'=超时任务（count_down < 0）
 * @param chargeFilter 负责人筛选（可选）
 * @returns 任务数据数组
 */
export async function getTaskData(
  searchSku?: string,
  labelFilter?: 'over_15_days' | 'has_inventory_no_sales',
  statusFilter?: 'no_solution' | 'in_progress' | 'timeout',
  chargeFilter?: string
): Promise<InventoryRecord[]> {
  try {
    // 先更新所有记录的 count_down（根据 promised_land 使用不同计算逻辑）
    await updateTaskCountDown()
    // 使用 CASE WHEN 根据 promised_land 的值计算 count_down
    // promised_land = 0 时：1 - DATEDIFF(NOW(), created_at)
    // promised_land != 0 时：7 - DATEDIFF(NOW(), created_at)
    let sql =
      'SELECT id, ware_sku, inventory_num, sales_num, sale_day, charge, label, promised_land, CASE WHEN promised_land = 0 THEN 1 - DATEDIFF(NOW(), created_at) ELSE 7 - DATEDIFF(NOW(), created_at) END as count_down, created_at, updated_at FROM task WHERE 1=1'
    const params: any[] = []

    if (searchSku) {
      sql += ' AND ware_sku LIKE ?'
      params.push(`%${searchSku}%`)
    }

    // 标签筛选（前两个）
    if (labelFilter === 'over_15_days') {
      // 在售天数超15天：label 包含 4
      sql += ` AND (JSON_CONTAINS(label, CAST('4' AS JSON)) OR JSON_SEARCH(label, 'one', '4') IS NOT NULL)`
    } else if (labelFilter === 'has_inventory_no_sales') {
      // 有库存无销量：label 包含 2 但不包含 1 且不包含 5
      sql += ` AND (JSON_CONTAINS(label, CAST('2' AS JSON)) OR JSON_SEARCH(label, 'one', '2') IS NOT NULL)`
      sql += ` AND (NOT JSON_CONTAINS(label, CAST('1' AS JSON)) AND JSON_SEARCH(label, 'one', '1') IS NULL)`
      sql += ` AND (NOT JSON_CONTAINS(label, CAST('5' AS JSON)) AND JSON_SEARCH(label, 'one', '5') IS NULL)`
    }

    // 状态筛选（后三个）
    if (statusFilter === 'no_solution') {
      // 未选择方案：promised_land = 0
      sql += ' AND promised_land = 0'
    } else if (statusFilter === 'in_progress') {
      // 任务正在进行中：promised_land = 1 或 2 或 3
      sql += ' AND promised_land IN (1, 2, 3)'
    } else if (statusFilter === 'timeout') {
      // 超时任务：count_down < 0
      sql += ' AND (CASE WHEN promised_land = 0 THEN 1 - DATEDIFF(NOW(), created_at) ELSE 7 - DATEDIFF(NOW(), created_at) END) < 0'
    }

    // 负责人筛选
    if (chargeFilter) {
      sql += ' AND charge = ?'
      params.push(chargeFilter)
    }

    sql += ' ORDER BY updated_at DESC, id DESC'

    const results = await query<any>(sql, params)

    // 将label字段从JSON字符串转换为数组，解析count_down字段
    const parsedResults = results.map((row: any) => {
      if (row.label) {
        try {
          row.label = typeof row.label === 'string' ? JSON.parse(row.label) : row.label
        } catch (e) {
          // 如果解析失败，保持原值
          console.warn('解析label字段失败:', row.label)
        }
      }
      // count_down 字段是 created_at 到现在的天数差（由 SQL DATEDIFF 计算）
      // 确保 count_down 有默认值 0（如果 created_at 为空）
      if (row.count_down === null || row.count_down === undefined) {
        row.count_down = 0
      }
      // 确保 promised_land 有默认值
      if (row.promised_land === null || row.promised_land === undefined) {
        row.promised_land = 0
      }
      return row as InventoryRecord
    })

    // 如果数据库不支持JSON函数，在前端筛选
    let filteredResults = parsedResults
    if (labelFilter === 'over_15_days' || labelFilter === 'has_inventory_no_sales') {
      filteredResults = filteredResults.filter((row) => {
        const labels = Array.isArray(row.label) ? row.label : []
        if (labelFilter === 'over_15_days') {
          return labels.includes(4)
        } else if (labelFilter === 'has_inventory_no_sales') {
          return labels.includes(2) && !labels.includes(1) && !labels.includes(5)
        }
        return true
      })
    }

    // 在前端也应用负责人筛选（作为备用，如果数据库筛选失败）
    if (chargeFilter) {
      filteredResults = filteredResults.filter((row) => row.charge === chargeFilter)
    }

    return filteredResults
  } catch (error) {
    console.error('获取任务数据失败:', error)
    throw error
  }
}

/**
 * 获取任务统计数据
 * @param chargeFilter 负责人筛选（可选）
 * @returns 统计数据
 */
export async function getTaskStatistics(chargeFilter?: string): Promise<{
  over_15_days: number // label包含4的数量（在售天数超15天）
  has_inventory_no_sales: number // label包含2但不包含1且不包含5的数量（有库存无销量）
  no_solution: number // promised_land = 0的数量（未选择方案）
  in_progress: number // promised_land IN (1,2,3)的数量（任务正在进行中）
  timeout: number // 全量数据（超时任务）
}> {
  try {
    // 统计label包含4的数量（在售天数超15天）
    let over15DaysSql = "SELECT COUNT(*) as count FROM task WHERE (JSON_CONTAINS(label, CAST('4' AS JSON)) OR JSON_SEARCH(label, 'one', '4') IS NOT NULL)"
    const over15DaysParams: any[] = []
    if (chargeFilter) {
      over15DaysSql += ' AND charge = ?'
      over15DaysParams.push(chargeFilter)
    }
    const over15DaysResult = await query<{ count: string | number }>(over15DaysSql, over15DaysParams)
    const over_15_days = Number(over15DaysResult[0]?.count) || 0

    // 统计label包含2但不包含1且不包含5的数量（有库存无销量）
    let hasInventoryNoSalesSql = "SELECT COUNT(*) as count FROM task WHERE (JSON_CONTAINS(label, CAST('2' AS JSON)) OR JSON_SEARCH(label, 'one', '2') IS NOT NULL) AND (NOT JSON_CONTAINS(label, CAST('1' AS JSON)) AND JSON_SEARCH(label, 'one', '1') IS NULL) AND (NOT JSON_CONTAINS(label, CAST('5' AS JSON)) AND JSON_SEARCH(label, 'one', '5') IS NULL)"
    const hasInventoryNoSalesParams: any[] = []
    if (chargeFilter) {
      hasInventoryNoSalesSql += ' AND charge = ?'
      hasInventoryNoSalesParams.push(chargeFilter)
    }
    const hasInventoryNoSalesResult = await query<{ count: string | number }>(hasInventoryNoSalesSql, hasInventoryNoSalesParams)
    const has_inventory_no_sales = Number(hasInventoryNoSalesResult[0]?.count) || 0

    // 统计promised_land = 0的数量（未选择方案）
    let noSolutionSql = 'SELECT COUNT(*) as count FROM task WHERE promised_land = 0'
    const noSolutionParams: any[] = []
    if (chargeFilter) {
      noSolutionSql += ' AND charge = ?'
      noSolutionParams.push(chargeFilter)
    }
    const noSolutionResult = await query<{ count: string | number }>(noSolutionSql, noSolutionParams)
    const no_solution = Number(noSolutionResult[0]?.count) || 0

    // 统计promised_land IN (1,2,3)的数量（任务正在进行中）
    let inProgressSql = 'SELECT COUNT(*) as count FROM task WHERE promised_land IN (1, 2, 3)'
    const inProgressParams: any[] = []
    if (chargeFilter) {
      inProgressSql += ' AND charge = ?'
      inProgressParams.push(chargeFilter)
    }
    const inProgressResult = await query<{ count: string | number }>(inProgressSql, inProgressParams)
    const in_progress = Number(inProgressResult[0]?.count) || 0

    // 统计 count_down < 0 的数量（超时任务）
    let timeoutSql = 'SELECT COUNT(*) as count FROM task WHERE (CASE WHEN promised_land = 0 THEN 1 - DATEDIFF(NOW(), created_at) ELSE 7 - DATEDIFF(NOW(), created_at) END) < 0'
    const timeoutParams: any[] = []
    if (chargeFilter) {
      timeoutSql += ' AND charge = ?'
      timeoutParams.push(chargeFilter)
    }
    const timeoutResult = await query<{ count: string | number }>(timeoutSql, timeoutParams)
    const timeout = Number(timeoutResult[0]?.count) || 0

    return {
      over_15_days,
      has_inventory_no_sales,
      no_solution,
      in_progress,
      timeout,
    }
  } catch (error) {
    console.error('获取任务统计数据失败:', error)
    // 如果JSON函数不支持，使用备用方法
    try {
      let allDataSql = 'SELECT label, promised_land FROM task'
      const allDataParams: any[] = []
      if (chargeFilter) {
        allDataSql += ' WHERE charge = ?'
        allDataParams.push(chargeFilter)
      }
      const allData = await query<any>(allDataSql, allDataParams)
      let over_15_days = 0
      let has_inventory_no_sales = 0
      let no_solution = 0
      let in_progress = 0

      allData.forEach((row: any) => {
        let labels: number[] = []
        if (row.label) {
          try {
            labels = typeof row.label === 'string' ? JSON.parse(row.label) : row.label
          } catch (e) {
            // 忽略解析错误
          }
        }

        if (Array.isArray(labels)) {
          if (labels.includes(4)) over_15_days++
          if (labels.includes(2) && !labels.includes(1) && !labels.includes(5)) {
            has_inventory_no_sales++
          }
        }

        const promisedLand = row.promised_land ?? 0
        if (promisedLand === 0) {
          no_solution++
        } else if (promisedLand === 1 || promisedLand === 2 || promisedLand === 3) {
          in_progress++
        }
      })

      return {
        over_15_days,
        has_inventory_no_sales,
        no_solution,
        in_progress,
        // 统计 count_down < 0 的数量（超时任务）
        timeout: allData.filter((row: any) => {
          if (!row.created_at) return false
          const daysDiff = Math.floor((new Date().getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24))
          const countDown = (row.promised_land ?? 0) === 0 ? 1 - daysDiff : 7 - daysDiff
          return countDown < 0
        }).length,
      }
    } catch (fallbackError) {
      console.error('备用统计方法失败:', fallbackError)
      return { over_15_days: 0, has_inventory_no_sales: 0, no_solution: 0, in_progress: 0, timeout: 0 }
    }
  }
}

/**
 * 获取所有负责人列表（从 task 表）
 * @returns 负责人列表（去重）
 */
export async function getTaskChargeList(): Promise<string[]> {
  try {
    const sql = 'SELECT DISTINCT charge FROM task WHERE charge IS NOT NULL AND charge != "" ORDER BY charge'
    const results = await query<{ charge: string }>(sql)
    return results.map((row) => row.charge).filter((charge) => charge && charge.trim() !== '')
  } catch (error) {
    console.error('获取负责人列表失败:', error)
    return []
  }
}

/**
 * 历史任务记录接口
 */
export interface TaskHistoryRecord {
  id: number
  ware_sku: string
  completed_sale_day: number | null
  charge: string | null
  promised_land: number
  completed_at: string
  inventory_num: number
  sales_num: number
  label: number[] | string | null
}

/**
 * 获取历史任务数据
 * @param searchSku 搜索SKU（可选）
 * @param chargeFilter 负责人筛选（可选）
 * @param promisedLandFilter 方案筛选（可选）：0=未选择，1=退回厂家，2=降价清仓，3=打处理
 * @param dateFrom 开始日期（可选）
 * @param dateTo 结束日期（可选）
 * @returns 历史任务数据
 */
export async function getTaskHistoryData(
  searchSku?: string,
  chargeFilter?: string,
  promisedLandFilter?: number,
  dateFrom?: string,
  dateTo?: string
): Promise<TaskHistoryRecord[]> {
  try {
    let sql = 'SELECT id, ware_sku, completed_sale_day, charge, promised_land, completed_at, inventory_num, sales_num, label FROM task_history WHERE 1=1'
    const params: any[] = []

    if (searchSku) {
      sql += ' AND ware_sku LIKE ?'
      params.push(`%${searchSku}%`)
    }

    if (chargeFilter) {
      sql += ' AND charge = ?'
      params.push(chargeFilter)
    }

    if (promisedLandFilter !== undefined) {
      sql += ' AND promised_land = ?'
      params.push(promisedLandFilter)
    }

    if (dateFrom) {
      sql += ' AND completed_at >= ?'
      params.push(dateFrom)
    }

    if (dateTo) {
      sql += ' AND completed_at <= ?'
      params.push(`${dateTo} 23:59:59`)
    }

    sql += ' ORDER BY completed_at DESC'

    const results = await query<any>(sql, params)

    // 处理label字段：从JSON字符串转换为数组
    return results.map((row: any) => {
      let label: number[] | string | null = null
      if (row.label) {
        try {
          if (typeof row.label === 'string') {
            label = JSON.parse(row.label)
          } else if (Array.isArray(row.label)) {
            label = row.label
          }
        } catch (e) {
          // 解析失败，保持原值
          label = row.label
        }
      }

      return {
        id: row.id,
        ware_sku: row.ware_sku,
        completed_sale_day: row.completed_sale_day,
        charge: row.charge,
        promised_land: row.promised_land ?? 0,
        completed_at: row.completed_at,
        inventory_num: row.inventory_num ?? 0,
        sales_num: row.sales_num ?? 0,
        label,
      }
    })
  } catch (error: any) {
    console.error('获取历史任务数据失败:', error)
    throw error
  }
}

/**
 * 获取历史任务统计数据
 * @returns 统计数据
 */
export interface TaskHistoryStatistics {
  total: number // 总完成数
  this_week: number // 本周完成数
  promised_land_1: number // 退回厂家完成数
  promised_land_2: number // 降价清仓完成数
  promised_land_3: number // 打处理完成数
}

export async function getTaskHistoryStatistics(): Promise<TaskHistoryStatistics> {
  try {
    // 总完成数
    const totalResult = await query<{ count: string | number }>('SELECT COUNT(*) as count FROM task_history')
    const total = Number(totalResult[0]?.count) || 0

    // 本周完成数（从本周一开始）
    const today = new Date()
    const dayOfWeek = today.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(today)
    monday.setDate(today.getDate() - daysToMonday)
    monday.setHours(0, 0, 0, 0)
    const mondayStr = monday.toISOString().slice(0, 19).replace('T', ' ')

    const thisWeekResult = await query<{ count: string | number }>(
      'SELECT COUNT(*) as count FROM task_history WHERE completed_at >= ?',
      [mondayStr]
    )
    const this_week = Number(thisWeekResult[0]?.count) || 0

    // 各方案完成数
    const promisedLand1Result = await query<{ count: string | number }>(
      'SELECT COUNT(*) as count FROM task_history WHERE promised_land = 1'
    )
    const promised_land_1 = Number(promisedLand1Result[0]?.count) || 0

    const promisedLand2Result = await query<{ count: string | number }>(
      'SELECT COUNT(*) as count FROM task_history WHERE promised_land = 2'
    )
    const promised_land_2 = Number(promisedLand2Result[0]?.count) || 0

    const promisedLand3Result = await query<{ count: string | number }>(
      'SELECT COUNT(*) as count FROM task_history WHERE promised_land = 3'
    )
    const promised_land_3 = Number(promisedLand3Result[0]?.count) || 0

    return {
      total,
      this_week,
      promised_land_1,
      promised_land_2,
      promised_land_3,
    }
  } catch (error: any) {
    console.error('获取历史任务统计数据失败:', error)
    return {
      total: 0,
      this_week: 0,
      promised_land_1: 0,
      promised_land_2: 0,
      promised_land_3: 0,
    }
  }
}

/**
 * 获取历史任务的所有负责人列表（去重）
 * @returns 负责人列表
 */
export async function getTaskHistoryChargeList(): Promise<string[]> {
  try {
    const sql = 'SELECT DISTINCT charge FROM task_history WHERE charge IS NOT NULL AND charge != "" ORDER BY charge'
    const results = await query<{ charge: string }>(sql)
    return results.map((row) => row.charge).filter((charge) => charge && charge.trim() !== '')
  } catch (error) {
    console.error('获取历史任务负责人列表失败:', error)
    return []
  }
}

/**
 * 更新任务表的方案选择
 * @param wareSku SKU货号
 * @param promisedLand 方案选择：0=未选择，1=退回厂家，2=降价清仓，3=打处理
 * @returns 更新结果
 */
export async function updateTaskPromisedLand(
  wareSku: string,
  promisedLand: 0 | 1 | 2 | 3
): Promise<{ success: boolean; error?: string }> {
  try {
    // 更新 promised_land 时，同时更新 count_down（根据新的 promised_land 值计算）
    await execute(
      `UPDATE task SET 
        promised_land = ?, 
        count_down = CASE 
          WHEN ? = 0 THEN 1 - DATEDIFF(NOW(), created_at)
          ELSE 7 - DATEDIFF(NOW(), created_at)
        END,
        updated_at = NOW() 
       WHERE ware_sku = ?`,
      [promisedLand, promisedLand, wareSku]
    )
    return { success: true }
  } catch (error: any) {
    console.error('更新任务方案失败:', error)
    return {
      success: false,
      error: error.message || '更新方案失败',
    }
  }
}

