/**
 * 物流数据服务
 * 直接从数据库获取数据
 */
import { query } from '@/lib/db'
import { getLogisticsFields } from './logistics-field-cache'

export interface LogisticsRecord {
  id: number
  search_num: string
  states: string
  Ship_date: string | null
  channel: string | null
  transfer_num: string | null
  transfer_date: string | null
  order_num: string | null
  notes: string | null
}

export interface LogisticsStatistics {
  in_transit: number
  returned: number
  not_online: number
  online_abnormal: number // 上网异常：未上网且发货日期距今超过3天
  not_queried: number // 未查询：states为空
  delivered: number // 成功签收
  total: number // 总发货：全量数据
  has_transfer: number // 转单：有转单号的数据
  updated_today: number // 今日处理：updated_at 在今天范围内的数据
}

/**
 * 获取物流数据列表（支持分页）
 * @param searchNum 搜索单号（可选，支持多个单号，用逗号分隔）
 * @param statusFilter 状态筛选类型：'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | 'delivered'（可选）
 * @param dateFrom 开始日期（可选）
 * @param dateTo 结束日期（可选）
 * @param page 页码（从1开始，默认1）
 * @param pageSize 每页数量（默认50）
 * @param createdAtToday 是否只查询今天创建的数据（可选）
 * @param updatedAtToday 是否只查询今天更新的数据（updated_at 在今天范围内）（可选）
 */
