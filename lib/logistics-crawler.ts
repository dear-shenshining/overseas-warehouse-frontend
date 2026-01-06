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
  isNotRegistered?: boolean // 标记是否为 "Not registered" 情况
}

// 批处理大小与重试策略（控制单次任务时长，避免 Vercel 300s 超时）
const BATCH_SIZE = 20 // 每批处理 20 个追踪号
const MAX_RETRIES = 3 // 减少重试次数，加快处理速度
const MAX_RETRY_DELAY_MS = 2000 // 单次重试最大等待 2s（指数退避上限）
const MAX_EXECUTION_TIME_MS = 240000 // 最大执行时间 4 分钟（240秒），留出安全余量
const SAFE_TIME_BUFFER_MS = 30000 // 安全时间缓冲 30 秒，在超时前提前返回

/**
 * 获取待查询的追踪号
 * @param sessionStartTime 本次处理会话的开始时间，只处理 updated_at < sessionStartTime 的追踪号
 */
async function fetchPendingSearchNumbers(sessionStartTime: Date): Promise<Array<{ search_num: string; states: string | null }>> {
  try {
    const sql = `
      SELECT search_num, states
      FROM post_searchs
      WHERE (states NOT IN ('Final delivery', 'Returned to sender') OR states IS NULL)
        AND (updated_at IS NULL OR updated_at < $1)
      ORDER BY updated_at ASC NULLS FIRST, id ASC
      LIMIT ${BATCH_SIZE}
    `
    const rows = await query<{ search_num: string; states: string | null }>(sql, [sessionStartTime])
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

// 注意：失败的追踪号不再更新 updated_at
// 失败的追踪号保持 updated_at 不变，这样下次还能被查询到并重试
// 只有成功处理的追踪号才会更新 updated_at（在 updateSearchState 中更新）

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

    // 检查是否为未注册的单号（按照原 Python 逻辑）
    // 原 Python 代码检查：if 'Your item was not found' in raw_html
    // 实际错误信息格式：** Your item was not found. Confirm your item number and ask at your local office.
    if (html.includes('Your item was not found')) {
      console.log(`单号未找到 ${trackingNumber}`)
      await updateSearchState(trackingNumber, 'Not registered')
      // 返回特殊标记，表示这是 "Not registered" 情况，应该计入成功
      return { history: [], isNotRegistered: true }
    }

    // 解析HTML（简化版，实际应该使用更完善的解析）
    const result = parseTrackingHTML(html)

    // 如果解析后没有历史记录，可能是未找到的情况
    // 使用 cheerio 检查表格中是否有错误信息（更精确的检查）
    if (!result.history || result.history.length === 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const cheerio = require('cheerio')
        const $ = cheerio.load(html)
        
        // 检查 summary="照会結果" 表格中是否包含错误信息
        // 错误信息在：<td colspan="5"><font color="ff0000">** Your item was not found...</font></td>
        const resultTable = $('table[summary="照会結果"]')
        if (resultTable.length > 0) {
          const errorText = resultTable.text()
          if (errorText.includes('Your item was not found')) {
            console.log(`单号未找到（通过表格检查）${trackingNumber}`)
            await updateSearchState(trackingNumber, 'Not registered')
            // 返回特殊标记，表示这是 "Not registered" 情况，应该计入成功
            return { history: [], isNotRegistered: true }
          }
        }
      } catch (e) {
        // 如果 cheerio 解析失败，忽略（可能 cheerio 未安装）
      }
    }

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
 * 处理单个追踪号（带重试逻辑）
 * 失败的单号会自动重试，直到成功为止（最多重试 maxRetries 次）
 */
async function processTrackingNumber(
  trackingNumber: string,
  maxRetries: number = MAX_RETRIES
): Promise<{ success: boolean; retries: number }> {
  let retries = 0

  while (retries < maxRetries) {
    try {
      // 爬取追踪信息
      const result = await fetchTrackingInfo(trackingNumber)

      if (result) {
        // 检查是否为 "Not registered" 情况
        if (result.isNotRegistered) {
          // "Not registered" 已经更新了 states，所以 updated_at 也已经更新
          console.log(`✅ 已处理未注册单号：${trackingNumber} (重试 ${retries} 次)`)
          return { success: true, retries }
        }

        // 正常情况：更新状态（会同时更新 updated_at）
        // 只要 states 有更新，updated_at 就会在 updateSearchState 中被更新
        let stateUpdated = false
        if (result.history && result.history.length > 0) {
          const lastRecord = result.history[result.history.length - 1]
          const shippingRecord = String(lastRecord.shipping_track_record || '')

          if (shippingRecord.includes('Final delivery')) {
            stateUpdated = await updateSearchState(trackingNumber, 'Final delivery')
          } else {
            stateUpdated = await updateSearchState(trackingNumber, shippingRecord)
          }
        } else {
          // 如果没有历史记录，可能是查询成功但没有追踪信息
          // 这种情况下不更新 states，也不更新 updated_at，保持原样以便重试
          console.log(`⚠️ 追踪号 ${trackingNumber} 查询成功但没有历史记录，将保留原 updated_at，下次继续重试`)
          retries++
          if (retries < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retries - 1), MAX_RETRY_DELAY_MS)
            await new Promise((resolve) => setTimeout(resolve, delay))
          } else {
            return { success: false, retries }
          }
          continue // 继续重试循环
        }

        // 只要 states 有更新，updated_at 就已经被更新了（在 updateSearchState 中）
        if (stateUpdated) {
          console.log(`✅ 成功处理追踪号：${trackingNumber} (重试 ${retries} 次，已更新 states 和 updated_at)`)
          return { success: true, retries }
        } else {
          // 如果更新失败（数据库错误等），不更新 updated_at，保持原样以便重试
          console.log(`⚠️ 追踪号 ${trackingNumber} 查询成功但更新 states 失败，将保留原 updated_at，下次继续重试`)
          retries++
          if (retries < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retries - 1), MAX_RETRY_DELAY_MS)
            await new Promise((resolve) => setTimeout(resolve, delay))
          } else {
            return { success: false, retries }
          }
        }
      } else {
        // 失败情况，准备重试
        retries++
        if (retries < maxRetries) {
          console.log(`⚠️ 追踪号 ${trackingNumber} 处理失败，准备重试 (${retries}/${maxRetries})...`)
          // 重试前等待，延迟时间逐渐增加（指数退避）
          const delay = Math.min(1000 * Math.pow(2, retries - 1), MAX_RETRY_DELAY_MS)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    } catch (error: any) {
      // 异常情况，准备重试
      retries++
      if (retries < maxRetries) {
        console.error(`⚠️ 处理追踪号失败 ${trackingNumber} (重试 ${retries}/${maxRetries}):`, error.message)
        // 重试前等待，延迟时间逐渐增加（指数退避）
        const delay = Math.min(1000 * Math.pow(2, retries - 1), MAX_RETRY_DELAY_MS)
        await new Promise((resolve) => setTimeout(resolve, delay))
      } else {
        console.error(`❌ 追踪号 ${trackingNumber} 重试 ${maxRetries} 次后仍失败:`, error.message)
        return { success: false, retries }
      }
    }
  }

  // 达到最大重试次数仍失败
  console.error(`❌ 追踪号 ${trackingNumber} 达到最大重试次数 (${maxRetries}) 仍失败`)
  return { success: false, retries }
}

