/**
 * 日本邮政追踪信息爬虫
 * 从 post_searchs 表读取待查询单号，爬取状态并更新数据库
 */

import { query, execute } from './db'

interface TrackingHistory {
  date: string
  shipping_track_record: string
  details: string
  office: string
  zip_code: string
  prefecture: string
}

interface TrackingResult {
  history: TrackingHistory[]
}

/**
 * 获取待查询的追踪号
 */
async function fetchPendingSearchNumbers(): Promise<Array<{ search_num: string; states: string | null }>> {
  try {
    const sql = `
      SELECT search_num, states
      FROM post_searchs
      WHERE states NOT IN ('Final delivery', 'Returned to sender')
         OR states IS NULL
    `
    const rows = await query<{ search_num: string; states: string | null }>(sql)
    return rows
  } catch (error) {
    console.error('获取待查询追踪号失败:', error)
    return []
  }
}

/**
 * 更新 post_searchs 表的状态
 * 按照原 Python 逻辑：更新 states 字段，同时更新 updated_at 时间戳
 */
async function updateSearchState(searchNum: string, newState: string): Promise<boolean> {
  try {
    const sql = `
      UPDATE post_searchs 
      SET states = $1, updated_at = CURRENT_TIMESTAMP
      WHERE search_num = $2
    `
    await execute(sql, [newState, searchNum])
    console.log(`已更新 ${searchNum} 状态为 ${newState}`)
    return true
  } catch (error) {
    console.error(`更新状态失败 ${searchNum}:`, error)
    return false
  }
}

/**
 * 保存追踪历史记录到数据库
 */
async function saveTrackingHistory(trackingNumber: string, data: TrackingResult): Promise<boolean> {
  try {
    if (!data.history || data.history.length === 0) {
      return true
    }

    for (const history of data.history) {
      const sql = `
        INSERT INTO tracking_history 
        (item_number, date, shipping_track_record, details, office, zip_code, prefecture)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `
      await execute(sql, [
        trackingNumber,
        history.date || '',
        history.shipping_track_record || '',
        history.details || '',
        history.office || '',
        history.zip_code || '',
        history.prefecture || '',
      ])
    }

    return true
  } catch (error) {
    console.error(`保存追踪历史失败 ${trackingNumber}:`, error)
    return false
  }
}

/**
 * 爬取日本邮政追踪信息
 */
async function fetchTrackingInfo(trackingNumber: string): Promise<TrackingResult | null> {
  try {
    const baseUrl = 'https://trackings.post.japanpost.jp/services/srv/search/direct'
    const params = new URLSearchParams({
      searchKind: 'S004',
      locale: 'en',
      reqCodeNo1: trackingNumber,
      x: '29',
      y: '9',
    })

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      next: { revalidate: 0 }, // 不缓存
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()

    // 检查是否为未注册的单号
    if (html.includes('Your item was not found')) {
      await updateSearchState(trackingNumber, 'Not registered')
      return null
    }

    // 解析HTML（简化版，实际应该使用更完善的解析）
    const result = parseTrackingHTML(html)

    return result
  } catch (error) {
    console.error(`爬取追踪信息失败 ${trackingNumber}:`, error)
    return null
  }
}

/**
 * 解析HTML内容，提取追踪信息
 * 按照原 Python 逻辑：使用 cheerio 精确解析 HTML 表格
 * 注意：需要先安装 cheerio: npm install cheerio @types/cheerio
 */
