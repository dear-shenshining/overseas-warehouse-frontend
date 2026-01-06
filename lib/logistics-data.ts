/**
 * 物流数据服务
 * 直接从数据库获取数据
 */
import { query } from '@/lib/db'

export interface LogisticsRecord {
  id: number
  search_num: string
  states: string
  Ship_date: string | null
  channel: string | null
}

export interface LogisticsStatistics {
  in_transit: number
  returned: number
  not_online: number
  online_abnormal: number // 上网异常：未上网且发货日期距今超过3天
}

/**
 * 获取物流数据列表
 * @param searchNum 搜索单号（可选）
 * @param statusFilter 状态筛选类型：'in_transit' | 'returned' | 'not_online' | 'online_abnormal'（可选）
 */
export async function getLogisticsData(
  searchNum?: string,
  statusFilter?: 'in_transit' | 'returned' | 'not_online' | 'online_abnormal'
): Promise<LogisticsRecord[]> {
  let sql = 'SELECT id, search_num, states, ship_date as "Ship_date", channel FROM post_searchs WHERE 1=1'
  const params: any[] = []
  let paramIndex = 1

  if (searchNum) {
    sql += ` AND search_num LIKE $${paramIndex}`
    params.push(`%${searchNum}%`)
    paramIndex++
  }

  // 根据状态筛选类型添加筛选条件
  if (statusFilter === 'returned') {
    // 退回/异常：Returned to Sender、退回、异常、退回/异常、办公室关闭/滞留、缺席/尝试投递（Retention属于运输中）
    sql += " AND states IN ('Returned to Sender', '退回', '异常', '退回/异常', 'Office closed. Retention.', 'Absence. Attempted delivery.')"
  } else if (statusFilter === 'not_online') {
    // 未上网：Not registered、未上网
    sql += " AND states IN ('Not registered', '未上网')"
  } else if (statusFilter === 'online_abnormal') {
    // 上网异常：未上网且发货日期距今超过3天
    sql += " AND states IN ('Not registered', '未上网')"
    sql += " AND ship_date IS NOT NULL"
    sql += " AND EXTRACT(DAY FROM (CURRENT_DATE - ship_date))::INTEGER >= 3"
  } else if (statusFilter === 'in_transit') {
    // 运输中：除了 Final delivery、退回/异常、未上网 之外的所有状态（包括Retention，但不包括办公室关闭/滞留和缺席/尝试投递）
    sql += ` AND states NOT IN ('Final delivery', 'Returned to Sender', 'Not registered', '退回', '异常', '退回/异常', '未上网', 'Office closed. Retention.', 'Absence. Attempted delivery.')`
  }

  sql += ' ORDER BY ship_date DESC, id DESC'

  const results = await query<LogisticsRecord>(sql, params)
  return results
}

/**
 * 获取物流统计数据
 * 根据状态分类统计：
 * - 运输中：除了 Final delivery、Returned to Sender、Not registered、退回、异常、退回/异常、未上网 之外的所有状态
 * - 退回/异常：Returned to Sender、退回、异常、退回/异常
 * - 未上网：Not registered、未上网
 */
export async function getLogisticsStatistics(): Promise<LogisticsStatistics> {
  // 统计退回/异常订单数（黄色标识：包括办公室关闭/滞留和缺席/尝试投递，Retention属于运输中，不包含在内）
  const returnedResult = await query<{ count: string | number }>(
    "SELECT COUNT(*) as count FROM post_searchs WHERE states IN ('Returned to Sender','Office closed. Retention.', 'Absence. Attempted delivery.')"
  )
  const returned = Number(returnedResult[0]?.count) || 0

  // 统计未上网订单数（红色标识）
  const notOnlineResult = await query<{ count: string | number }>(
    "SELECT COUNT(*) as count FROM post_searchs WHERE states IN ('Not registered')"
  )
  const notOnline = Number(notOnlineResult[0]?.count) || 0

  // 统计运输中的订单数（绿色标识：除了 Final delivery、退回/异常、未上网 之外的所有状态，包括Retention，但不包括办公室关闭/滞留和缺席/尝试投递）
  const inTransitResult = await query<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM post_searchs 
     WHERE states NOT IN ('Final delivery', 'Returned to Sender', 'Not registered','Office closed. Retention.','Absence. Attempted delivery.')`
  )
  const inTransit = Number(inTransitResult[0]?.count) || 0

  // 统计上网异常订单数（未上网且发货日期距今超过3天）
  const onlineAbnormalResult = await query<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM post_searchs 
     WHERE states IN ('Not registered', '未上网')
     AND ship_date IS NOT NULL
     AND EXTRACT(DAY FROM (CURRENT_DATE - ship_date))::INTEGER >= 3`
  )
  const online_abnormal = Number(onlineAbnormalResult[0]?.count) || 0

  return {
    in_transit: inTransit,
    returned: returned,
    not_online: notOnline,
    online_abnormal: online_abnormal,
  }
}

