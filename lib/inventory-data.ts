/**
 * 库存数据服务
 * 处理库存数据的数据库操作
 */
import { query, execute, getConnection } from '@/lib/db'
import { PoolClient } from 'pg'

/**
 * 处理 label 字段，确保 PostgreSQL 兼容性
 * 将空字符串、无效 JSON 等转换为 null
 * @param label label 值（可能是数组、字符串或 null/undefined）
 * @returns 处理后的 JSON 字符串或 null
 */
function processLabelField(label: number[] | string | null | undefined): string | null {
  if (!label) {
    return null
  }
  
  if (Array.isArray(label)) {
    // 空数组也转换为 JSON 字符串 '[]'
    return JSON.stringify(label)
  }
  
  if (typeof label === 'string') {
    const trimmed = label.trim()
    // 空字符串或 'null' 字符串，设为 null
    if (trimmed === '' || trimmed === 'null') {
      return null
    }
    
    // 验证是否为有效的 JSON
    try {
      JSON.parse(trimmed)
      return trimmed
    } catch (e) {
      // 无效的 JSON，设为 null
      return null
    }
  }
  
  return null
}

export interface InventoryRecord {
  id?: number
  ware_sku: string
  inventory_num: number
  sales_num: number
  sale_day?: number
  charge?: string
  label?: number[] | string // 标签列表，存储为数组或JSON字符串
  promised_land?: number // 方案选择：0=未选择，1=退回厂家，2=降价清仓，3=打处理
  promised_land_snapshot?: number // 方案快照（转入完成检查时保存）
  task_status?: number // 任务状态：0=未选择方案，1/2/3=任务正在进行中，4=完成检查，5=审核中
  count_down?: number // 倒计时数字，默认值为1
  image_urls?: string[] // 任务相关图片URL数组
  notes?: string | null // 任务备注
  reject_reason?: string | null // 打回理由
  price_reduction_failure_count?: number // 降价清仓失败次数：0=未失败，1=失败1次，2=失败2次，3=失败3次
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
  await connection.query('BEGIN')

  let inserted = 0
  let updated = 0