export async function getLogisticsData(
  searchNum?: string,
  statusFilter?: 'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | 'not_queried' | 'delivered' | 'total' | 'has_transfer',
  dateFrom?: string,
  dateTo?: string,
  page: number = 1,
  pageSize: number = 50,
  createdAtToday?: boolean,
  hasTransferFilter?: boolean,
  updatedAtToday?: boolean
): Promise<{ data: LogisticsRecord[], total: number }> {
  // 检查新字段是否存在（使用缓存）
  const { hasTransferNum, hasOrderNum, hasNotes, hasTransferDate } = await getLogisticsFields()
  
  // 根据字段是否存在构建SELECT语句
  const selectFields = [
    'p.id',
    'p.search_num',
    'COALESCE(t.states, p.states) as states',
    'p.ship_date as "Ship_date"',
    'p.channel',
  ]
  
  if (hasTransferNum) {
    selectFields.push('p.transfer_num')
  } else {
    selectFields.push('NULL::VARCHAR as transfer_num')
  }
  
  if (hasTransferDate) {
    selectFields.push('p.transfer_date')
  } else {
    selectFields.push('NULL::TIMESTAMP as transfer_date')
  }
  
  if (hasOrderNum) {
    selectFields.push('p.order_num')
  } else {
    selectFields.push('NULL::VARCHAR as order_num')
  }
  
  if (hasNotes) {
    selectFields.push('p.notes')
  } else {
    selectFields.push('NULL::TEXT as notes')
  }
  
  // 构建LEFT JOIN（只有在transfer_num字段存在时才使用）
  let joinClause = ''
  if (hasTransferNum) {
    joinClause = `LEFT JOIN post_searchs t ON p.transfer_num = t.search_num AND p.transfer_num IS NOT NULL AND p.transfer_num != ''`
  } else {
    joinClause = `LEFT JOIN post_searchs t ON NULL = t.search_num` // 永远不会匹配，但保持结构一致
  }
  
  let sql = `
    SELECT 
      ${selectFields.join(', ')}
    FROM post_searchs p
    ${joinClause}
    WHERE 1=1
  `
  const params: any[] = []
  let paramIndex = 1

  if (searchNum) {
    // 支持多个单号查询，用逗号分隔
    const searchNums = searchNum.split(',').map(s => s.trim()).filter(s => s)
    if (searchNums.length > 0) {
      const placeholders = searchNums.map((_, i) => `$${paramIndex + i}`).join(',')
      sql += ` AND p.search_num IN (${placeholders})`
      params.push(...searchNums)
      paramIndex += searchNums.length
    }
  }

  // 日期筛选
  if (dateFrom && dateFrom.trim() !== '') {
    // 验证日期格式（YYYY-MM-DD）
    const dateFromMatch = dateFrom.match(/^\d{4}-\d{2}-\d{2}$/)
    if (dateFromMatch) {
      sql += ` AND p.ship_date >= $${paramIndex}::date`
      params.push(dateFrom)
      paramIndex++
    } else {
      console.warn('无效的开始日期格式:', dateFrom)
    }
  }
  if (dateTo && dateTo.trim() !== '') {
    // 验证日期格式（YYYY-MM-DD）
    const dateToMatch = dateTo.match(/^\d{4}-\d{2}-\d{2}$/)
    if (dateToMatch) {
      sql += ` AND p.ship_date <= ($${paramIndex}::date + INTERVAL '1 day' - INTERVAL '1 second')`
      params.push(dateTo)
      paramIndex++
    } else {
      console.warn('无效的结束日期格式:', dateTo)
    }
  }

  // 创建时间筛选（今天创建的数据）
  if (createdAtToday) {
    sql += ` AND DATE(p.created_at) = CURRENT_DATE`
  }

  // 更新时间筛选（今天更新的数据）
  if (updatedAtToday) {
    sql += ` AND DATE(p.updated_at) = CURRENT_DATE`
  }

  // 根据状态筛选类型添加筛选条件
  // 注意：由于使用了COALESCE，WHERE条件需要使用COALESCE的结果
  if (statusFilter === 'returned') {
    // 退回/异常：Returned to Sender、退回、异常、退回/异常、办公室关闭/滞留、缺席/尝试投递（Retention属于运输中）
    sql += " AND COALESCE(t.states, p.states) IN ('Returned to Sender', '退回', '异常', '退回/异常', 'Office closed. Retention.', 'Absence. Attempted delivery.')"
  } else if (statusFilter === 'not_online') {
    // 未上网：Not registered、未上网
    sql += " AND COALESCE(t.states, p.states) IN ('Not registered', '未上网')"
  } else if (statusFilter === 'not_queried') {
    // 未查询：states 为 null 或空字符串
    sql += " AND (COALESCE(t.states, p.states) IS NULL OR COALESCE(t.states, p.states) = '')"
  } else if (statusFilter === 'online_abnormal') {
    // 上网异常：未上网且（有转单号用转单日期，无转单号用发货日期）距今超过3天
    sql += " AND COALESCE(t.states, p.states) IN ('Not registered', '未上网')"
    if (hasTransferNum) {
      // 有转单号时，优先使用转单日期；无转单号时，使用发货日期
      sql += ` AND (
        (p.transfer_num IS NOT NULL AND p.transfer_num != '' AND p.transfer_date IS NOT NULL AND EXTRACT(DAY FROM (CURRENT_DATE - p.transfer_date))::INTEGER >= 3)
        OR
        ((p.transfer_num IS NULL OR p.transfer_num = '') AND p.ship_date IS NOT NULL AND EXTRACT(DAY FROM (CURRENT_DATE - p.ship_date))::INTEGER >= 3)
      )`
    } else {
      // 如果转单号字段不存在，只使用发货日期
      sql += " AND p.ship_date IS NOT NULL"
      sql += " AND EXTRACT(DAY FROM (CURRENT_DATE - p.ship_date))::INTEGER >= 3"
    }
  } else if (statusFilter === 'in_transit') {
    // 运输中：除了 Final delivery、退回/异常、未上网 之外的所有状态（包括Retention，但不包括办公室关闭/滞留和缺席/尝试投递）
    sql += ` AND COALESCE(t.states, p.states) NOT IN ('Final delivery', 'Returned to Sender', 'Not registered', '退回', '异常', '退回/异常', '未上网', 'Office closed. Retention.', 'Absence. Attempted delivery.')`
  } else if (statusFilter === 'delivered') {
    // 成功签收：Final delivery
    sql += " AND COALESCE(t.states, p.states) = 'Final delivery'"
  }
  // statusFilter === 'total' 时不添加任何筛选条件，显示全量数据
  // statusFilter === 'has_transfer' 时只显示转单数据，不添加状态筛选
  
  // 转单筛选（可以与状态筛选组合使用）
  if (hasTransferFilter || statusFilter === 'has_transfer') {
    if (hasTransferNum) {
      sql += " AND p.transfer_num IS NOT NULL AND p.transfer_num != ''"
    } else {
      // 如果字段不存在，返回空结果
      sql += " AND 1=0"
    }
  }

  sql += ' ORDER BY p.ship_date DESC, p.id DESC'

  // 获取总数（用于分页）
  // 优化：COUNT 查询不需要 LEFT JOIN，直接在主表上查询
  let countSql = `
    SELECT COUNT(*) as total
    FROM post_searchs p
    WHERE 1=1
  `
  const countParams: any[] = []
  let countParamIndex = 1

  // 复制筛选条件（但不包括 LEFT JOIN）
  if (searchNum) {
    const searchNums = searchNum.split(',').map(s => s.trim()).filter(s => s)
    if (searchNums.length > 0) {
      const placeholders = searchNums.map((_, i) => `$${countParamIndex + i}`).join(',')
      countSql += ` AND p.search_num IN (${placeholders})`
      countParams.push(...searchNums)
      countParamIndex += searchNums.length
    }
  }

  // 日期筛选
  if (dateFrom && dateFrom.trim() !== '') {
    const dateFromMatch = dateFrom.match(/^\d{4}-\d{2}-\d{2}$/)
    if (dateFromMatch) {
      countSql += ` AND p.ship_date >= $${countParamIndex}::date`
      countParams.push(dateFrom)
      countParamIndex++
    }
  }
  if (dateTo && dateTo.trim() !== '') {
    const dateToMatch = dateTo.match(/^\d{4}-\d{2}-\d{2}$/)
    if (dateToMatch) {
      countSql += ` AND p.ship_date <= ($${countParamIndex}::date + INTERVAL '1 day' - INTERVAL '1 second')`
      countParams.push(dateTo)
      countParamIndex++
    }
  }

  // 创建时间筛选（今天创建的数据）
  if (createdAtToday) {
    countSql += ` AND DATE(p.created_at) = CURRENT_DATE`
  }

  // 更新时间筛选（今天更新的数据）
  if (updatedAtToday) {
    countSql += ` AND DATE(p.updated_at) = CURRENT_DATE`
  }

  // 状态筛选（简化版，不依赖 LEFT JOIN）
  if (statusFilter === 'returned') {
    countSql += " AND p.states IN ('Returned to Sender', '退回', '异常', '退回/异常', 'Office closed. Retention.', 'Absence. Attempted delivery.')"
  } else if (statusFilter === 'not_online') {
    countSql += " AND p.states IN ('Not registered', '未上网')"
  } else if (statusFilter === 'not_queried') {
    countSql += " AND (p.states IS NULL OR p.states = '')"
  } else if (statusFilter === 'online_abnormal') {
    // 上网异常：未上网且（有转单号用转单日期，无转单号用发货日期）距今超过3天
    countSql += " AND p.states IN ('Not registered', '未上网')"
    if (hasTransferNum) {
      // 有转单号时，优先使用转单日期；无转单号时，使用发货日期
      countSql += ` AND (
        (p.transfer_num IS NOT NULL AND p.transfer_num != '' AND p.transfer_date IS NOT NULL AND EXTRACT(DAY FROM (CURRENT_DATE - p.transfer_date))::INTEGER >= 3)
        OR
        ((p.transfer_num IS NULL OR p.transfer_num = '') AND p.ship_date IS NOT NULL AND EXTRACT(DAY FROM (CURRENT_DATE - p.ship_date))::INTEGER >= 3)
      )`
    } else {
      // 如果转单号字段不存在，只使用发货日期
      countSql += " AND p.ship_date IS NOT NULL"
      countSql += " AND EXTRACT(DAY FROM (CURRENT_DATE - p.ship_date))::INTEGER >= 3"
    }
  } else if (statusFilter === 'in_transit') {
    countSql += ` AND p.states NOT IN ('Final delivery', 'Returned to Sender', 'Not registered', '退回', '异常', '退回/异常', '未上网', 'Office closed. Retention.', 'Absence. Attempted delivery.')`
  } else if (statusFilter === 'delivered') {
    countSql += " AND p.states = 'Final delivery'"
  }
  // statusFilter === 'has_transfer' 时只显示转单数据，不添加状态筛选
  
  // 转单筛选（可以与状态筛选组合使用）
  if (hasTransferFilter || statusFilter === 'has_transfer') {
    if (hasTransferNum) {
      countSql += " AND p.transfer_num IS NOT NULL AND p.transfer_num != ''"
    } else {
      countSql += " AND 1=0"
    }
  }
  
  const countResult = await query<{ total: string | number }>(countSql, countParams)
  const total = Number(countResult[0]?.total) || 0

  // 添加分页
  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
  params.push(pageSize, (page - 1) * pageSize)

  // 调试：输出SQL和参数（仅在开发环境）
  if (process.env.NODE_ENV === 'development') {
    console.log('SQL:', sql)
    console.log('Params:', params)
    console.log('Total:', total)
  }

  const results = await query<LogisticsRecord>(sql, params)
  return { data: results, total }
}

