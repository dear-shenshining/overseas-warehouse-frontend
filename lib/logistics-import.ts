/**
 * 物流数据导入功能
 * 将Excel文件中的发货单号、发货日期、发货渠道导入到 post_searchs 表
 */

import * as XLSX from 'xlsx'
import { query, execute, getConnection } from './db'

/**
 * Excel文件中的列名映射
 */
const EXCEL_COLUMNS = {
  SHIPPING_NUM: '发货单号',
  SHIP_DATE: '发货日期',
  CHANNEL: '发货渠道',
  ORDER_NUM: '订单号',
  TRANSFER_NUM: '转单号',
  NOTES: '备注',
} as const

/**
 * 读取Excel文件数据
 */
function parseExcelFile(fileBuffer: Buffer): Array<{
  shipping_num: string
  ship_date: string | null
  channel: string | null
  order_num: string | null
  transfer_num: string | null
  notes: string | null
}> {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: null })

    if (data.length === 0) {
      throw new Error('Excel文件为空或没有数据')
    }

    // 检查必要的列是否存在
    const firstRow = data[0] as any
    if (!(EXCEL_COLUMNS.SHIPPING_NUM in firstRow)) {
      throw new Error(`Excel文件缺少必要的列: ${EXCEL_COLUMNS.SHIPPING_NUM}`)
    }

    const hasChannel = EXCEL_COLUMNS.CHANNEL in firstRow
    const hasShipDate = EXCEL_COLUMNS.SHIP_DATE in firstRow
    const hasOrderNum = EXCEL_COLUMNS.ORDER_NUM in firstRow
    const hasTransferNum = EXCEL_COLUMNS.TRANSFER_NUM in firstRow
    const hasNotes = EXCEL_COLUMNS.NOTES in firstRow

    // 解析数据
    const orderData: Array<{
      shipping_num: string
      ship_date: string | null
      channel: string | null
      order_num: string | null
      transfer_num: string | null
      notes: string | null
    }> = []

    for (const row of data as any[]) {
      let shippingNum = row[EXCEL_COLUMNS.SHIPPING_NUM]

      // 处理发货单号
      if (shippingNum == null || shippingNum === '') {
        continue
      }

      // 处理数字类型，确保不带小数点
      if (typeof shippingNum === 'number') {
        if (Number.isInteger(shippingNum)) {
          shippingNum = String(shippingNum)
        } else {
          shippingNum = String(Math.floor(shippingNum))
        }
      } else {
        shippingNum = String(shippingNum).trim()
        // 如果是带.0的float字符串，移除.0
        if (shippingNum.endsWith('.0')) {
          shippingNum = shippingNum.slice(0, -2)
        }
      }

      if (!shippingNum) {
        continue
      }

      // 处理发货日期
      let shipDate: string | null = null
      if (hasShipDate && row[EXCEL_COLUMNS.SHIP_DATE] != null) {
        const dateValue = row[EXCEL_COLUMNS.SHIP_DATE]
        try {
          // 如果是Excel日期序列号
          if (typeof dateValue === 'number') {
            // Excel日期从1900-01-01开始，但实际是1899-12-30
            const excelEpoch = new Date(1899, 11, 30)
            const days = Math.floor(dateValue)
            const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000)
            shipDate = date.toISOString().split('T')[0]
          } else if (dateValue instanceof Date) {
            shipDate = dateValue.toISOString().split('T')[0]
          } else {
            // 尝试解析字符串日期
            const parsed = new Date(dateValue)
            if (!isNaN(parsed.getTime())) {
              shipDate = parsed.toISOString().split('T')[0]
            }
          }
        } catch (e) {
          // 日期解析失败，跳过
          shipDate = null
        }
      }

      // 处理发货渠道
      let channel: string | null = null
      if (hasChannel && row[EXCEL_COLUMNS.CHANNEL] != null) {
        channel = String(row[EXCEL_COLUMNS.CHANNEL]).trim() || null
      }

      // 处理订单号
      let orderNum: string | null = null
      if (hasOrderNum && row[EXCEL_COLUMNS.ORDER_NUM] != null) {
        const orderNumValue = row[EXCEL_COLUMNS.ORDER_NUM]
        if (typeof orderNumValue === 'number') {
          orderNum = String(orderNumValue)
        } else {
          orderNum = String(orderNumValue).trim() || null
        }
      }

      // 处理转单号（只能是数字）
      let transferNum: string | null = null
      if (hasTransferNum && row[EXCEL_COLUMNS.TRANSFER_NUM] != null) {
        const transferNumValue = row[EXCEL_COLUMNS.TRANSFER_NUM]
        if (typeof transferNumValue === 'number') {
          transferNum = String(transferNumValue)
        } else {
          const transferNumStr = String(transferNumValue).trim()
          // 验证转单号只能是数字
          if (transferNumStr && /^\d+$/.test(transferNumStr)) {
            transferNum = transferNumStr
          } else if (transferNumStr) {
            // 如果不是纯数字，设为null
            transferNum = null
          }
        }
      }

      // 处理备注
      let notes: string | null = null
      if (hasNotes && row[EXCEL_COLUMNS.NOTES] != null) {
        notes = String(row[EXCEL_COLUMNS.NOTES]).trim() || null
      }

      orderData.push({
        shipping_num: shippingNum,
        ship_date: shipDate,
        channel: channel,
        order_num: orderNum,
        transfer_num: transferNum,
        notes: notes,
      })
    }

    return orderData
  } catch (error: any) {
    throw new Error(`读取Excel文件失败: ${error.message}`)
  }
}