  try {
    // 获取所有 per_charge 记录用于匹配
    const chargeMap = await getChargeMap()

    for (const record of data) {
      // 检查该SKU是否在task表中（所有SKU都在task表中）
      const existingResult = await connection.query(
        'SELECT id, charge, sale_day, promised_land, task_status, inventory_num, sales_num, label FROM task WHERE ware_sku = $1',
        [record.ware_sku]
      )
      const existing = existingResult.rows as {
        id: number
        charge: string | null
        sale_day: number | null
        promised_land: number | null
        task_status: number | null
        inventory_num: number
        sales_num: number
        label: string | null
      }[]

      // 处理label字段：使用统一函数处理，确保 PostgreSQL 兼容性
      const labelValue = processLabelField(record.label)

      // 判断是否应该成为任务：label 包含 4 或 (label 包含 2 但不包含 1 且不包含 5)
      let labels: number[] = []
      if (record.label) {
        labels = Array.isArray(record.label) ? record.label : []
      }
      const isOver20Days = labels.includes(4)
      const hasInventoryNoSales = labels.includes(2) && !labels.includes(1) && !labels.includes(5)
      const shouldBeTask = isOver20Days || hasInventoryNoSales

      // 检测任务完成：普通商品和爆款降到15天以下时，自动进入完成检查
      const oldSaleDay = existing.length > 0 ? existing[0].sale_day : null
      const newSaleDay = record.sale_day ?? null
      
      if (existing.length > 0 && oldSaleDay !== null && newSaleDay !== null) {
        const existingRecord = existing[0]
        const taskStatus = existingRecord.task_status ?? null
        
        // 当任务在"任务正在进行中"（task_status = 1,2,3），且 sale_day 降到15天以下时，自动进入"完成检查"
        const threshold = 15 // 统一阈值：15天
        const shouldMoveToChecking = oldSaleDay > threshold && newSaleDay <= threshold && 
                                     taskStatus !== null && (taskStatus === 1 || taskStatus === 2 || taskStatus === 3)
        
        if (shouldMoveToChecking) {
          // 自动进入"完成检查"状态（task_status = 4）
          // 保存 promised_land_snapshot = promised_land
          // 设置 checked_at = CURRENT_TIMESTAMP
          await connection.query(
            `UPDATE task SET
              task_status = 4,
              promised_land_snapshot = $1,
              checked_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE ware_sku = $2`,
            [
              existingRecord.promised_land ?? 0,
              record.ware_sku
            ]
          )
        }
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

        // 判断任务状态：如果应该成为任务但还不是，设置为未选择方案
        // 如果已经是任务，保持原有状态（除非需要流转）
        const currentTaskStatus = existing[0].task_status
        const currentPromisedLand = existing[0].promised_land
        
        let newTaskStatus = currentTaskStatus
        let newPromisedLand = currentPromisedLand

        if (shouldBeTask) {
          // 应该成为任务
          if (currentTaskStatus === null && currentPromisedLand === null) {
            // 还不是任务，设置为未选择方案
            newTaskStatus = 0
            newPromisedLand = 0
          }
          // 如果已经是任务，保持原有状态
        } else {
          // 不应该成为任务
          // 如果当前是任务正在进行中（task_status = 1,2,3），流转到完成检查
          if (currentTaskStatus !== null && (currentTaskStatus === 1 || currentTaskStatus === 2 || currentTaskStatus === 3)) {
            newTaskStatus = 4
            newPromisedLand = currentPromisedLand ?? 0
            await connection.query(
              `UPDATE task SET
                task_status = 4,
                promised_land_snapshot = $1,
                checked_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
              WHERE ware_sku = $2`,
              [newPromisedLand, record.ware_sku]
            )
          } else if (currentTaskStatus === 0) {
            // 未选择方案，直接清空任务状态
            newTaskStatus = null
            newPromisedLand = null
          }
          // 如果已经是完成检查或审核中，保持状态不变
        }
        
        // 使用事务连接执行更新
        await connection.query(
          `UPDATE task SET 
            inventory_num = $1, 
            sales_num = $2, 
            sale_day = $3, 
            charge = $4, 
            label = $5,
            task_status = $6,
            promised_land = $7,
            updated_at = CURRENT_TIMESTAMP 
          WHERE ware_sku = $8`,
          [
            record.inventory_num,
            record.sales_num,
            record.sale_day ?? null,
            charge,
            labelValue,
            newTaskStatus,
            newPromisedLand,
            record.ware_sku,
          ]
        )
        updated++
      } else {
        // 插入新记录
        // 如果record中没有charge值，从chargeMap中查找匹配的charge
        // 匹配规则：ware_sku 包含 per_charge.sku
        const charge = record.charge || findChargeBySku(record.ware_sku, chargeMap) || null
        
        // 判断是否应该成为任务
        let taskStatus: number | null = null
        let promisedLand: number | null = null
        
        if (shouldBeTask) {
          taskStatus = 0 // 未选择方案
          promisedLand = 0
        }
        
        // 使用事务连接执行插入
        await connection.query(
          `INSERT INTO task (
            ware_sku, inventory_num, sales_num, sale_day, charge, label, 
            promised_land, task_status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            record.ware_sku,
            record.inventory_num,
            record.sales_num,
            record.sale_day ?? null,
            charge,
            labelValue,
            promisedLand,
            taskStatus,
          ]
        )
        inserted++
      }
    }

    await connection.query('COMMIT')
    
    return {
      success: true,
      inserted,
      updated,
    }
  } catch (error: any) {
    await connection.query('ROLLBACK')
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
 * 更新 task 表中所有记录的 count_down 字段（单位：小时）
 * 根据 promised_land 的值使用不同的计算逻辑：
 * - promised_land = 0 时：count_down = 24 - (当前时间 - created_at的小时差)
 * - promised_land != 0 时：count_down = 168 - (当前时间 - created_at的小时差) (7天 = 168小时)
 * 
 * 同时处理超时任务：如果 count_down < 0，自动转入未选择方案，并在历史任务中留下记录
 */
export async function updateTaskCountDown(): Promise<{ success: boolean; error?: string }> {
  const connection = await getConnection()
  await connection.query('BEGIN')

  try {
    // 1. 更新 count_down 字段（只更新任务记录）
    await connection.query(
      `UPDATE task SET count_down = CASE 
        WHEN promised_land = 0 OR promised_land IS NULL THEN 24 - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600
        ELSE 168 - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600
      END
      WHERE created_at IS NOT NULL AND (task_status IS NOT NULL OR promised_land IS NOT NULL)`
    )

    // 2. 处理超时任务（count_down < 0）
    // 获取所有超时的任务（只查询任务记录）
    const timeoutTasksResult = await connection.query(
      `SELECT ware_sku, sale_day, charge, promised_land, promised_land_snapshot,
              task_status, inventory_num, sales_num, label, notes
       FROM task
       WHERE (CASE 
         WHEN promised_land = 0 OR promised_land IS NULL THEN 24 - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600
         ELSE 168 - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600
       END) < 0
       AND task_status IN (1, 2, 3, 4, 5)
       AND (task_status IS NOT NULL OR promised_land IS NOT NULL)`
    )
    
    const timeoutTasks = timeoutTasksResult.rows
    
    // 3. 将超时任务保存到历史表
    for (const task of timeoutTasks) {
      const taskLabelValue = processLabelField(task.label)
      
      // 插入历史任务记录
      await connection.query(
        `INSERT INTO task_history (
          ware_sku, completed_sale_day, charge, promised_land,
          inventory_num, sales_num, label, completed_at,
          task_status_snapshot, review_status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, 'timeout', $9)`,
        [
          task.ware_sku,
          task.sale_day ?? null,
          task.charge ?? null,
          task.promised_land_snapshot ?? task.promised_land ?? 0,
          task.inventory_num ?? 0,
          task.sales_num ?? 0,
          taskLabelValue,
          task.task_status ?? 0,
          task.notes ?? null,
        ]
      )
    }
    
    // 4. 重置超时任务为未选择方案状态
    if (timeoutTasks.length > 0) {
      const timeoutSkus = timeoutTasks.map((t: any) => t.ware_sku)
      const placeholders = timeoutSkus.map((_, index) => `$${index + 1}`).join(',')
      
      await connection.query(
        `UPDATE task SET
          promised_land = 0,
          task_status = 0,
          promised_land_snapshot = NULL,
          checked_at = NULL,
          reviewed_at = NULL,
          review_status = NULL,
          reject_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE ware_sku IN (${placeholders})
        AND (task_status IS NOT NULL OR promised_land IS NOT NULL)`,
        timeoutSkus
      )
    }

    await connection.query('COMMIT')
    return { success: true }
  } catch (error: any) {
    await connection.query('ROLLBACK')
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
 * 已废弃：syncInventoryToTask 函数
 * 现在所有数据都在 task 表中，不再需要同步
 * 此函数保留仅为兼容性，实际不会被调用
 */
export async function syncInventoryToTask(): Promise<{ success: boolean; error?: string }> {
  // 已废弃，直接返回成功
  return { success: true }
  const connection = await getConnection()
  await connection.query('BEGIN')

  try {
    // 1. 从 inventory 表查询符合条件的记录
    // 条件：label 包含 4（在售天数预警）或者 (label 包含 2 但不包含 1 且不包含 5)（有库存无销量）
    // PostgreSQL: 使用 JSONB @> 操作符
    const sql = `
      SELECT id, ware_sku, inventory_num, sales_num, sale_day, charge, label
      FROM inventory
      WHERE (label::jsonb @> '[4]'::jsonb)
         OR ((label::jsonb @> '[2]'::jsonb)
             AND NOT (label::jsonb @> '[1]'::jsonb)
             AND NOT (label::jsonb @> '[5]'::jsonb))
    `
    
    const result = await connection.query(sql)
    const inventoryRecords = result.rows

    // 2. 获取所有现有任务（用于检查是否存在和状态）
    const existingTasksResult = await connection.query(
      'SELECT ware_sku, task_status, promised_land, promised_land_snapshot, created_at FROM task'
    )
    const existingTasksMap = new Map(
      existingTasksResult.rows.map((row: any) => [row.ware_sku, row])
    )

    // 3. 处理每个符合条件的 inventory 记录
    const validSkus: string[] = []
    
    for (const record of inventoryRecords) {
      validSkus.push(record.ware_sku)
      const labelValue = processLabelField(record.label)
      const existingTask = existingTasksMap.get(record.ware_sku)

      if (existingTask) {
        // 任务已存在，需要更新
        const taskStatus = existingTask.task_status ?? 0
        const promisedLandSnapshot = existingTask.promised_land_snapshot
        const originalPromisedLand = existingTask.promised_land ?? 0
        const currentSaleDay = record.sale_day ?? null

        // 情况1：任务在完成检查（task_status=4）或审核中（task_status=5）
        if (taskStatus === 4 || taskStatus === 5) {
          // 检查 sale_day 是否 <= 15（任务完成条件）
          // 如果 sale_day <= 15，说明任务已完成，应该保持在完成检查或审核中状态
          // 如果 sale_day > 15，说明任务重新出现，需要流回任务正在进行中
          if (currentSaleDay !== null && currentSaleDay <= 15) {
            // sale_day <= 15，任务已完成，保持当前状态，只更新数据字段
            await connection.query(
              `UPDATE task SET
                inventory_num = $1,
                sales_num = $2,
                sale_day = $3,
                charge = $4,
                label = $5,
                updated_at = CURRENT_TIMESTAMP
              WHERE ware_sku = $6`,
              [
                record.inventory_num,
                record.sales_num,
                record.sale_day ?? null,
                record.charge ?? null,
                labelValue,
                record.ware_sku,
              ]
            )
            // 注意：task_status、promised_land_snapshot、checked_at 等状态字段保持不变
          } else {
            // sale_day > 15，任务重新出现，流回任务正在进行中
            // 重置状态：task_status = promised_land_snapshot 或 promised_land
            const newTaskStatus = promisedLandSnapshot ?? originalPromisedLand ?? 0
            
            await connection.query(
              `UPDATE task SET
                inventory_num = $1,
                sales_num = $2,
                sale_day = $3,
                charge = $4,
                label = $5,
                task_status = $6,
                promised_land = $7,
                promised_land_snapshot = NULL,
                checked_at = NULL,
                reviewed_at = NULL,
                review_status = NULL,
                reject_reason = NULL,
                updated_at = CURRENT_TIMESTAMP
              WHERE ware_sku = $8`,
              [
                record.inventory_num,
                record.sales_num,
                record.sale_day ?? null,
                record.charge ?? null,
                labelValue,
                newTaskStatus,
                newTaskStatus, // promised_land 也同步更新
                record.ware_sku,
              ]
            )
            // 注意：created_at 保持不变，倒计时继续计算
          }
        } else {
          // 情况2：任务在未选择方案（task_status=0）或任务正在进行中（task_status=1/2/3）
          // 正常更新数据字段，保持 created_at 和状态字段不变
          await connection.query(
            `UPDATE task SET
              inventory_num = $1,
              sales_num = $2,
              sale_day = $3,
              charge = $4,
              label = $5,
              updated_at = CURRENT_TIMESTAMP
            WHERE ware_sku = $6`,
            [
              record.inventory_num,
              record.sales_num,
              record.sale_day ?? null,
              record.charge ?? null,
              labelValue,
              record.ware_sku,
            ]
          )
          // 注意：created_at、task_status、promised_land 等保持不变
        }
      } else {
        // 任务不存在，插入新任务
        await connection.query(
          `INSERT INTO task (
            ware_sku, inventory_num, sales_num, sale_day, charge, label, 
            promised_land, task_status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            record.ware_sku,
            record.inventory_num,
            record.sales_num,
            record.sale_day ?? null,
            record.charge ?? null,
            labelValue,
            0, // promised_land 默认为 0（未选择方案）
            0, // task_status 默认为 0（未选择方案）
          ]
        )
      }
    }

    // 4. 处理不再符合条件的任务（从异常变为正常）
    // 需要根据任务状态判断：未选择方案可以删除，选择方案后的要流转进入完成检查
    const allTaskSkus = Array.from(existingTasksMap.keys())
    const tasksToProcess = allTaskSkus.filter(sku => !validSkus.includes(sku))
    
    if (tasksToProcess.length > 0) {
      // 获取这些任务的详细信息（包括状态）
      const tasksToProcessResult = await connection.query(
        `SELECT ware_sku, task_status, promised_land, sale_day FROM task WHERE ware_sku = ANY($1::text[])`,
        [tasksToProcess]
      )
      
      for (const task of tasksToProcessResult.rows) {
        const taskStatus = task.task_status ?? 0
        const promisedLand = task.promised_land ?? 0
        
        if (taskStatus === 0) {
          // 未选择方案：直接删除
          await connection.query('DELETE FROM task WHERE ware_sku = $1', [task.ware_sku])
        } else if (taskStatus === 1 || taskStatus === 2 || taskStatus === 3) {
          // 任务正在进行中：流转进入完成检查（task_status = 4）
          // 保存 promised_land_snapshot，设置 checked_at
          await connection.query(
            `UPDATE task SET
              task_status = 4,
              promised_land_snapshot = $1,
              checked_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE ware_sku = $2`,
            [promisedLand, task.ware_sku]
          )
        }
        // task_status = 4 或 5（完成检查/审核中）：保持状态不变，不删除
      }
    }

    await connection.query('COMMIT')
    return { success: true }
  } catch (error: any) {
    await connection.query('ROLLBACK')
    console.error('同步数据到 task 表失败:', error)
    
    // 如果 JSON 函数不支持，使用备用方法
    try {
      await connection.query('BEGIN')
      
      // 获取所有 inventory 记录，在前端筛选
      const allResult = await connection.query('SELECT * FROM inventory')
      const allRecords = allResult.rows
      
      // 获取所有现有任务
      const existingTasksResult = await connection.query(
        'SELECT ware_sku, task_status, promised_land, promised_land_snapshot FROM task'
      )
      const existingTasksMap = new Map(
        existingTasksResult.rows.map((row: any) => [row.ware_sku, row])
      )
      
      const validSkus: string[] = []
      
      for (const record of allRecords) {
        let labels: number[] = []
        if (record.label) {
          try {
            labels = typeof record.label === 'string' ? JSON.parse(record.label) : record.label
          } catch (e) {
            // 忽略解析错误
          }
        }
        
        // 检查 label 是否符合条件
        const isOver20Days = labels.includes(4)
        const hasInventoryNoSales = labels.includes(2) && !labels.includes(1) && !labels.includes(5)
        
        if (Array.isArray(labels) && (isOver20Days || hasInventoryNoSales)) {
          validSkus.push(record.ware_sku)
          const labelValue = processLabelField(record.label)
          const existingTask = existingTasksMap.get(record.ware_sku)

          if (existingTask) {
            const taskStatus = existingTask.task_status ?? 0
            const promisedLandSnapshot = existingTask.promised_land_snapshot
            const originalPromisedLand = existingTask.promised_land ?? 0
            const currentSaleDay = record.sale_day ?? null

            if (taskStatus === 4 || taskStatus === 5) {
              // 检查 sale_day 是否 <= 15（任务完成条件）
              if (currentSaleDay !== null && currentSaleDay <= 15) {
                // sale_day <= 15，任务已完成，保持当前状态，只更新数据字段
                await connection.query(
                  `UPDATE task SET
                    inventory_num = $1, sales_num = $2, sale_day = $3, charge = $4, label = $5,
                    updated_at = CURRENT_TIMESTAMP
                  WHERE ware_sku = $6`,
                  [
                    record.inventory_num, record.sales_num, record.sale_day ?? null,
                    record.charge ?? null, labelValue, record.ware_sku,
                  ]
                )
              } else {
                // sale_day > 15，任务重新出现，流回任务正在进行中
                const newTaskStatus = promisedLandSnapshot ?? originalPromisedLand ?? 0
                
                await connection.query(
                  `UPDATE task SET
                    inventory_num = $1, sales_num = $2, sale_day = $3, charge = $4, label = $5,
                    task_status = $6, promised_land = $7,
                    promised_land_snapshot = NULL, checked_at = NULL, reviewed_at = NULL,
                    review_status = NULL, reject_reason = NULL, updated_at = CURRENT_TIMESTAMP
                  WHERE ware_sku = $8`,
                  [
                    record.inventory_num, record.sales_num, record.sale_day ?? null,
                    record.charge ?? null, labelValue, newTaskStatus, newTaskStatus,
                    record.ware_sku,
                  ]
                )
              }
            } else {
              await connection.query(
                `UPDATE task SET
                  inventory_num = $1, sales_num = $2, sale_day = $3, charge = $4, label = $5,
                  updated_at = CURRENT_TIMESTAMP
                WHERE ware_sku = $6`,
                [
                  record.inventory_num, record.sales_num, record.sale_day ?? null,
                  record.charge ?? null, labelValue, record.ware_sku,
                ]
              )
            }
          } else {
            await connection.query(
              `INSERT INTO task (ware_sku, inventory_num, sales_num, sale_day, charge, label, promised_land, task_status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [
                record.ware_sku, record.inventory_num, record.sales_num,
                record.sale_day ?? null, record.charge ?? null, labelValue, 0, 0,
              ]
            )
          }
        }
      }
      
      // 处理不再符合条件的任务（从异常变为正常）
      // 需要根据任务状态判断：未选择方案可以删除，选择方案后的要流转进入完成检查
      const allTaskSkus = Array.from(existingTasksMap.keys())
      const tasksToProcess = allTaskSkus.filter(sku => !validSkus.includes(sku))
      
      if (tasksToProcess.length > 0) {
        // 获取这些任务的详细信息（包括状态）
        const tasksToProcessResult = await connection.query(
          `SELECT ware_sku, task_status, promised_land, sale_day FROM task WHERE ware_sku = ANY($1::text[])`,
          [tasksToProcess]
        )
        
        for (const task of tasksToProcessResult.rows) {
          const taskStatus = task.task_status ?? 0
          const promisedLand = task.promised_land ?? 0
          
          if (taskStatus === 0) {
            // 未选择方案：直接删除
            await connection.query('DELETE FROM task WHERE ware_sku = $1', [task.ware_sku])
          } else if (taskStatus === 1 || taskStatus === 2 || taskStatus === 3) {
            // 任务正在进行中：流转进入完成检查（task_status = 4）
            // 保存 promised_land_snapshot，设置 checked_at
            await connection.query(
              `UPDATE task SET
                task_status = 4,
                promised_land_snapshot = $1,
                checked_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
              WHERE ware_sku = $2`,
              [promisedLand, task.ware_sku]
            )
          }
          // task_status = 4 或 5（完成检查/审核中）：保持状态不变，不删除
        }
      }
      
      await connection.query('COMMIT')
      return { success: true }
    } catch (fallbackError: any) {
      await connection.query('ROLLBACK')
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
 * @param chargeFilter 负责人筛选（可选）
 * @returns 统计数据
 */
export async function getInventoryStatistics(chargeFilter?: string): Promise<{
  normal_sales: number // label不包含1、2、4、5的数量（正常销售）
  over_15_days: number // label包含4的数量（在售天数超15天）
  negative_inventory: number // label包含5的数量（库存待冲平）
  has_inventory_no_sales: number // label包含2但不包含1的数量（有库存无销量）
}> {
  try {
    // 构建负责人筛选条件
    const chargeCondition = chargeFilter ? ` AND charge = $1` : ''
    const params = chargeFilter ? [chargeFilter] : []

    // 统计label包含4的数量（在售天数超15天）
    // PostgreSQL: 使用 JSONB @> 操作符
    // 从 task 表查询（所有SKU都在task表中）
    const over15DaysSql = `SELECT COUNT(*) as count FROM task WHERE label::jsonb @> '[4]'::jsonb${chargeCondition}`
    const over15DaysResult = await query<{ count: string | number }>(over15DaysSql, params)
    const over_15_days = Number(over15DaysResult[0]?.count) || 0

    // 统计label包含5的数量（库存待冲平）
    const negativeInventorySql = `SELECT COUNT(*) as count FROM task WHERE label::jsonb @> '[5]'::jsonb${chargeCondition}`
    const negativeInventoryResult = await query<{ count: string | number }>(negativeInventorySql, params)
    const negative_inventory = Number(negativeInventoryResult[0]?.count) || 0

    // 统计label包含2但不包含1且不包含5的数量（有库存无销量）
    const hasInventoryNoSalesSql = `SELECT COUNT(*) as count FROM task WHERE (label::jsonb @> '[2]'::jsonb) AND NOT (label::jsonb @> '[1]'::jsonb) AND NOT (label::jsonb @> '[5]'::jsonb)${chargeCondition}`
    const hasInventoryNoSalesResult = await query<{ count: string | number }>(hasInventoryNoSalesSql, params)
    const has_inventory_no_sales = Number(hasInventoryNoSalesResult[0]?.count) || 0

    // 统计label不包含1、2、4、5的数量（正常销售）
    const normalSalesSql = `SELECT COUNT(*) as count FROM task WHERE (label IS NULL OR label::text = '[]' OR (NOT (label::jsonb @> '[1]'::jsonb) AND NOT (label::jsonb @> '[2]'::jsonb) AND NOT (label::jsonb @> '[4]'::jsonb) AND NOT (label::jsonb @> '[5]'::jsonb)))${chargeCondition}`
    const normalSalesResult = await query<{ count: string | number }>(normalSalesSql, params)
    const normal_sales = Number(normalSalesResult[0]?.count) || 0

    return {
      normal_sales,
      over_15_days,
      negative_inventory,
      has_inventory_no_sales,
    }
  } catch (error) {
    console.error('获取库存统计数据失败:', error)
    // 如果JSON函数不支持，使用备用方法
    try {
      const allData = await query<any>('SELECT label FROM task')
      let normal_sales = 0
      let over_15_days = 0
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

      return { normal_sales, over_15_days, negative_inventory, has_inventory_no_sales }
    } catch (fallbackError) {
      console.error('备用统计方法失败:', fallbackError)
      return { normal_sales: 0, over_15_days: 0, negative_inventory: 0, has_inventory_no_sales: 0 }
    }
  }
}

/**
 * 获取所有库存数据
 * @param searchSku 搜索SKU（可选）
 * @param labelFilter 标签筛选（可选）：'normal'=正常销售，4=在售天数超15天，5=库存待冲平，'2_not_1'=有库存无销量
 * @returns 库存数据数组
 */
export async function getInventoryData(
  searchSku?: string,
  labelFilter?: 'normal' | 4 | 5 | '2_not_1'
): Promise<InventoryRecord[]> {
  try {
    let sql =
      'SELECT id, ware_sku, inventory_num, sales_num, sale_day, charge, label, created_at, updated_at FROM task WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (searchSku) {
      sql += ` AND ware_sku LIKE $${paramIndex}`
      params.push(`%${searchSku}%`)
      paramIndex++
    }

    // 根据label筛选
    // PostgreSQL: 使用 JSONB @> 操作符
    if (labelFilter !== undefined) {
      if (labelFilter === 'normal') {
        // 正常销售：label不包含1、2、4、5
        sql += ` AND (label IS NULL OR label::text = '[]' OR ((NOT (label::jsonb @> '[1]'::jsonb)) AND (NOT (label::jsonb @> '[2]'::jsonb)) AND (NOT (label::jsonb @> '[4]'::jsonb)) AND (NOT (label::jsonb @> '[5]'::jsonb))))`
      } else if (labelFilter === '2_not_1') {
        // 特殊筛选：label包含2但不包含1且不包含5（有库存无销量）
        sql += ` AND (label::jsonb @> '[2]'::jsonb) AND NOT (label::jsonb @> '[1]'::jsonb) AND NOT (label::jsonb @> '[5]'::jsonb)`
      } else if (labelFilter === 4 || labelFilter === 5) {
        // 普通筛选：label包含指定值
        sql += ` AND (label::jsonb @> '[${labelFilter}]'::jsonb)`
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
        } else if (labelFilter === 4 || labelFilter === 5) {
          // 普通筛选：label包含指定值
          return labels.includes(labelFilter)
        }
        return true
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
 * @param labelFilter 标签筛选（可选）：'over_15_days'=在售天数超20天，'has_inventory_no_sales'=有库存无销量
 * @param statusFilter 状态筛选（可选）：'no_solution'=未选择方案，'in_progress'=任务正在进行中，'checking'=完成检查，'reviewing'=审核中，'timeout'=超时任务（count_down < 0）
 * @param chargeFilter 负责人筛选（可选）
 * @returns 任务数据数组
 */
export async function getTaskData(
  searchSku?: string,
  labelFilter?: 'over_15_days' | 'has_inventory_no_sales',
  statusFilter?: 'no_solution' | 'in_progress' | 'checking' | 'reviewing' | 'timeout',
  chargeFilter?: string
): Promise<InventoryRecord[]> {
  try {
    // 先更新所有记录的 count_down（根据 promised_land 使用不同计算逻辑）
    await updateTaskCountDown()
    // 使用 CASE WHEN 根据 promised_land 的值计算 count_down（单位：小时）
    // PostgreSQL: EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600 计算小时差
    // 只查询任务记录：task_status IS NOT NULL 或 promised_land IS NOT NULL
    let sql =
      'SELECT id, ware_sku, inventory_num, sales_num, sale_day, charge, label, promised_land, promised_land_snapshot, task_status, image_urls, notes, reject_reason, price_reduction_failure_count, CASE WHEN promised_land = 0 OR promised_land IS NULL THEN 24 - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600 ELSE 168 - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600 END as count_down, created_at, updated_at FROM task WHERE (task_status IS NOT NULL OR promised_land IS NOT NULL)'
    const params: any[] = []
    let paramIndex = 1

    if (searchSku) {
      sql += ` AND ware_sku LIKE $${paramIndex}`
      params.push(`%${searchSku}%`)
      paramIndex++
    }

    // 标签筛选（前两个）
    // PostgreSQL: 使用 JSONB @> 操作符
    if (labelFilter === 'over_15_days') {
      // 在售天数超15天：label 包含 4
      sql += ` AND (label::jsonb @> '[4]'::jsonb)`
    } else if (labelFilter === 'has_inventory_no_sales') {
      // 有库存无销量：label 包含 2 但不包含 1 且不包含 5
      sql += ` AND (label::jsonb @> '[2]'::jsonb)`
      sql += ` AND NOT (label::jsonb @> '[1]'::jsonb)`
      sql += ` AND NOT (label::jsonb @> '[5]'::jsonb)`
    }

    // 状态筛选
    if (statusFilter === 'no_solution') {
      // 未选择方案：task_status = 0
      sql += ' AND task_status = 0'
    } else if (statusFilter === 'in_progress') {
      // 任务正在进行中：task_status = 1 或 2 或 3
      sql += ' AND task_status IN (1, 2, 3)'
    } else if (statusFilter === 'checking') {
      // 完成检查：task_status = 4
      sql += ' AND task_status = 4'
    } else if (statusFilter === 'reviewing') {
      // 审核中：task_status = 5
      // 注意：前端需要根据管理员权限控制是否显示此筛选
      sql += ' AND task_status = 5'
    } else if (statusFilter === 'timeout') {
      // 超时任务：count_down < 0（单位：小时）
      sql += ' AND (CASE WHEN promised_land = 0 THEN 24 - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600 ELSE 168 - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600 END) < 0'
    }

    // 负责人筛选
    if (chargeFilter) {
      sql += ` AND charge = $${paramIndex}`
      params.push(chargeFilter)
      paramIndex++
    }

    sql += ' ORDER BY updated_at DESC, id DESC'

    const results = await query<any>(sql, params)

    // 将label字段从JSON字符串转换为数组，解析count_down字段和image_urls字段
    const parsedResults = results.map((row: any) => {
      if (row.label) {
        try {
          row.label = typeof row.label === 'string' ? JSON.parse(row.label) : row.label
        } catch (e) {
          // 如果解析失败，保持原值
          console.warn('解析label字段失败:', row.label)
        }
      }
      // 解析 image_urls 字段（JSONB数组）
      if (row.image_urls) {
        try {
          row.image_urls = typeof row.image_urls === 'string' ? JSON.parse(row.image_urls) : row.image_urls
          // 确保是数组
          if (!Array.isArray(row.image_urls)) {
            row.image_urls = []
          }
        } catch (e) {
          // 如果解析失败，设为空数组
          console.warn('解析image_urls字段失败:', row.image_urls)
          row.image_urls = []
        }
      } else {
        row.image_urls = []
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
  over_15_days: number // label包含4的数量（在售天数超20天）
  has_inventory_no_sales: number // label包含2但不包含1且不包含5的数量（有库存无销量）
  no_solution: number // task_status = 0的数量（未选择方案）
  in_progress: number // task_status IN (1,2,3)的数量（任务正在进行中）
  checking: number // task_status = 4的数量（完成检查）
  reviewing: number // task_status = 5的数量（审核中）
  timeout: number // 超时任务数量
}> {
  try {
    // 统计label包含4的数量（在售天数超15天）
    // PostgreSQL: 使用 JSONB @> 操作符
    let over15DaysSql = "SELECT COUNT(*) as count FROM task WHERE label::jsonb @> '[4]'::jsonb"
    const over15DaysParams: any[] = []
    let paramIndex = 1
    if (chargeFilter) {
      over15DaysSql += ` AND charge = $${paramIndex}`
      over15DaysParams.push(chargeFilter)
      paramIndex++
    }
    const over15DaysResult = await query<{ count: string | number }>(over15DaysSql, over15DaysParams)
    const over_15_days = Number(over15DaysResult[0]?.count) || 0

    // 统计label包含2但不包含1且不包含5的数量（有库存无销量）
    let hasInventoryNoSalesSql = "SELECT COUNT(*) as count FROM task WHERE (label::jsonb @> '[2]'::jsonb) AND NOT (label::jsonb @> '[1]'::jsonb) AND NOT (label::jsonb @> '[5]'::jsonb)"
    const hasInventoryNoSalesParams: any[] = []
    paramIndex = 1
    if (chargeFilter) {
      hasInventoryNoSalesSql += ` AND charge = $${paramIndex}`
      hasInventoryNoSalesParams.push(chargeFilter)
      paramIndex++
    }
    const hasInventoryNoSalesResult = await query<{ count: string | number }>(hasInventoryNoSalesSql, hasInventoryNoSalesParams)
    const has_inventory_no_sales = Number(hasInventoryNoSalesResult[0]?.count) || 0

    // 统计task_status = 0的数量（未选择方案）
    let noSolutionSql = 'SELECT COUNT(*) as count FROM task WHERE task_status = 0'
    const noSolutionParams: any[] = []
    paramIndex = 1
    if (chargeFilter) {
      noSolutionSql += ` AND charge = $${paramIndex}`
      noSolutionParams.push(chargeFilter)
      paramIndex++
    }
    const noSolutionResult = await query<{ count: string | number }>(noSolutionSql, noSolutionParams)
    const no_solution = Number(noSolutionResult[0]?.count) || 0

    // 统计task_status IN (1,2,3)的数量（任务正在进行中）
    let inProgressSql = 'SELECT COUNT(*) as count FROM task WHERE task_status IN (1, 2, 3)'
    const inProgressParams: any[] = []
    paramIndex = 1
    if (chargeFilter) {
      inProgressSql += ` AND charge = $${paramIndex}`
      inProgressParams.push(chargeFilter)
      paramIndex++
    }
    const inProgressResult = await query<{ count: string | number }>(inProgressSql, inProgressParams)
    const in_progress = Number(inProgressResult[0]?.count) || 0

    // 统计task_status = 4的数量（完成检查）
    let checkingSql = 'SELECT COUNT(*) as count FROM task WHERE task_status = 4'
    const checkingParams: any[] = []
    paramIndex = 1
    if (chargeFilter) {
      checkingSql += ` AND charge = $${paramIndex}`
      checkingParams.push(chargeFilter)
      paramIndex++
    }
    const checkingResult = await query<{ count: string | number }>(checkingSql, checkingParams)
    const checking = Number(checkingResult[0]?.count) || 0

    // 统计task_status = 5的数量（审核中）
    let reviewingSql = 'SELECT COUNT(*) as count FROM task WHERE task_status = 5'
    const reviewingParams: any[] = []
    paramIndex = 1
    if (chargeFilter) {
      reviewingSql += ` AND charge = $${paramIndex}`
      reviewingParams.push(chargeFilter)
      paramIndex++
    }
    const reviewingResult = await query<{ count: string | number }>(reviewingSql, reviewingParams)
    const reviewing = Number(reviewingResult[0]?.count) || 0

    // 统计 count_down < 0 的数量（超时任务）
    // PostgreSQL: 使用 EXTRACT(DAY FROM ...) 计算日期差
    let timeoutSql = 'SELECT COUNT(*) as count FROM task WHERE (CASE WHEN promised_land = 0 THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER END) < 0'
    const timeoutParams: any[] = []
    paramIndex = 1
    if (chargeFilter) {
      timeoutSql += ` AND charge = $${paramIndex}`
      timeoutParams.push(chargeFilter)
      paramIndex++
    }
    const timeoutResult = await query<{ count: string | number }>(timeoutSql, timeoutParams)
    const timeout = Number(timeoutResult[0]?.count) || 0

    return {
      over_15_days,
      has_inventory_no_sales,
      no_solution,
      in_progress,
      checking,
      reviewing,
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

      let checking = 0
      let reviewing = 0
      
      allData.forEach((row: any) => {
        const taskStatus = row.task_status ?? 0
        if (taskStatus === 4) checking++
        if (taskStatus === 5) reviewing++
      })
      
      return {
        over_15_days,
        has_inventory_no_sales,
        no_solution,
        in_progress,
        checking,
        reviewing,
        // 统计 count_down < 0 的数量（超时任务，单位：小时）
        timeout: allData.filter((row: any) => {
          if (!row.created_at) return false
          const hoursDiff = (new Date().getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60)
          const countDown = (row.promised_land ?? 0) === 0 ? 24 - hoursDiff : 168 - hoursDiff
          return countDown < 0
        }).length,
      }
    } catch (fallbackError) {
      console.error('备用统计方法失败:', fallbackError)
      return { over_15_days: 0, has_inventory_no_sales: 0, no_solution: 0, in_progress: 0, checking: 0, reviewing: 0, timeout: 0 }
    }
  }
}

/**
 * 获取所有负责人列表（从 task 表）
 * @returns 负责人列表（去重）
 */
export async function getTaskChargeList(): Promise<string[]> {
  try {
    const sql = `SELECT DISTINCT charge FROM task WHERE charge IS NOT NULL AND charge != '' ORDER BY charge`
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
  review_status: string | null
  notes: string | null
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
  dateTo?: string,
  reviewStatusFilter?: 'approved' | 'failed' | null
): Promise<TaskHistoryRecord[]> {
  try {
    let sql = 'SELECT id, ware_sku, completed_sale_day, charge, promised_land, completed_at, inventory_num, sales_num, label, review_status, notes FROM task_history WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (searchSku) {
      sql += ` AND ware_sku LIKE $${paramIndex}`
      params.push(`%${searchSku}%`)
      paramIndex++
    }

    if (chargeFilter) {
      sql += ` AND charge = $${paramIndex}`
      params.push(chargeFilter)
      paramIndex++
    }

    if (promisedLandFilter !== undefined) {
      sql += ` AND promised_land = $${paramIndex}`
      params.push(promisedLandFilter)
      paramIndex++
    }

    if (dateFrom) {
      sql += ` AND completed_at >= $${paramIndex}`
      params.push(dateFrom)
      paramIndex++
    }

    if (dateTo) {
      sql += ` AND completed_at <= $${paramIndex}`
      params.push(`${dateTo} 23:59:59`)
      paramIndex++
    }

    // 审核状态筛选
    if (reviewStatusFilter === 'approved') {
      sql += ` AND review_status = $${paramIndex}`
      params.push('approved')
      paramIndex++
    } else if (reviewStatusFilter === 'failed') {
      sql += ` AND review_status IN ($${paramIndex}, $${paramIndex + 1})`
      params.push('rejected', 'timeout')
      paramIndex += 2
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
        review_status: row.review_status || null,
        notes: row.notes || null,
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
  total: number // 总完成数（label 不包含 4）
  total_failed: number // 总失败数（label 包含 4）
  promised_land_1: number // 退回厂家完成数
  promised_land_2: number // 降价清仓完成数
  promised_land_3: number // 打处理完成数
}

export async function getTaskHistoryStatistics(): Promise<TaskHistoryStatistics> {
  try {
    // 总完成数：审核通过的记录（review_status = 'approved'）
    const totalResult = await query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM task_history 
       WHERE review_status = 'approved'`
    )
    const total = Number(totalResult[0]?.count) || 0

    // 总失败数：审核打回或超时的记录（review_status = 'rejected' 或 'timeout'）
    const totalFailedResult = await query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM task_history 
       WHERE review_status IN ('rejected', 'timeout')`
    )
    const total_failed = Number(totalFailedResult[0]?.count) || 0

    // 各方案完成数：只统计审核通过的记录
    const promisedLand1Result = await query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM task_history 
       WHERE promised_land = 1 AND review_status = 'approved'`
    )
    const promised_land_1 = Number(promisedLand1Result[0]?.count) || 0

    const promisedLand2Result = await query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM task_history 
       WHERE promised_land = 2 AND review_status = 'approved'`
    )
    const promised_land_2 = Number(promisedLand2Result[0]?.count) || 0

    const promisedLand3Result = await query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM task_history 
       WHERE promised_land = 3 AND review_status = 'approved'`
    )
    const promised_land_3 = Number(promisedLand3Result[0]?.count) || 0

    return {
      total,
      total_failed,
      promised_land_1,
      promised_land_2,
      promised_land_3,
    }
  } catch (error: any) {
    console.error('获取历史任务统计数据失败:', error)
    return {
      total: 0,
      total_failed: 0,
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
    const sql = `SELECT DISTINCT charge FROM task_history WHERE charge IS NOT NULL AND charge != '' ORDER BY charge`
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
    // 更新 promised_land 时，同时更新 task_status 和 count_down
    // task_status 与 promised_land 同步：0=0, 1=1, 2=2, 3=3
    // PostgreSQL: 使用 EXTRACT(EPOCH FROM ...) / 3600 计算小时差
    await execute(
      `UPDATE task SET 
        promised_land = $1,
        task_status = $1,
        count_down = CASE 
          WHEN $1 = 0 THEN 24 - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600
          ELSE 168 - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE ware_sku = $2`,
      [promisedLand, wareSku]
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

/**
 * 更新任务备注
 * @param wareSku SKU货号
 * @param notes 备注内容
 * @returns 更新结果
 */
export async function updateTaskNotes(
  wareSku: string,
  notes: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    await execute(
      `UPDATE task SET 
        notes = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE ware_sku = $2`,
      [notes, wareSku]
    )
    return { success: true }
  } catch (error: any) {
    console.error('更新任务备注失败:', error)
    return {
      success: false,
      error: error.message || '更新备注失败',
    }
  }
}

/**
 * 添加任务图片URL
 * @param wareSku SKU货号
 * @param imageUrl 图片URL
 * @returns 更新结果
 */
export async function addTaskImageUrl(
  wareSku: string,
  imageUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 先获取当前的图片URL数组
    const currentResult = await query<{ image_urls: any }>(
      'SELECT image_urls FROM task WHERE ware_sku = $1',
      [wareSku]
    )
    
    let currentUrls: string[] = []
    if (currentResult.length > 0 && currentResult[0].image_urls) {
      try {
        currentUrls = typeof currentResult[0].image_urls === 'string' 
          ? JSON.parse(currentResult[0].image_urls) 
          : currentResult[0].image_urls
        if (!Array.isArray(currentUrls)) {
          currentUrls = []
        }
      } catch (e) {
        currentUrls = []
      }
    }
    
    // 如果图片URL已存在，不重复添加
    if (currentUrls.includes(imageUrl)) {
      return { success: true }
    }
    
    // 添加新的图片URL
    currentUrls.push(imageUrl)
    
    await execute(
      `UPDATE task SET 
        image_urls = $1::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE ware_sku = $2`,
      [JSON.stringify(currentUrls), wareSku]
    )
    return { success: true }
  } catch (error: any) {
    console.error('添加任务图片URL失败:', error)
    return {
      success: false,
      error: error.message || '添加图片URL失败',
    }
  }
}

/**
 * 删除任务图片URL
 * @param wareSku SKU货号
 * @param imageUrl 要删除的图片URL
 * @returns 更新结果
 */
export async function removeTaskImageUrl(
  wareSku: string,
  imageUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 先获取当前的图片URL数组
    const currentResult = await query<{ image_urls: any }>(
      'SELECT image_urls FROM task WHERE ware_sku = $1',
      [wareSku]
    )
    
    let currentUrls: string[] = []
    if (currentResult.length > 0 && currentResult[0].image_urls) {
      try {
        currentUrls = typeof currentResult[0].image_urls === 'string' 
          ? JSON.parse(currentResult[0].image_urls) 
          : currentResult[0].image_urls
        if (!Array.isArray(currentUrls)) {
          currentUrls = []
        }
      } catch (e) {
        currentUrls = []
      }
    }
    
    // 删除指定的图片URL
    currentUrls = currentUrls.filter(url => url !== imageUrl)
    
    await execute(
      `UPDATE task SET 
        image_urls = $1::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE ware_sku = $2`,
      [JSON.stringify(currentUrls), wareSku]
    )
    return { success: true }
  } catch (error: any) {
    console.error('删除任务图片URL失败:', error)
    return {
      success: false,
      error: error.message || '删除图片URL失败',
    }
  }
}

/**
 * 确认完成检查（从任务正在进行中转入完成检查）
 * @param wareSku SKU货号
 * @returns 更新结果
 */
export async function confirmTaskCheck(
  wareSku: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 获取当前任务的 promised_land 值
    const taskResult = await query<{ promised_land: number }>(
      'SELECT promised_land FROM task WHERE ware_sku = $1',
      [wareSku]
    )
    
    if (taskResult.length === 0) {
      return {
        success: false,
        error: '任务不存在',
      }
    }
    
    const promisedLand = taskResult[0].promised_land ?? 0
    
    // 如果 promised_land 为 0，不允许转入完成检查
    if (promisedLand === 0) {
      return {
        success: false,
        error: '请先选择方案',
      }
    }
    
    // 更新任务状态：task_status = 4（完成检查）
    // 保存 promised_land 到 promised_land_snapshot
    await execute(
      `UPDATE task SET
        task_status = 4,
        promised_land_snapshot = $1,
        checked_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE ware_sku = $2`,
      [promisedLand, wareSku]
    )
    
    return { success: true }
  } catch (error: any) {
    console.error('确认完成检查失败:', error)
    return {
      success: false,
      error: error.message || '确认完成检查失败',
    }
  }
}

/**
 * 确认审核（从完成检查转入审核中）
 * @param wareSku SKU货号
 * @returns 更新结果
 */
export async function confirmTaskReview(
  wareSku: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 检查任务是否在完成检查状态
    const taskResult = await query<{ task_status: number }>(
      'SELECT task_status FROM task WHERE ware_sku = $1',
      [wareSku]
    )
    
    if (taskResult.length === 0) {
      return {
        success: false,
        error: '任务不存在',
      }
    }
    
    if (taskResult[0].task_status !== 4) {
      return {
        success: false,
        error: '任务不在完成检查状态',
      }
    }
    
    // 更新任务状态：task_status = 5（审核中）
    await execute(
      `UPDATE task SET
        task_status = 5,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE ware_sku = $1`,
      [wareSku]
    )
    
    return { success: true }
  } catch (error: any) {
    console.error('确认审核失败:', error)
    return {
      success: false,
      error: error.message || '确认审核失败',
    }
  }
}

/**
 * 审核通过（从审核中转入历史任务）
 * @param wareSku SKU货号
 * @returns 更新结果
 */
export async function approveTask(
  wareSku: string
): Promise<{ success: boolean; error?: string }> {
  const connection = await getConnection()
  await connection.query('BEGIN')
  
  try {
    // 获取任务信息
    const taskResult = await connection.query(
      `SELECT ware_sku, sale_day, charge, promised_land, promised_land_snapshot, 
              task_status, inventory_num, sales_num, label, notes
       FROM task WHERE ware_sku = $1`,
      [wareSku]
    )
    
    if (taskResult.rows.length === 0) {
      await connection.query('ROLLBACK')
      return {
        success: false,
        error: '任务不存在',
      }
    }
    
    const task = taskResult.rows[0]
    
    // 处理 label 字段
    const taskLabelValue = processLabelField(task.label)
    
    // 插入历史任务记录
    await connection.query(
      `INSERT INTO task_history (
        ware_sku, completed_sale_day, charge, promised_land,
        inventory_num, sales_num, label, completed_at,
        task_status_snapshot, review_status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, 'approved', $9)`,
      [
        task.ware_sku,
        task.sale_day ?? null,
        task.charge ?? null,
        task.promised_land_snapshot ?? task.promised_land ?? 0,
        task.inventory_num ?? 0,
        task.sales_num ?? 0,
        taskLabelValue,
        task.task_status ?? 0,
        task.notes ?? null,
      ]
    )
    
    // 从 task 表中删除已完成的任务
    await connection.query('DELETE FROM task WHERE ware_sku = $1', [wareSku])
    
    await connection.query('COMMIT')
    return { success: true }
  } catch (error: any) {
    await connection.query('ROLLBACK')
    console.error('审核通过失败:', error)
    return {
      success: false,
      error: error.message || '审核通过失败',
    }
  } finally {
    connection.release()
  }
}

/**
 * 审核打回（从审核中打回完成检查）
 * @param wareSku SKU货号
 * @param rejectReason 打回理由
 * @returns 更新结果
 */
export async function rejectTask(
  wareSku: string,
  rejectReason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!rejectReason || rejectReason.trim() === '') {
      return {
        success: false,
        error: '打回理由不能为空',
      }
    }
    