/**
 * 处理一批追踪号（最多 BATCH_SIZE 个）
 */
async function processBatch(
  batch: Array<{ search_num: string; states: string | null }>,
  stats: { success: number; failed: number; skipped: number; totalRetries: number }
): Promise<Array<{ search_num: string; states: string | null }>> {
  const failedItems: Array<{ search_num: string; states: string | null }> = []

  for (const item of batch) {
    const trackingNumber = item.search_num
    const states = item.states

    // 跳过已完成的单号
    if (states === 'Final delivery' || states === 'Returned to sender') {
      stats.skipped++
      console.log(`⏭️ 跳过已完成单号：${trackingNumber} (状态: ${states})`)
      continue
    }

    console.log(`\n正在处理追踪号：${trackingNumber}`)
    console.log('-'.repeat(50))

    // 处理追踪号（带重试逻辑，最多重试 MAX_RETRIES 次）
    const result = await processTrackingNumber(trackingNumber)
    stats.totalRetries += result.retries

    if (result.success) {
      stats.success++
      // 只有成功处理的追踪号才更新 updated_at
      // 失败的追踪号保持 updated_at 不变，这样下次还能被查询到并重试
    } else {
      stats.failed++
      console.error(`❌ 追踪号 ${trackingNumber} 最终处理失败，将保留原 updated_at，下次继续重试`)
      // 失败的追踪号不更新 updated_at，保持原样
      // 这样它们下次还能被查询到（因为 updated_at < sessionStartTime 仍然满足）
      // 可以继续重试，直到成功或达到最大重试次数
      failedItems.push(item)
    }

    // 添加延迟，避免请求过快
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return failedItems
}

/**
 * 检查是否还有足够时间继续处理
 */
function hasEnoughTime(startTime: number): boolean {
  const elapsed = Date.now() - startTime
  const remaining = MAX_EXECUTION_TIME_MS - elapsed
  return remaining > SAFE_TIME_BUFFER_MS
}

/**
 * 运行爬虫主函数（自动分批处理，带超时保护）
 * 点一次"更新"按钮，自动分批处理完所有追踪号，直到超时或全部完成
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
    retries: number
    batches: number
    hasMore: boolean // 是否还有更多待处理的追踪号
  }
}> {
  const startTime = Date.now()
  // 记录本次处理会话的开始时间，确保本次调用中每个追踪号只处理一次
  const sessionStartTime = new Date()
  
  try {
    const stats = {
      success: 0,
      failed: 0,
      skipped: 0,
      totalRetries: 0,
    }
    let totalProcessed = 0
    let batchCount = 0
    const processedSet = new Set<string>() // 记录本次会话中已处理的追踪号，防止重复

    console.log(`📋 开始自动分批处理追踪号（每批 ${BATCH_SIZE} 个，最大执行时间 ${MAX_EXECUTION_TIME_MS / 1000} 秒）...`)
    console.log(`📅 本次会话开始时间：${sessionStartTime.toISOString()}`)
    console.log('='.repeat(60))

    // 自动分批处理循环
    while (hasEnoughTime(startTime)) {
      batchCount++
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`\n🔄 开始处理第 ${batchCount} 批（已用时 ${elapsed} 秒）...`)
      console.log('-'.repeat(60))

      // 获取待查询的追踪号（只处理 updated_at < sessionStartTime 的追踪号，确保本次会话中每个只处理一次）
      const trackingNumbers = await fetchPendingSearchNumbers(sessionStartTime)
      
      console.log(`📥 获取到 ${trackingNumbers.length} 个待查询的追踪号`)

      if (trackingNumbers.length === 0) {
        console.log('✅ 没有更多待查询的追踪号')
        break
      }

      // 过滤掉本次会话中已处理的追踪号（双重保险）
      const newItems = trackingNumbers.filter(
        (item) => !processedSet.has(item.search_num)
      )
      
      if (newItems.length === 0) {
        console.log('⚠️ 本批次所有追踪号都已在本会话中处理过，跳过')
        // 如果所有追踪号都已处理过，说明本次会话的所有追踪号都已处理完
        // 检查是否还有新的追踪号（不在 processedSet 中的）
        const processedArray = Array.from(processedSet)
        const remainingCheck = await query<{ count: number }>(`
          SELECT COUNT(*) as count
          FROM post_searchs
          WHERE (states NOT IN ('Final delivery', 'Returned to sender') OR states IS NULL)
            AND (updated_at IS NULL OR updated_at < $1)
            AND search_num != ALL($2::text[])
        `, [sessionStartTime, processedArray])
        const remainingCount = remainingCheck[0]?.count || 0
        
        if (remainingCount === 0) {
          console.log('✅ 本次会话的所有追踪号都已处理完成')
          break
        } else {
          console.log(`ℹ️ 还有 ${remainingCount} 个新的追踪号待处理，继续下一批...`)
          // 继续循环，尝试获取新的追踪号
          await new Promise((resolve) => setTimeout(resolve, 1000))
          continue
        }
      }

      console.log(`🔍 过滤后，有 ${newItems.length} 个新追踪号需要处理（已在本会话处理 ${processedSet.size} 个）`)

      // 处理本批次
      const failedItems = await processBatch(newItems, stats)
      
      // 记录本次会话中已处理的追踪号（包括跳过的）
      newItems.forEach((item) => processedSet.add(item.search_num))
      
      // 只统计实际处理的追踪号（成功 + 失败），不包括跳过的
      // stats.success + stats.failed 才是实际处理的追踪号数量
      const actuallyProcessed = stats.success + stats.failed
      totalProcessed = actuallyProcessed

      const batchElapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(
        `\n📊 第 ${batchCount} 批完成：处理 ${newItems.length} 个，成功 ${stats.success}，失败 ${failedItems.length}，跳过 ${stats.skipped}（总耗时 ${batchElapsed} 秒）`
      )

      // 检查是否还有时间继续处理下一批
      if (!hasEnoughTime(startTime)) {
        // 检查还有多少待处理的追踪号（updated_at < sessionStartTime）
        // 但是要排除已经在本次会话中处理过的（即使失败了，也已经尝试过了）
        const processedArray = Array.from(processedSet)
        const remainingCheck = await query<{ count: number }>(`
          SELECT COUNT(*) as count
          FROM post_searchs
          WHERE (states NOT IN ('Final delivery', 'Returned to sender') OR states IS NULL)
            AND (updated_at IS NULL OR updated_at < $1)
            AND search_num != ALL($2::text[])
        `, [sessionStartTime, processedArray])
        const remainingCount = remainingCheck[0]?.count || 0
        
        console.log(`⏰ 接近超时限制，提前返回。还有约 ${remainingCount} 个待处理的追踪号（已在本会话处理 ${processedSet.size} 个）`)
        
        return {
          success: true,
          message: `本轮处理完成（接近超时限制）：已处理 ${totalProcessed} 个，成功 ${stats.success} 个，失败 ${stats.failed} 个，跳过 ${stats.skipped} 个，总重试 ${stats.totalRetries} 次，共 ${batchCount} 个批次`,
          stats: {
            total: totalProcessed,
            success: stats.success,
            failed: stats.failed,
            skipped: stats.skipped,
            retries: stats.totalRetries,
            batches: batchCount,
            hasMore: remainingCount > 0,
          },
        }
      }

      // 批次间短暂延迟，避免数据库压力过大
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    // 检查是否还有更多待处理的追踪号
    // 关键：排除已经在本次会话中处理过的追踪号（即使失败了，也已经尝试过了）
    // 如果所有待处理的追踪号都已经在本会话中处理过，hasMore = false
    let remainingCount = 0
    if (processedSet.size > 0) {
      // 使用 ANY 数组查询，避免 SQL 注入和参数过多的问题
      const processedArray = Array.from(processedSet)
      const remainingCheck = await query<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM post_searchs
        WHERE (states NOT IN ('Final delivery', 'Returned to sender') OR states IS NULL)
          AND (updated_at IS NULL OR updated_at < $1)
          AND search_num != ALL($2::text[])
      `, [sessionStartTime, processedArray])
      remainingCount = remainingCheck[0]?.count || 0
    } else {
      // 如果没有处理过任何追踪号，检查所有待处理的
      const remainingCheck = await query<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM post_searchs
        WHERE (states NOT IN ('Final delivery', 'Returned to sender') OR states IS NULL)
          AND (updated_at IS NULL OR updated_at < $1)
      `, [sessionStartTime])
      remainingCount = remainingCheck[0]?.count || 0
    }
    const hasMore = remainingCount > 0
    
    console.log(`📊 统计：已在本会话处理 ${processedSet.size} 个，还有 ${remainingCount} 个新的待处理追踪号`)

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log('\n' + '='.repeat(60))
    console.log(`📊 爬虫执行完成（总耗时 ${executionTime} 秒）`)
    
    if (hasMore) {
      console.log(`ℹ️ 还有约 ${remainingCount} 个待处理的追踪号，可以再次点击"更新"按钮继续处理`)
    } else {
      console.log('✅ 所有追踪号已处理完成')
    }

    const message = hasMore
      ? `本轮处理完成：已处理 ${totalProcessed} 个，成功 ${stats.success} 个，失败 ${stats.failed} 个，跳过 ${stats.skipped} 个，总重试 ${stats.totalRetries} 次，共 ${batchCount} 个批次`
      : `处理完成：已处理 ${totalProcessed} 个，成功 ${stats.success} 个，失败 ${stats.failed} 个，跳过 ${stats.skipped} 个，总重试 ${stats.totalRetries} 次，共 ${batchCount} 个批次。所有追踪号已处理完成`

    return {
      success: true,
      message,
      stats: {
        total: totalProcessed,
        success: stats.success,
        failed: stats.failed,
        skipped: stats.skipped,
        retries: stats.totalRetries,
        batches: batchCount,
        hasMore,
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

