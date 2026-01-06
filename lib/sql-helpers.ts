/**
 * SQL 辅助函数
 * 用于将 MySQL 语法转换为 PostgreSQL 语法
 */

/**
 * 将 MySQL 的 DATEDIFF 转换为 PostgreSQL 语法
 * MySQL: DATEDIFF(date1, date2) 返回 date1 - date2 的天数差
 * PostgreSQL: (date1 - date2) 返回 INTERVAL，需要提取天数
 */
export function convertDatediff(sql: string): string {
  // 匹配 DATEDIFF(NOW(), created_at) 或 DATEDIFF(CURDATE(), date)
  return sql.replace(
    /DATEDIFF\s*\(\s*(NOW\(\)|CURRENT_TIMESTAMP|CURDATE\(\)|CURRENT_DATE)\s*,\s*(\w+)\s*\)/gi,
    (match, date1, date2) => {
      const pgDate1 = date1.includes('NOW') || date1.includes('TIMESTAMP') 
        ? 'CURRENT_TIMESTAMP' 
        : 'CURRENT_DATE'
      return `EXTRACT(DAY FROM (${pgDate1} - ${date2}))::INTEGER`
    }
  )
}

/**
 * 将 MySQL 的 JSON_CONTAINS 转换为 PostgreSQL 语法
 * MySQL: JSON_CONTAINS(json_doc, val)
 * PostgreSQL: json_doc @> val 或 jsonb_doc @> val
 */
export function convertJsonContains(sql: string): string {
  // 匹配 JSON_CONTAINS(label, CAST(4 AS JSON)) 或 JSON_CONTAINS(label, '4')
  return sql.replace(
    /JSON_CONTAINS\s*\(\s*(\w+)\s*,\s*(?:CAST\s*\(([^)]+)\s+AS\s+JSON\)|'([^']+)'|"([^"]+)")\s*\)/gi,
    (match, column, castValue, strValue1, strValue2) => {
      const value = castValue || strValue1 || strValue2
      // 如果是数字，转换为 JSON 数组格式
      const numValue = parseInt(value)
      if (!isNaN(numValue)) {
        return `${column}::jsonb @> '[${numValue}]'::jsonb`
      }
      // 如果是字符串，保持原样
      return `${column}::jsonb @> '"${value}"'::jsonb`
    }
  )
}

/**
 * 将 MySQL 的 JSON_SEARCH 转换为 PostgreSQL 语法
 * MySQL: JSON_SEARCH(json_doc, 'one', '4') IS NOT NULL
 * PostgreSQL: jsonb_path_exists 或使用 @> 操作符
 */
export function convertJsonSearch(sql: string): string {
  // 匹配 JSON_SEARCH(label, 'one', '4') IS NOT NULL
  return sql.replace(
    /JSON_SEARCH\s*\(\s*(\w+)\s*,\s*'one'\s*,\s*'([^']+)'\s*\)\s+IS\s+NOT\s+NULL/gi,
    (match, column, value) => {
      const numValue = parseInt(value)
      if (!isNaN(numValue)) {
        return `${column}::jsonb @> '[${numValue}]'::jsonb`
      }
      return `${column}::jsonb @> '"${value}"'::jsonb`
    }
  )
}

/**
 * 将 MySQL 的 ON DUPLICATE KEY UPDATE 转换为 PostgreSQL 的 ON CONFLICT
 * MySQL: INSERT ... ON DUPLICATE KEY UPDATE ...
 * PostgreSQL: INSERT ... ON CONFLICT (key) DO UPDATE ...
 */
export function convertOnDuplicateKey(sql: string, uniqueKey: string = 'ware_sku'): string {
  return sql.replace(
    /ON\s+DUPLICATE\s+KEY\s+UPDATE\s+(.+)/gi,
    (match, updateClause) => {
      // 将 VALUES(column) 转换为 EXCLUDED.column
      const pgUpdate = updateClause.replace(/VALUES\s*\((\w+)\)/gi, 'EXCLUDED.$1')
      return `ON CONFLICT (${uniqueKey}) DO UPDATE SET ${pgUpdate}`
    }
  )
}

/**
 * 将 MySQL 的 CURDATE() 转换为 PostgreSQL 的 CURRENT_DATE
 */
export function convertCurdate(sql: string): string {
  return sql.replace(/CURDATE\s*\(\)/gi, 'CURRENT_DATE')
}

/**
 * 综合转换函数，应用所有转换
 */
export function convertMySQLToPostgreSQL(sql: string, uniqueKey?: string): string {
  let converted = sql
  converted = convertDatediff(converted)
  converted = convertJsonContains(converted)
  converted = convertJsonSearch(converted)
  converted = convertCurdate(converted)
  if (uniqueKey) {
    converted = convertOnDuplicateKey(converted, uniqueKey)
  }
  return converted
}