    // 检查任务是否在审核中状态，并获取当前方案和失败次数
    const taskResult = await query<{ task_status: number; promised_land: number; price_reduction_failure_count: number }>(
      'SELECT task_status, promised_land, price_reduction_failure_count FROM task WHERE ware_sku = $1',
      [wareSku]
    )
    
    if (taskResult.length === 0) {
      return {
        success: false,
        error: '任务不存在',
      }
    }
    
    if (taskResult[0].task_status !== 5) {
      return {
        success: false,
        error: '任务不在审核中状态',
      }
    }
    
    // 如果是降价清仓方案被打回，增加失败次数（最多3次）
    let newFailureCount = taskResult[0].price_reduction_failure_count || 0
    if (taskResult[0].promised_land === 2) {
      newFailureCount = Math.min(newFailureCount + 1, 3)
    }
    
    // 更新任务状态：task_status = 4（回到完成检查）
    // 记录打回理由和审核状态
    // 如果是降价清仓方案，增加失败次数
    await execute(
      `UPDATE task SET
        task_status = 4,
        review_status = 'rejected',
        reject_reason = $1,
        price_reduction_failure_count = $2,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE ware_sku = $3`,
      [rejectReason.trim(), newFailureCount, wareSku]
    )
    
    return { success: true }
  } catch (error: any) {
    console.error('审核打回失败:', error)
    return {
      success: false,
      error: error.message || '审核打回失败',
    }
  }
}

