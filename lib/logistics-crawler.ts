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

  // 配置参数
const BATCH_SIZE = 50 // 每批处理 50 个追踪号
const MAX_EXECUTION_TIME_MS = 240000 // 最大执行时间 4 分钟（240秒），留出安全余量
const SAFE_TIME_BUFFER_MS = 30000 // 安全时间缓冲 30 秒，在超时前提前返回

/**
 * 获取待查询的追踪号
 * 从指定的起始id开始，按 id ASC 排序，获取一批需要处理的追踪号
 * 同时返回当前所有待处理单号的最大ID
 */
async function fetchPendingSearchNumbers(
  startId: number = 0, 
  batchSize: number = 50,
  filters?: {
    statusFilter?: 'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | 'not_queried' | 'delivered' | 'total' | 'has_transfer'
    dateFrom?: string
    dateTo?: string
    searchNums?: string[]
    hasTransferFilter?: boolean
    updatedAtToday?: boolean
  }
): Promise<{
  items: Array<{ id: number; search_num: string; states: string | null }>
  maxId: number
}> {
  try {
    // 构建基础WHERE条件
    let whereConditions = ['id > $1']
    const params: any[] = [startId]
    let paramIndex = 2

    // 应用状态筛选
    if (filters?.statusFilter) {
      const statusFilter = filters.statusFilter
      if (statusFilter === 'returned') {
        whereConditions.push(`states IN ('Returned to Sender', '退回', '异常', '退回/异常', 'Office closed. Retention.', 'Absence. Attempted delivery.')`)
      } else if (statusFilter === 'not_online') {
        whereConditions.push(`states IN ('Not registered', '未上网')`)
      } else if (statusFilter === 'online_abnormal') {
        // 上网异常：未上网且（有转单号用转单日期，无转单号用发货日期）距今超过3天
        whereConditions.push(`states IN ('Not registered', '未上网')`)
        whereConditions.push(`(
          (transfer_num IS NOT NULL AND transfer_num != '' AND transfer_date IS NOT NULL AND EXTRACT(DAY FROM (CURRENT_DATE - transfer_date))::INTEGER >= 3)
          OR
          ((transfer_num IS NULL OR transfer_num = '') AND ship_date IS NOT NULL AND EXTRACT(DAY FROM (CURRENT_DATE - ship_date))::INTEGER >= 3)
        )`)
      } else if (statusFilter === 'in_transit') {
        whereConditions.push(`states NOT IN ('Final delivery', 'Returned to Sender', 'Not registered', '退回', '异常', '退回/异常', '未上网', 'Office closed. Retention.', 'Absence. Attempted delivery.')`)
      } else if (statusFilter === 'not_queried') {
        whereConditions.push(`(states IS NULL OR states = '')`)
      } else if (statusFilter === 'delivered') {
        whereConditions.push(`states = 'Final delivery'`)
      }
      // statusFilter === 'total' 时不添加任何状态筛选条件，显示全量数据
      // statusFilter === 'has_transfer' 时只显示转单数据，不添加状态筛选
    } else {
      // 如果没有指定状态筛选，默认排除已完成和退回的状态（爬虫只处理待处理的）
      whereConditions.push(`(states NOT IN ('Final delivery', 'Returned to sender') OR states IS NULL)`)
    }

    // 转单筛选（可以与状态筛选组合使用）
    if (filters?.hasTransferFilter || filters?.statusFilter === 'has_transfer') {
      whereConditions.push(`transfer_num IS NOT NULL AND transfer_num != ''`)
    }

    // 应用日期筛选
    if (filters?.dateFrom && filters.dateFrom.trim()) {
      whereConditions.push(`ship_date >= $${paramIndex}::date`)
      params.push(filters.dateFrom)
      paramIndex++
    }
    if (filters?.dateTo && filters.dateTo.trim()) {
      whereConditions.push(`ship_date <= ($${paramIndex}::date + INTERVAL '1 day' - INTERVAL '1 second')`)
      params.push(filters.dateTo)
      paramIndex++
    }

    // 应用货运单号筛选（支持同时查询 po单号、发货单号、转单号）
    if (filters?.searchNums && filters.searchNums.length > 0) {
      // 检查字段是否存在
      const { getLogisticsFields } = await import('./logistics-field-cache')
      const { hasTransferNum, hasOrderNum } = await getLogisticsFields()
      
      const placeholders = filters.searchNums.map((_, i) => `$${paramIndex + i}`).join(',')
      const conditions: string[] = []
      
      // 发货单号（search_num）总是存在
      conditions.push(`search_num IN (${placeholders})`)
      
      // 转单号（transfer_num）- 优先查询转单号
      if (hasTransferNum) {
        conditions.push(`transfer_num IN (${placeholders})`)
      }
      
      // 订单号（order_num）
      if (hasOrderNum) {
        conditions.push(`order_num IN (${placeholders})`)
      }
      
      // 使用 OR 连接，只要匹配任意一个字段即可
      whereConditions.push(`(${conditions.join(' OR ')})`)
      params.push(...filters.searchNums)
      paramIndex += filters.searchNums.length
    }

    // 应用更新时间筛选（今天更新的数据）
    if (filters?.updatedAtToday) {
      whereConditions.push(`DATE(updated_at) = CURRENT_DATE`)
    }

    const whereClause = whereConditions.join(' AND ')
    const sql = `
      SELECT id, search_num, states
      FROM post_searchs
      WHERE ${whereClause}
      ORDER BY id ASC
      LIMIT $${paramIndex}
    `
    params.push(batchSize)

    const rows = await query<{ id: number; search_num: string; states: string | null }>(sql, params)

    // 查询符合条件的最大ID（移除 id > $1 和 LIMIT 条件）
    const maxIdWhereConditions = whereConditions.filter(c => !c.includes('id >')).join(' AND ')
    const maxIdParams: any[] = []
    let maxIdParamIndex = 1
    
    // 重新构建参数（排除 startId，但保留其他筛选条件）
    const maxIdWhereWithParams: string[] = []
    if (filters?.statusFilter) {
      const statusFilter = filters.statusFilter
      if (statusFilter === 'returned') {
        maxIdWhereWithParams.push(`states IN ('Returned to Sender', '退回', '异常', '退回/异常', 'Office closed. Retention.', 'Absence. Attempted delivery.')`)
      } else if (statusFilter === 'not_online') {
        maxIdWhereWithParams.push(`states IN ('Not registered', '未上网')`)
      } else if (statusFilter === 'online_abnormal') {
        // 上网异常：未上网且（有转单号用转单日期，无转单号用发货日期）距今超过3天
        maxIdWhereWithParams.push(`states IN ('Not registered', '未上网')`)
        maxIdWhereWithParams.push(`(
          (transfer_num IS NOT NULL AND transfer_num != '' AND transfer_date IS NOT NULL AND EXTRACT(DAY FROM (CURRENT_DATE - transfer_date))::INTEGER >= 3)
          OR
          ((transfer_num IS NULL OR transfer_num = '') AND ship_date IS NOT NULL AND EXTRACT(DAY FROM (CURRENT_DATE - ship_date))::INTEGER >= 3)
        )`)
      } else if (statusFilter === 'in_transit') {
        maxIdWhereWithParams.push(`states NOT IN ('Final delivery', 'Returned to Sender', 'Not registered', '退回', '异常', '退回/异常', '未上网', 'Office closed. Retention.', 'Absence. Attempted delivery.')`)
      } else if (statusFilter === 'not_queried') {
        maxIdWhereWithParams.push(`(states IS NULL OR states = '')`)
      } else if (statusFilter === 'delivered') {
        maxIdWhereWithParams.push(`states = 'Final delivery'`)
      }
      // statusFilter === 'total' 时不添加任何状态筛选条件，显示全量数据
      // statusFilter === 'has_transfer' 时只显示转单数据，不添加状态筛选
    } else {
      // 如果没有指定状态筛选，默认排除已完成和退回的状态
      maxIdWhereWithParams.push(`(states NOT IN ('Final delivery', 'Returned to sender') OR states IS NULL)`)
    }
    
    // 转单筛选（可以与状态筛选组合使用）
    if (filters?.hasTransferFilter || filters?.statusFilter === 'has_transfer') {
      maxIdWhereWithParams.push(`transfer_num IS NOT NULL AND transfer_num != ''`)
    }
    
    if (filters?.dateFrom && filters.dateFrom.trim()) {
      maxIdWhereWithParams.push(`ship_date >= $${maxIdParamIndex}::date`)
      maxIdParams.push(filters.dateFrom)
      maxIdParamIndex++
    }
    if (filters?.dateTo && filters.dateTo.trim()) {
      maxIdWhereWithParams.push(`ship_date <= ($${maxIdParamIndex}::date + INTERVAL '1 day' - INTERVAL '1 second')`)
      maxIdParams.push(filters.dateTo)
      maxIdParamIndex++
    }
    if (filters?.searchNums && filters.searchNums.length > 0) {
      // 检查字段是否存在（与上面的查询保持一致）
      const { getLogisticsFields } = await import('./logistics-field-cache')
      const { hasTransferNum, hasOrderNum } = await getLogisticsFields()
      
      const placeholders = filters.searchNums.map((_, i) => `$${maxIdParamIndex + i}`).join(',')
      const conditions: string[] = []
      
      // 发货单号（search_num）总是存在
      conditions.push(`search_num IN (${placeholders})`)
      
      // 转单号（transfer_num）- 优先查询转单号
      if (hasTransferNum) {
        conditions.push(`transfer_num IN (${placeholders})`)
      }
      
      // 订单号（order_num）
      if (hasOrderNum) {
        conditions.push(`order_num IN (${placeholders})`)
      }
      
      // 使用 OR 连接，只要匹配任意一个字段即可
      maxIdWhereWithParams.push(`(${conditions.join(' OR ')})`)
      maxIdParams.push(...filters.searchNums)
    }
    if (filters?.updatedAtToday) {
      maxIdWhereWithParams.push(`DATE(updated_at) = CURRENT_DATE`)
    }
    
    const maxIdQuery = await query<{ max_id: number }>(`
      SELECT MAX(id) as max_id
      FROM post_searchs
      WHERE ${maxIdWhereWithParams.join(' AND ')}
    `, maxIdParams)

    const maxId = maxIdQuery[0]?.max_id || 0

    console.log(`✅ 从ID ${startId} 开始查询到 ${rows.length} 个待处理的追踪号，待处理单号最大ID: ${maxId}`)
    return { items: rows, maxId }
  } catch (error) {
    console.error('获取待查询追踪号失败:', error)
    return { items: [], maxId: 0 }
  }
}

