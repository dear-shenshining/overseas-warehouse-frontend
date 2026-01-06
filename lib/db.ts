/**
 * 数据库连接配置
 * 使用 pg 连接 PostgreSQL 数据库（Neon）
 */
import { Pool, PoolClient } from 'pg'

// 数据库配置（从环境变量读取）
// 注意：生产环境必须通过环境变量配置，不要使用默认值
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '', // 生产环境必须设置，不允许默认值
  database: process.env.DB_NAME || 'seas_ware',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10, // 最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // 设置时区为中国时间（GMT+8）
  // 如果不设置，默认使用 UTC 时间
  // 可以通过环境变量 DB_TIMEZONE 自定义时区，默认为 'Asia/Shanghai'
  options: `-c timezone=${process.env.DB_TIMEZONE || 'Asia/Shanghai'}`,
}

// 创建连接池
const pool = new Pool(dbConfig)

// 处理连接错误
pool.on('error', (err) => {
  console.error('PostgreSQL 连接池错误:', err)
})

// 在连接建立后设置时区为中国时间（GMT+8）
// 可以通过环境变量 DB_TIMEZONE 自定义时区，默认为 'Asia/Shanghai'
pool.on('connect', async (client) => {
  const timezone = process.env.DB_TIMEZONE || 'Asia/Shanghai'
  try {
    await client.query(`SET timezone = '${timezone}'`)
    console.log(`数据库连接时区已设置为: ${timezone}`)
  } catch (error) {
    console.error('设置数据库时区失败:', error)
  }
})

/**
 * 执行查询语句
 * @param sql SQL 查询语句（使用 $1, $2 作为参数占位符）
 * @param params SQL 参数（用于防止 SQL 注入）
 * @returns 查询结果
 */
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  try {
    // 将 MySQL 风格的 ? 占位符转换为 PostgreSQL 的 $1, $2, $3...
    const convertedSql = convertPlaceholders(sql)
    const result = await pool.query(convertedSql, params || [])
    return result.rows as T[]
  } catch (error) {
    console.error('数据库查询错误:', error)
    throw error
  }
}

/**
 * 执行更新语句（INSERT, UPDATE, DELETE）
 * @param sql SQL 更新语句（使用 $1, $2 作为参数占位符）
 * @param params SQL 参数（用于防止 SQL 注入）
 * @returns 受影响的行数和插入的 ID
 */
export async function execute(
  sql: string,
  params?: any[]
): Promise<{ affectedRows: number; insertId?: number }> {
  try {
    // 将 MySQL 风格的 ? 占位符转换为 PostgreSQL 的 $1, $2, $3...
    const convertedSql = convertPlaceholders(sql)
    const result = await pool.query(convertedSql, params || [])
    
    // PostgreSQL 返回的格式不同
    return {
      affectedRows: result.rowCount || 0,
      insertId: result.rows[0]?.id, // PostgreSQL 使用 RETURNING 子句获取插入的 ID
    }
  } catch (error) {
    console.error('数据库更新错误:', error)
    throw error
  }
}

/**
 * 获取数据库连接（用于事务）
 */
export async function getConnection(): Promise<PoolClient> {
  return await pool.connect()
}

/**
 * 关闭连接池
 */
export async function closePool() {
  await pool.end()
}

/**
 * 将 MySQL 风格的 ? 占位符转换为 PostgreSQL 的 $1, $2, $3...
 * @param sql 原始 SQL 语句
 * @returns 转换后的 SQL 语句
 */
function convertPlaceholders(sql: string): string {
  let paramIndex = 1
  return sql.replace(/\?/g, () => `$${paramIndex++}`)
}

export default pool
