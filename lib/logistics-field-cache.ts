/**
 * 物流字段缓存
 * 避免每次查询都检查字段是否存在
 */

let fieldCache: {
  hasTransferNum: boolean
  hasOrderNum: boolean
  hasNotes: boolean
  hasTransferDate: boolean
  timestamp: number
} | null = null

const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

/**
 * 获取字段信息（带缓存）
 */
export async function getLogisticsFields(): Promise<{
  hasTransferNum: boolean
  hasOrderNum: boolean
  hasNotes: boolean
  hasTransferDate: boolean
}> {
  // 如果缓存存在且未过期，直接返回
  if (fieldCache && Date.now() - fieldCache.timestamp < CACHE_DURATION) {
    return {
      hasTransferNum: fieldCache.hasTransferNum,
      hasOrderNum: fieldCache.hasOrderNum,
      hasNotes: fieldCache.hasNotes,
      hasTransferDate: fieldCache.hasTransferDate,
    }
  }

  // 否则重新检查并缓存
  const { checkLogisticsNewFields } = await import('./check-table-structure')
  const fields = await checkLogisticsNewFields()
  
  fieldCache = {
    ...fields,
    timestamp: Date.now(),
  }

  return fields
}

/**
 * 清除缓存（用于字段更新后）
 */
export function clearFieldCache() {
  fieldCache = null
}

