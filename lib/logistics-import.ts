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
} as const

/**
 * 读取Excel文件数据
 */
function parseExcelFile(fileBuffer: Buffer): Array<{
  shipping_num: string
  ship_date: string | null
  channel: string | null
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

    // 解析数据
    const orderData: Array<{
      shipping_num: string
      ship_date: string | null
      channel: string | null
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

      orderData.push({
        shipping_num: shippingNum,
        ship_date: shipDate,
        channel: channel,
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

    // 简化：先使用逐条插入确保能工作，后续再优化批量插入
    let inserted = 0
    let updated = 0
    let skipped = 0

    console.log(`开始导入 ${orderData.length} 条记录...`)

    // 先批量查询哪些记录已存在（用于统计）
    const allSearchNums = orderData.map(item => item.shipping_num)
    console.log('查询已存在的记录...')
    const existingResult = await query<{ search_num: string }>(
      `SELECT search_num FROM post_searchs WHERE search_num = ANY($1::text[])`,
      [allSearchNums]
    )
    const existingSet = new Set(existingResult.map(r => r.search_num))
    console.log(`找到 ${existingSet.size} 条已存在的记录`)

    // 逐条插入（确保稳定性）
    for (let i = 0; i < orderData.length; i++) {
      const item = orderData[i]
      try {
        console.log(`[${i + 1}/${orderData.length}] 处理: ${item.shipping_num}`)

        // 检查是否有唯一约束，如果没有则先尝试添加
        // 注意：PostgreSQL 默认将字段名转换为小写
        // 如果表是用小写字段名创建的，使用 ship_date
        // 如果表是用大写字段名创建的，使用 "Ship_date"
        // 先尝试小写（PostgreSQL 默认行为）
        const sql = `
          INSERT INTO post_searchs (search_num, ship_date, channel)
          VALUES ($1, $2, $3)
          ON CONFLICT (search_num) 
          DO UPDATE SET
            ship_date = EXCLUDED.ship_date,
            channel = EXCLUDED.channel,
            updated_at = CURRENT_TIMESTAMP
        `

        console.log(`执行 SQL，参数:`, {
          search_num: item.shipping_num,
          ship_date: item.ship_date,
          channel: item.channel,
        })

        await execute(sql, [
          item.shipping_num,
          item.ship_date,
          item.channel,
        ])

        // 根据检查结果统计
        if (existingSet.has(item.shipping_num)) {
          updated++
          console.log(`✓ [${i + 1}] 更新: ${item.shipping_num}`)
        } else {
          inserted++
          console.log(`✓ [${i + 1}] 新增: ${item.shipping_num}`)
        }
      } catch (itemError: any) {
        console.error(`❌ [${i + 1}] 导入失败 ${item.shipping_num}:`, itemError)
        console.error(`错误消息: ${itemError.message}`)
        console.error(`错误代码: ${itemError.code}`)
        console.error(`错误详情:`, JSON.stringify(itemError, null, 2))
        if (itemError.stack) {
          console.error(`错误堆栈:`, itemError.stack)
        }
        skipped++
      }
    }

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