/**
 * 导入数据到数据库
 * 使用批量插入优化性能
 */
export async function importLogisticsData(
  fileBuffer: Buffer
): Promise<{
  success: boolean
  message?: string
  error?: string
  stats?: {
    total: number
    inserted: number
    updated: number
    skipped: number
  }
}> {
  try {
    // 先检查表是否存在（诊断用）
    try {
      const tableCheck = await query('SELECT 1 FROM post_searchs LIMIT 1')
      console.log('✓ 表 post_searchs 存在')
    } catch (tableError: any) {
      console.error('❌ 表 post_searchs 不存在或无法访问:', tableError.message)
      // 尝试 Post_searchs（大写 P）
      try {
        const tableCheck2 = await query('SELECT 1 FROM "Post_searchs" LIMIT 1')
        console.log('✓ 表 Post_searchs 存在（大写 P）')
        throw new Error('表名是 Post_searchs（大写 P），请更新代码使用正确的表名')
      } catch (tableError2: any) {
        if (tableError2.message.includes('表名是 Post_searchs')) {
          throw tableError2
        }
        throw new Error(`表不存在: ${tableError.message}`)
      }
    }

    // 解析Excel文件
    const orderData = parseExcelFile(fileBuffer)

    if (orderData.length === 0) {
      return {
        success: false,
        error: 'Excel文件中没有找到有效数据',
      }
    }

    let inserted = 0
    let updated = 0
    let skipped = 0

    console.log(`开始导入 ${orderData.length} 条记录...`)

    // 先批量查询已存在的记录，获取转单号和备注用于比较
    const allSearchNums = orderData.map(item => item.shipping_num)
    console.log('查询已存在的记录...')
    
    // 检查新字段是否存在（只检查一次，提高性能）
    const { checkLogisticsNewFields } = await import('./check-table-structure')
    const { hasOrderNum, hasTransferNum, hasNotes, hasTransferDate } = await checkLogisticsNewFields()
    
    // 构建查询字段
    const selectFields = ['search_num']
    if (hasTransferNum) selectFields.push('transfer_num')
    if (hasNotes) selectFields.push('notes')
    
    const existingResult = await query<{ 
      search_num: string
      transfer_num?: string | null
      notes?: string | null
    }>(
      `SELECT ${selectFields.join(', ')} FROM post_searchs WHERE search_num = ANY($1::text[])`,
      [allSearchNums]
    )
    
    // 构建已存在记录的映射表，方便快速查找
    const existingMap = new Map<string, { transfer_num?: string | null, notes?: string | null }>()
    for (const record of existingResult) {
      existingMap.set(record.search_num, {
        transfer_num: record.transfer_num,
        notes: record.notes,
      })
    }
    console.log(`找到 ${existingMap.size} 条已存在的记录`)

    // 构建基础字段列表（用于插入新记录）
    const baseFields = ['search_num', 'ship_date', 'channel']
    const allFields = [...baseFields]
    if (hasOrderNum) allFields.push('order_num')
    if (hasTransferNum) allFields.push('transfer_num')
    if (hasNotes) allFields.push('notes')
    
    // 分类数据：新记录、需要更新的记录、无需更新的记录
    const newRecords: typeof orderData = []
    const updateRecords: Array<{
      item: typeof orderData[0]
      existingRecord: { transfer_num?: string | null, notes?: string | null }
      transferNumChanged: boolean
      notesChanged: boolean
    }> = []
    const skipRecords: typeof orderData = []

    console.log('分类数据中...')
    for (const item of orderData) {
      const existingRecord = existingMap.get(item.shipping_num)
      
      if (existingRecord) {
        // 已存在的记录，检查是否需要更新
        let transferNumChanged = false
        let notesChanged = false

        // 检查转单号是否不一致
        if (hasTransferNum) {
          const existingTransferNum = existingRecord.transfer_num || null
          const newTransferNum = item.transfer_num || null
          
          transferNumChanged = 
            (existingTransferNum !== newTransferNum) &&
            !(existingTransferNum === null && newTransferNum === null) &&
            !(existingTransferNum === '' && newTransferNum === null) &&
            !(existingTransferNum === null && newTransferNum === '') &&
            newTransferNum !== null
        }

        // 检查备注是否不一致
        if (hasNotes) {
          const existingNotes = existingRecord.notes || null
          const newNotes = item.notes || null
          
          notesChanged = 
            (existingNotes !== newNotes) &&
            !(existingNotes === null && newNotes === null) &&
            !(existingNotes === '' && newNotes === null) &&
            !(existingNotes === null && newNotes === '')
        }

        if (transferNumChanged || notesChanged) {
          updateRecords.push({ item, existingRecord, transferNumChanged, notesChanged })
        } else {
          skipRecords.push(item)
        }
      } else {
        // 新记录
        newRecords.push(item)
      }
    }

    console.log(`分类完成：新增 ${newRecords.length} 条，更新 ${updateRecords.length} 条，跳过 ${skipRecords.length} 条`)

    // 批量插入新记录
    if (newRecords.length > 0) {
      console.log(`批量插入 ${newRecords.length} 条新记录...`)
      const batchSize = 500 // 每批插入500条
      
      for (let i = 0; i < newRecords.length; i += batchSize) {
        const batch = newRecords.slice(i, i + batchSize)
        const valuesList: any[] = []
        const placeholdersList: string[] = []
        let paramIndex = 1

        for (const item of batch) {
          const values: any[] = [item.shipping_num, item.ship_date, item.channel]
          if (hasOrderNum) values.push(item.order_num)
          if (hasTransferNum) values.push(item.transfer_num)
          if (hasNotes) values.push(item.notes)
          
          const placeholders = values.map((_, idx) => `$${paramIndex + idx}`).join(', ')
          placeholdersList.push(`(${placeholders})`)
          valuesList.push(...values)
          paramIndex += values.length
        }

        const batchInsertSql = `
          INSERT INTO post_searchs (${allFields.join(', ')})
          VALUES ${placeholdersList.join(', ')}
          ON CONFLICT (search_num) DO NOTHING
        `

        try {
          const result = await execute(batchInsertSql, valuesList)
          inserted += result.affectedRows || 0
          console.log(`  ✓ 批量插入第 ${Math.floor(i / batchSize) + 1} 批，成功 ${result.affectedRows || 0} 条`)
        } catch (error: any) {
          console.error(`  ❌ 批量插入失败:`, error.message)
          // 如果批量插入失败，尝试逐条插入
          for (const item of batch) {
            try {
              const values: any[] = [item.shipping_num, item.ship_date, item.channel]
              if (hasOrderNum) values.push(item.order_num)
              if (hasTransferNum) values.push(item.transfer_num)
              if (hasNotes) values.push(item.notes)
              
              const singleInsertSql = `
                INSERT INTO post_searchs (${allFields.join(', ')})
                VALUES (${values.map((_, idx) => `$${idx + 1}`).join(', ')})
                ON CONFLICT (search_num) DO NOTHING
              `
              const singleResult = await execute(singleInsertSql, values)
              if (singleResult.affectedRows > 0) {
                inserted++
              } else {
                skipped++
              }
            } catch (singleError: any) {
              console.error(`  ❌ 单条插入失败 ${item.shipping_num}:`, singleError.message)
              skipped++
            }
          }
        }
      }
    }

    // 批量更新已存在的记录
    if (updateRecords.length > 0) {
      console.log(`批量更新 ${updateRecords.length} 条记录...`)
      const batchSize = 200 // 每批更新200条
      const currentDate = new Date().toISOString().split('T')[0]

      for (let i = 0; i < updateRecords.length; i += batchSize) {
        const batch = updateRecords.slice(i, i + batchSize)
        
        try {
          // 按更新类型分组：只更新转单号、只更新备注、同时更新两者
          const transferNumOnly = batch.filter(r => r.transferNumChanged && !r.notesChanged)
          const notesOnly = batch.filter(r => !r.transferNumChanged && r.notesChanged)
          const both = batch.filter(r => r.transferNumChanged && r.notesChanged)

          // 批量更新：只更新转单号
          if (transferNumOnly.length > 0 && hasTransferNum) {
            const updateData = transferNumOnly.map(({ item }) => ({
              search_num: item.shipping_num,
              transfer_num: item.transfer_num,
            }))

            const valuesList = updateData.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(', ')
            const params = updateData.flatMap(d => [d.search_num, d.transfer_num])
            
            const transferSql = `
              UPDATE post_searchs p
              SET 
                transfer_num = v.transfer_num,
                ${hasTransferDate ? 'transfer_date = CURRENT_DATE,' : ''}
                states = NULL,
                updated_at = CURRENT_TIMESTAMP
              FROM (VALUES ${valuesList}) AS v(search_num, transfer_num)
              WHERE p.search_num = v.search_num
            `
            
            const transferResult = await execute(transferSql, params)
            updated += transferResult.affectedRows || 0
            console.log(`  ✓ 批量更新转单号 ${transferResult.affectedRows || 0} 条`)
          }

          // 批量更新：只更新备注
          if (notesOnly.length > 0 && hasNotes) {
            const updateData = notesOnly.map(({ item }) => ({
              search_num: item.shipping_num,
              notes: item.notes || null,
            }))

            const valuesList = updateData.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(', ')
            const params = updateData.flatMap(d => [d.search_num, d.notes])
            
            const notesSql = `
              UPDATE post_searchs p
              SET 
                notes = v.notes,
                updated_at = CURRENT_TIMESTAMP
              FROM (VALUES ${valuesList}) AS v(search_num, notes)
              WHERE p.search_num = v.search_num
            `
            
            const notesResult = await execute(notesSql, params)
            updated += notesResult.affectedRows || 0
            console.log(`  ✓ 批量更新备注 ${notesResult.affectedRows || 0} 条`)
          }

          // 批量更新：同时更新转单号和备注
          if (both.length > 0 && hasTransferNum && hasNotes) {
            const updateData = both.map(({ item }) => ({
              search_num: item.shipping_num,
              transfer_num: item.transfer_num,
              notes: item.notes || null,
            }))

            const valuesList = updateData.map((_, idx) => `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`).join(', ')
            const params = updateData.flatMap(d => [d.search_num, d.transfer_num, d.notes])
            
            const bothSql = `
              UPDATE post_searchs p
              SET 
                transfer_num = v.transfer_num,
                ${hasTransferDate ? 'transfer_date = CURRENT_DATE,' : ''}
                states = NULL,
                notes = v.notes,
                updated_at = CURRENT_TIMESTAMP
              FROM (VALUES ${valuesList}) AS v(search_num, transfer_num, notes)
              WHERE p.search_num = v.search_num
            `
            
            const bothResult = await execute(bothSql, params)
            updated += bothResult.affectedRows || 0
            console.log(`  ✓ 批量更新转单号和备注 ${bothResult.affectedRows || 0} 条`)
          }
        } catch (error: any) {
          console.error(`  ❌ 批量更新失败:`, error.message)
          // 如果批量更新失败，尝试逐条更新
          for (const { item, transferNumChanged, notesChanged } of batch) {
            try {
              const updateFields: string[] = []
              const updateValues: any[] = []
              let paramIdx = 1

              if (transferNumChanged && hasTransferNum) {
                updateFields.push(`transfer_num = $${paramIdx}`)
                updateValues.push(item.transfer_num)
                paramIdx++
                
                if (hasTransferDate) {
                  updateFields.push(`transfer_date = $${paramIdx}`)
                  updateValues.push(currentDate)
                  paramIdx++
                }
                
                updateFields.push(`states = $${paramIdx}`)
                updateValues.push(null)
                paramIdx++
              }

              if (notesChanged && hasNotes) {
                updateFields.push(`notes = $${paramIdx}`)
                updateValues.push(item.notes || null)
                paramIdx++
              }

              if (updateFields.length > 0) {
                updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
                updateValues.push(item.shipping_num)
                
                const singleUpdateSql = `
                  UPDATE post_searchs 
                  SET ${updateFields.join(', ')}
                  WHERE search_num = $${paramIdx}
                `
                const singleResult = await execute(singleUpdateSql, updateValues)
                if (singleResult.affectedRows > 0) {
                  updated++
                } else {
                  skipped++
                }
              }
            } catch (singleError: any) {
              console.error(`  ❌ 单条更新失败 ${item.shipping_num}:`, singleError.message)
              skipped++
            }
          }
        }
      }
    }

    // 统计跳过的记录
    skipped += skipRecords.length

    return {
      success: true,
      message: `导入完成：总计 ${orderData.length} 条，新增 ${inserted} 条，更新 ${updated} 条，跳过 ${skipped} 条`,
      stats: {
        total: orderData.length,
        inserted,
        updated,
        skipped,
      },
    }
  } catch (error: any) {
    console.error('导入物流数据失败:', error)
    console.error('错误消息:', error.message)
    console.error('错误堆栈:', error.stack)
    return {
      success: false,
      error: error.message || '导入物流数据失败',
    }
  }
}

