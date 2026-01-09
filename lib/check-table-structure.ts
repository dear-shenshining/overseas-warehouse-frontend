/**
 * 检查数据库表结构
 */
import { query } from './db'

/**
 * 检查表是否存在指定字段
 */
export async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND column_name = $2
      ) as exists
    `, [tableName, columnName])
    
    return result[0]?.exists || false
  } catch (error) {
    console.error(`检查字段 ${tableName}.${columnName} 失败:`, error)
    return false
  }
}

/**
 * 检查 post_searchs 表的新字段是否存在
 */
export async function checkLogisticsNewFields(): Promise<{
  hasTransferNum: boolean
  hasOrderNum: boolean
  hasNotes: boolean
  hasTransferDate: boolean
}> {
  try {
    const [hasTransferNum, hasOrderNum, hasNotes, hasTransferDate] = await Promise.all([
      checkColumnExists('post_searchs', 'transfer_num'),
      checkColumnExists('post_searchs', 'order_num'),
      checkColumnExists('post_searchs', 'notes'),
      checkColumnExists('post_searchs', 'transfer_date'),
    ])
    
    return { hasTransferNum, hasOrderNum, hasNotes, hasTransferDate }
  } catch (error) {
    console.error('检查新字段失败:', error)
    return { hasTransferNum: false, hasOrderNum: false, hasNotes: false, hasTransferDate: false }
  }
}
