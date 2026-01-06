/**
 * 检查数据库表结构
 * 用于诊断导入问题
 */

import { query } from './db'

export async function checkTableStructure() {
  try {
    // 检查表是否存在（尝试不同的大小写组合）
    const tables = await query<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name = 'post_searchs' OR table_name = 'Post_searchs' OR LOWER(table_name) = 'post_searchs')
    `)

    console.log('找到的表:', tables)

    if (tables.length === 0) {
      return {
        success: false,
        error: '未找到 post_searchs 表',
        tables: [],
        columns: [],
      }
    }

    const tableName = tables[0].table_name

    // 检查字段
    const columns = await query<{ column_name: string; data_type: string }>(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 OR LOWER(table_name) = LOWER($1)
      ORDER BY ordinal_position
    `, [tableName])

    console.log('表名:', tableName)
    console.log('字段:', columns)

    return {
      success: true,
      tableName,
      columns: columns.map(c => ({
        name: c.column_name,
        type: c.data_type,
      })),
    }
  } catch (error: any) {
    console.error('检查表结构失败:', error)
    return {
      success: false,
      error: error.message,
      tables: [],
      columns: [],
    }
  }
}

