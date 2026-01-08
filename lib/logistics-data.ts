/**
 * 物流数据服务
 * 直接从数据库获取数据
 */
import { query } from '@/lib/db'
import { checkLogisticsNewFields } from './check-table-structure'

export interface LogisticsRecord {
  id: number
  search_num: string
  states: string
  Ship_date: string | null
  channel: string | null
  transfer_num: string | null
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
}

/**
 * 获取物流数据列表（支持分页）
 * @param searchNum 搜索单号（可选，支持多个单号，用逗号分隔）
 * @param statusFilter 状态筛选类型：'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | 'delivered'（可选）
 * @param dateFrom 开始日期（可选）
 * @param dateTo 结束日期（可选）
 * @param page 页码（从1开始，默认1）
 * @param pageSize 每页数量（默认50）
 */
export async function getLogisticsData(
  searchNum?: string,
  statusFilter?: 'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | 'not_queried' | 'delivered',
  dateFrom?: string,
  dateTo?: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: LogisticsRecord[], total: number }> {
  // 检查新字段是否存在
  const { hasTransferNum, hasOrderNum, hasNotes } = await checkLogisticsNewFields()
  
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
    // 上网异常：未上网且发货日期距今超过3天
    sql += " AND COALESCE(t.states, p.states) IN ('Not registered', '未上网')"
    sql += " AND p.ship_date IS NOT NULL"
    sql += " AND EXTRACT(DAY FROM (CURRENT_DATE - p.ship_date))::INTEGER >= 3"
  } else if (statusFilter === 'in_transit') {
    // 运输中：除了 Final delivery、退回/异常、未上网 之外的所有状态（包括Retention，但不包括办公室关闭/滞留和缺席/尝试投递）
    sql += ` AND COALESCE(t.states, p.states) NOT IN ('Final delivery', 'Returned to Sender', 'Not registered', '退回', '异常', '退回/异常', '未上网', 'Office closed. Retention.', 'Absence. Attempted delivery.')`
  } else if (statusFilter === 'delivered') {
    // 成功签收：Final delivery
    sql += " AND COALESCE(t.states, p.states) = 'Final delivery'"
  }

  sql += ' ORDER BY p.ship_date DESC, p.id DESC'

  // 获取总数（用于分页）
  const countSql = sql
    .replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM')
    .replace(/ORDER BY[\s\S]*$/, '')
  
  const countParams = params.slice(0) // 复制参数数组，排除分页参数
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

  // 优化：使用单个查询合并所有统计，使用 FILTER 子句
  const statsSql = `
    SELECT 
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
          AND ship_date IS NOT NULL
          AND EXTRACT(DAY FROM (CURRENT_DATE - ship_date))::INTEGER >= 3
      ) as online_abnormal,
      COUNT(*) FILTER (
        WHERE states IS NULL OR states = ''
      ) as not_queried,
      COUNT(*) FILTER (
        WHERE states = 'Final delivery'
      ) as delivered
    FROM post_searchs
    WHERE 1=1${dateWhereClause}
  `

  const statsResult = await query<{
    returned: string | number
    not_online: string | number
    in_transit: string | number
    online_abnormal: string | number
    not_queried: string | number
    delivered: string | number
  }>(statsSql, dateParams.length > 0 ? dateParams : [])

  const result = statsResult[0] || {}

  return {
    in_transit: Number(result.in_transit) || 0,
    returned: Number(result.returned) || 0,
    not_online: Number(result.not_online) || 0,
    online_abnormal: Number(result.online_abnormal) || 0,
    not_queried: Number(result.not_queried) || 0,
    delivered: Number(result.delivered) || 0,
  }
}