/**
 * 获取物流统计数据（优化：合并为单个查询）
 * 根据状态分类统计：
 * - 运输中：除了 Final delivery、Returned to Sender、Not registered、退回、异常、退回/异常、未上网 之外的所有状态
 * - 退回/异常：Returned to Sender、退回、异常、退回/异常
 * - 未上网：Not registered、未上网
 * @param dateFrom 开始日期（可选）
 * @param dateTo 结束日期（可选）
 */
export async function getLogisticsStatistics(dateFrom?: string, dateTo?: string): Promise<LogisticsStatistics> {
  // 构建日期筛选条件
  const dateConditions: string[] = []
  const dateParams: any[] = []
  let dateParamIndex = 1

  if (dateFrom && dateFrom.trim()) {
    dateConditions.push(`ship_date >= $${dateParamIndex}::date`)
    dateParams.push(dateFrom)
    dateParamIndex++
  }
  if (dateTo && dateTo.trim()) {
    dateConditions.push(`ship_date <= ($${dateParamIndex}::date + INTERVAL '1 day' - INTERVAL '1 second')`)
    dateParams.push(dateTo)
    dateParamIndex++
  }

  const dateWhereClause = dateConditions.length > 0 ? ` AND ${dateConditions.join(' AND ')}` : ''

  // 检查转单号字段是否存在（使用缓存）
  const { hasTransferNum } = await getLogisticsFields()

  // 优化：使用单个查询合并所有统计，使用 FILTER 子句
  const statsSql = `
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (
        WHERE states IN ('Returned to Sender', 'Office closed. Retention.', 'Absence. Attempted delivery.')
      ) as returned,
      COUNT(*) FILTER (
        WHERE states IN ('Not registered')
      ) as not_online,
      COUNT(*) FILTER (
        WHERE states NOT IN ('Final delivery', 'Returned to Sender', 'Not registered', 'Office closed. Retention.', 'Absence. Attempted delivery.')
      ) as in_transit,
      COUNT(*) FILTER (
        WHERE states IN ('Not registered', '未上网')
          AND (
            ${hasTransferNum ? `(transfer_num IS NOT NULL AND transfer_num != '' AND transfer_date IS NOT NULL AND EXTRACT(DAY FROM (CURRENT_DATE - transfer_date))::INTEGER >= 3)
            OR
            ((transfer_num IS NULL OR transfer_num = '') AND ship_date IS NOT NULL AND EXTRACT(DAY FROM (CURRENT_DATE - ship_date))::INTEGER >= 3)` : `ship_date IS NOT NULL AND EXTRACT(DAY FROM (CURRENT_DATE - ship_date))::INTEGER >= 3`}
          )
      ) as online_abnormal,
      COUNT(*) FILTER (
        WHERE states IS NULL OR states = ''
      ) as not_queried,
      COUNT(*) FILTER (
        WHERE states = 'Final delivery'
      ) as delivered,
      ${hasTransferNum ? `COUNT(*) FILTER (
        WHERE transfer_num IS NOT NULL AND transfer_num != ''
      ) as has_transfer` : '0 as has_transfer'},
      COUNT(*) FILTER (
        WHERE DATE(updated_at) = CURRENT_DATE
      ) as updated_today
    FROM post_searchs
    WHERE 1=1${dateWhereClause}
  `

  const statsResult = await query<{
    total: string | number
    returned: string | number
    not_online: string | number
    in_transit: string | number
    online_abnormal: string | number
    not_queried: string | number
    delivered: string | number
    has_transfer: string | number
    updated_today: string | number
  }>(statsSql, dateParams.length > 0 ? dateParams : [])

  const result = statsResult[0] || {}

  return {
    total: Number(result.total) || 0,
    in_transit: Number(result.in_transit) || 0,
    returned: Number(result.returned) || 0,
    not_online: Number(result.not_online) || 0,
    online_abnormal: Number(result.online_abnormal) || 0,
    not_queried: Number(result.not_queried) || 0,
    delivered: Number(result.delivered) || 0,
    has_transfer: Number(result.has_transfer) || 0,
    updated_today: Number(result.updated_today) || 0,
  }
}