function parseTrackingHTML(html: string): TrackingResult {
  const result: TrackingResult = {
    history: [],
  }

  try {
    // 使用 cheerio 解析 HTML（需要先安装：npm install cheerio @types/cheerio）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cheerio = require('cheerio')
    const $ = cheerio.load(html)

    // 提取历史信息 - 查找 summary='履歴情報' 的表格（与原 Python 逻辑一致）
    // 表格结构：
    // - 表头：两行（Date, Shipping track record, Details, Office, Prefecture | ZIP code）
    // - 数据：每两条 tr 为一组（第一行：date, track_record, details, office, prefecture | 第二行：zip_code）
    const historyTable = $('table[summary="履歴情報"]')
    
    if (historyTable.length > 0) {
      const rows = historyTable.find('tr').toArray()
      let i = 2 // 跳过表头行（前两行，与原 Python 逻辑一致）

      while (i < rows.length) {
        const row = $(rows[i])
        const cells = row.find('td, th').toArray()

        // 检查是否是数据行（不是表头，且至少有5个单元格）
        // 数据行的第一个单元格（Date）应该有 rowspan="2"
        if (cells.length >= 5) {
          const dateCell = $(cells[0])
          const date = dateCell.text().trim()

          // 获取 rowspan 值（Date 列应该有 rowspan="2"）
          const rowspan = parseInt(dateCell.attr('rowspan') || '1', 10)

          if (rowspan === 2) {
            // 这是数据行的第一行，包含：
            // cells[0]: Date (rowspan=2)
            // cells[1]: Shipping track record (rowspan=2) - 这是我们要的状态字段！
            // cells[2]: Details (rowspan=2)
            // cells[3]: Office
            // cells[4]: Prefecture (rowspan=2)
            const trackRecord = $(cells[1]).text().trim() // shipping_track_record - 正确的状态字段
            const details = $(cells[2]).text().trim() // details
            const office = $(cells[3]).text().trim() // office
            const prefecture = $(cells[4]).text().trim() // prefecture

            // 下一行（i+1）是邮编行，只包含 ZIP code
            let zipCode = ''
            if (i + 1 < rows.length) {
              const nextRow = $(rows[i + 1])
              const zipCells = nextRow.find('td').toArray()
              // 下一行的第一个 td 就是 ZIP code
              zipCode = zipCells.length > 0 ? $(zipCells[0]).text().trim() : ''
            }

            result.history.push({
              date,
              shipping_track_record: trackRecord, // 正确提取状态字段
              details,
              office,
              zip_code: zipCode,
              prefecture,
            })

            i += 2 // 跳过两行（数据行 + 邮编行）
          } else {
            // 不是数据行，跳过
            i += 1
          }
        } else {
          // 单元格数量不足，跳过
          i += 1
        }
      }
    }
  } catch (error: any) {
    // 如果 cheerio 未安装，会在这里捕获错误
    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('cheerio')) {
      console.error('❌ 请先安装 cheerio 库: npm install cheerio @types/cheerio')
      throw new Error('需要安装 cheerio 库来解析 HTML。请运行: npm install cheerio @types/cheerio')
    }
    console.error('解析 HTML 失败:', error)
  }

  return result
}

/**
 * 运行爬虫主函数
 */
export async function runCrawler(): Promise<{
  success: boolean
  message?: string
  error?: string
  stats?: {
    total: number
    success: number
    failed: number
    skipped: number
  }
}> {
  try {
    // 获取待查询的追踪号
    const trackingNumbers = await fetchPendingSearchNumbers()

    if (trackingNumbers.length === 0) {
      return {
        success: true,
        message: '没有待查询的追踪号',
        stats: {
          total: 0,
          success: 0,
          failed: 0,
          skipped: 0,
        },
      }
    }

    let success = 0
    let failed = 0
    let skipped = 0

    for (const item of trackingNumbers) {
      const trackingNumber = item.search_num
      const states = item.states

      // 跳过已完成的单号
      if (states === 'Final delivery' || states === 'Returned to sender') {
        skipped++
        continue
      }

      try {
        // 爬取追踪信息
        const result = await fetchTrackingInfo(trackingNumber)

        if (result) {
          // 保存历史记录
          await saveTrackingHistory(trackingNumber, result)

          // 检查最后一条记录的状态并更新（按照原 Python 逻辑）
          if (result.history && result.history.length > 0) {
            const lastRecord = result.history[result.history.length - 1]
            const shippingRecord = String(lastRecord.shipping_track_record || '')

            // 按照原 Python 逻辑：
            // 1. 如果包含 "Final delivery"，设置为 "Final delivery"
            // 2. 其他情况如实写入该值（包括 "Returned to sender" 也会如实写入）
            if (shippingRecord.includes('Final delivery')) {
              await updateSearchState(trackingNumber, 'Final delivery')
            } else {
              // 其他情况如实写入该值（包括 Returned to sender 等）
              await updateSearchState(trackingNumber, shippingRecord)
            }
          }

          success++
        } else {
          // 可能是未注册的单号，已经在 fetchTrackingInfo 中处理
          failed++
        }
      } catch (error: any) {
        console.error(`处理追踪号失败 ${trackingNumber}:`, error)
        failed++
      }

      // 添加延迟，避免请求过快
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return {
      success: true,
      message: `爬虫执行完成：总计 ${trackingNumbers.length} 个，成功 ${success} 个，失败 ${failed} 个，跳过 ${skipped} 个`,
      stats: {
        total: trackingNumbers.length,
        success,
        failed,
        skipped,
      },
    }
  } catch (error: any) {
    console.error('运行爬虫失败:', error)
    return {
      success: false,
      error: error.message || '运行爬虫失败',
    }
  }
}