/**
 * 更新 post_searchs 表的状态
 * 如果 newState 为 null，只更新 updated_at 时间戳
 * 否则只在状态真正改变时才更新 states 和 updated_at
 */
async function updateSearchState(searchNum: string, newState: string | null): Promise<boolean> {
  try {
    // 先查询当前状态，用于调试和比较
    const currentState = await query<{ states: string | null; updated_at: Date | null }>(
      `SELECT states, updated_at FROM post_searchs WHERE search_num = $1`,
      [searchNum]
    )

    if (currentState.length === 0) {
      console.warn(`⚠️ 未找到追踪号 ${searchNum}，无法更新状态`)
      return false
    }

    const oldState = currentState[0].states
    const oldUpdatedAt = currentState[0].updated_at

    // 如果 newState 不为 null，检查状态是否真的改变了
    if (newState !== null) {
      // 比较状态是否相同（考虑 NULL 的情况）
      const stateChanged = oldState !== newState || (oldState === null && newState !== null) || (oldState !== null && newState === null)
      
      if (!stateChanged) {
        // 状态没有改变，不更新 updated_at
        console.log(`⏭️ 追踪号 ${searchNum} 状态未改变（${oldState}），跳过更新 updated_at`)
        return true // 返回成功，但不更新数据库
      }
    }

    let sql: string
    let params: any[]

    if (newState === null) {
      // 只更新时间戳（用于标记已查询但无历史记录的情况）
      sql = `
        UPDATE post_searchs
        SET updated_at = CURRENT_TIMESTAMP
        WHERE search_num = $1
      `
      params = [searchNum]
    } else {
      // 更新状态和时间戳（状态已确认改变）
      sql = `
        UPDATE post_searchs
        SET states = $1, updated_at = CURRENT_TIMESTAMP
        WHERE search_num = $2
      `
      params = [newState, searchNum]
    }

    const result = await execute(sql, params)

    // 检查是否真的更新了记录
    if (result.affectedRows > 0) {
      // 验证更新是否成功
      const updatedState = await query<{ states: string | null; updated_at: Date | null }>(
        `SELECT states, updated_at FROM post_searchs WHERE search_num = $1`,
        [searchNum]
      )

      if (updatedState.length > 0) {
        const newStateValue = updatedState[0].states
        const newUpdatedAt = updatedState[0].updated_at

        if (newState === null) {
          console.log(`✅ 已更新 ${searchNum} 时间戳: updated_at ${oldUpdatedAt} -> ${newUpdatedAt}`)
        } else {
          console.log(`✅ 已更新 ${searchNum}: states "${oldState}" -> "${newStateValue}", updated_at ${oldUpdatedAt} -> ${newUpdatedAt}`)
        }

        // 验证 updated_at 是否真的更新了
        if (newUpdatedAt && oldUpdatedAt && newUpdatedAt <= oldUpdatedAt) {
          console.warn(`⚠️ 警告：${searchNum} 的 updated_at 可能没有更新（新值 ${newUpdatedAt} <= 旧值 ${oldUpdatedAt}）`)
        }
      }

      return true
    } else {
      console.warn(`⚠️ 更新 ${searchNum} 失败：affectedRows = 0`)
      return false
    }
  } catch (error) {
    console.error(`❌ 更新失败 ${searchNum}:`, error)
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
 * 处理单个追踪号
 * 不再重试，每个追踪号只处理一次
 * 如果有转单号，只爬转单号，不爬原始单号
 */
async function processTrackingNumber(trackingNumber: string): Promise<{ success: boolean }> {
  try {
    // 先检查是否有转单号
    const transferNumResult = await query<{ transfer_num: string | null }>(
      `SELECT transfer_num FROM post_searchs WHERE search_num = $1 AND transfer_num IS NOT NULL AND transfer_num != ''`,
      [trackingNumber]
    )

    // 如果有转单号，只爬转单号
    if (transferNumResult.length > 0 && transferNumResult[0].transfer_num) {
      const transferNum = transferNumResult[0].transfer_num
      console.log(`📦 原始单号 ${trackingNumber} 有转单号 ${transferNum}，只查询转单号状态`)
      
      const transferResult = await fetchTrackingInfo(transferNum)
      if (transferResult) {
        // 转单号查询成功，用转单号的状态更新原始单号
        if (transferResult.isNotRegistered) {
          // 转单号未注册，更新原始单号的状态为 Not registered
          console.log(`✅ 转单号 ${transferNum} 未注册，更新原始单号 ${trackingNumber} 的状态为 Not registered`)
          await updateSearchState(trackingNumber, 'Not registered')
          return { success: true }
        } else if (transferResult.history && transferResult.history.length > 0) {
          // 转单号有状态更新，用转单号的状态更新原始单号
          const lastRecord = transferResult.history[transferResult.history.length - 1]
          const shippingRecord = String(lastRecord.shipping_track_record || '')
          let stateToUpdate = shippingRecord
          if (shippingRecord.includes('Final delivery')) {
            stateToUpdate = 'Final delivery'
          }
          console.log(`✅ 转单号 ${transferNum} 状态更新为 ${stateToUpdate}，更新原始单号 ${trackingNumber} 的状态`)
          await updateSearchState(trackingNumber, stateToUpdate)
          return { success: true }
        } else {
          // 转单号查询成功但没有历史记录，更新原始单号的 updated_at
          console.log(`⚠️ 转单号 ${transferNum} 查询成功但没有历史记录，更新原始单号 ${trackingNumber} 的 updated_at`)
          await updateSearchState(trackingNumber, null) // 只更新时间戳
          return { success: true }
        }
      } else {
        // 转单号查询失败
        console.log(`❌ 转单号 ${transferNum} 查询失败`)
        return { success: false }
      }
    }

    // 没有转单号，爬取原始单号的追踪信息
    const result = await fetchTrackingInfo(trackingNumber)

    if (result) {
      // 检查是否为 "Not registered" 情况
      if (result.isNotRegistered) {
        // "Not registered" 已经更新了 states，所以 updated_at 也已经更新
        console.log(`✅ 已处理未注册单号：${trackingNumber}`)
        return { success: true }
      }

      // 正常情况：更新状态（会同时更新 updated_at）
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
        // 如果没有历史记录，标记为查询成功但无数据
        // 仍然更新 updated_at，避免重复处理
        console.log(`⚠️ 追踪号 ${trackingNumber} 查询成功但没有历史记录`)
        // 对于这种情况，我们也更新 updated_at，但不改变 states
        await updateSearchState(trackingNumber, null) // 传递 null 表示只更新时间戳
      }

      // 只要 states 有更新，updated_at 就已经被更新了
      if (stateUpdated !== false) { // 注意：stateUpdated 可能是 true 或 undefined（时间戳更新）
        console.log(`✅ 成功处理追踪号：${trackingNumber}`)
        return { success: true }
      } else {
        console.log(`⚠️ 追踪号 ${trackingNumber} 更新失败`)
        return { success: false }
      }
    } else {
      // 查询失败的情况
      console.log(`❌ 追踪号 ${trackingNumber} 查询失败`)
      return { success: false }
    }
  } catch (error: any) {
    console.error(`❌ 处理追踪号异常 ${trackingNumber}:`, error.message)
    return { success: false }
  }
}

/**
 * 处理一批追踪号
 */
async function processBatch(
  batch: Array<{ id: number; search_num: string; states: string | null }>,
  stats: { success: number; failed: number; skipped: number }
): Promise<void> {
  for (const item of batch) {
    const trackingNumber = item.search_num
    const states = item.states

    // 跳过已完成的单号（虽然查询时已经过滤，但保险起见）
    if (states === 'Final delivery' || states === 'Returned to sender') {
      stats.skipped++
      console.log(`⏭️ 跳过已完成单号：${trackingNumber} (状态: ${states})`)
      continue
    }

    console.log(`正在处理追踪号：${trackingNumber} (ID: ${item.id})`)

    // 处理追踪号（不再重试）
    const result = await processTrackingNumber(trackingNumber)

    if (result.success) {
      stats.success++
    } else {
      stats.failed++
    }

    // 添加延迟，避免请求过快
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
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
 * 运行爬虫主函数
 * 从指定的起始id开始处理一批追踪号
 */
export async function runCrawler(
  startId: number = 0,
  filters?: {
    statusFilter?: 'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | 'not_queried' | 'delivered'
    dateFrom?: string
    dateTo?: string
    searchNums?: string[]
    updatedAtToday?: boolean
  }
): Promise<{
  success: boolean
  message?: string
  error?: string
  stats?: {
    total: number
    success: number
    failed: number
    skipped: number
    lastProcessedId: number
    maxId: number
    hasMore: boolean
  }
}> {
  const startTime = Date.now()

  console.log(`📋 开始从ID ${startId} 处理一批追踪号（按 id ASC 排序）...`)
  console.log(`⏰ 最大执行时间：${MAX_EXECUTION_TIME_MS / 1000} 秒`)

  try {
    // 获取从startId开始的一批待处理的追踪号（应用筛选条件）
    const { items: trackingNumbers, maxId } = await fetchPendingSearchNumbers(startId, BATCH_SIZE, filters)

    if (trackingNumbers.length === 0) {
      console.log('✅ 没有更多待处理的追踪号')
      return {
        success: true,
        message: '没有更多待处理的追踪号，所有追踪号都已完成',
        stats: {
          total: 0,
          success: 0,
          failed: 0,
          skipped: 0,
          lastProcessedId: startId,
          maxId,
          hasMore: false,
        },
      }
    }

    console.log(`📊 找到 ${trackingNumbers.length} 个待处理的追踪号（待处理单号最大ID: ${maxId}），开始处理...`)
    console.log('='.repeat(60))

    const stats = {
      success: 0,
      failed: 0,
      skipped: 0,
    }

    let lastProcessedId = startId
    let processedCount = 0

    // 处理这批追踪号
    for (const item of trackingNumbers) {
      // 检查是否还有足够时间
      if (!hasEnoughTime(startTime)) {
        const remainingCount = trackingNumbers.length - processedCount
        console.log(`⏰ 接近超时限制，提前停止。还有 ${remainingCount} 个追踪号未处理`)
        break
      }

      console.log(`\n🔄 进度: ${processedCount + 1}/${trackingNumbers.length} (ID: ${item.id})`)

      // 处理单个追踪号
      const result = await processTrackingNumber(item.search_num)

      if (result.success) {
        stats.success++
      } else {
        stats.failed++
      }

      processedCount++
      lastProcessedId = item.id

      // 每个追踪号间添加延迟，避免请求过快
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    const totalProcessed = stats.success + stats.failed
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(1)

    // 优化：通过比较lastProcessedId和maxId来判断是否还有更多
    const hasMore = lastProcessedId < maxId

    console.log('\n' + '='.repeat(60))
    console.log(`📊 本轮处理完成（总耗时 ${executionTime} 秒）`)
    console.log(`📊 统计：处理了 ${processedCount} 个，成功 ${stats.success} 个，失败 ${stats.failed} 个，跳过 ${stats.skipped} 个`)
    console.log(`📊 进度：最后处理的ID ${lastProcessedId}，待处理单号最大ID ${maxId}，还有更多: ${hasMore}`)

    const isCompleted = processedCount >= trackingNumbers.length && !hasMore
    let message: string

    if (isCompleted) {
      message = `✅ 全部处理完成：已处理 ${totalProcessed} 个追踪号（成功 ${stats.success} 个，失败 ${stats.failed} 个）。所有追踪号都已完成！`
    } else {
      message = `⏰ 本轮处理完成：已处理 ${totalProcessed} 个（成功 ${stats.success} 个，失败 ${stats.failed} 个），最后处理ID ${lastProcessedId}。还有更多待处理的追踪号，请再次点击"更新"按钮继续处理。`
    }

    return {
      success: true,
      message,
      stats: {
        total: totalProcessed,
        success: stats.success,
        failed: stats.failed,
        skipped: stats.skipped,
        lastProcessedId,
        maxId,
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

