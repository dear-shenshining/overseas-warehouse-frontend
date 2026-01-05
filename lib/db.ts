/**
 * 数据库连接配置
 * 使用 mysql2 连接 MySQL 数据库
 */
import mysql from 'mysql2/promise'

// 数据库配置（从环境变量读取）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'seas_ware',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

// 创建连接池
const pool = mysql.createPool(dbConfig)

/**
 * 执行查询语句
 * @param sql SQL 查询语句
 * @param params SQL 参数（用于防止 SQL 注入）
 * @returns 查询结果
 */
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  try {
    const [rows] = await pool.execute(sql, params || [])
    return rows as T[]
  } catch (error) {
    console.error('数据库查询错误:', error)
    throw error
  }
}

/**
 * 执行更新语句（INSERT, UPDATE, DELETE）
 * @param sql SQL 更新语句
 * @param params SQL 参数（用于防止 SQL 注入）
 * @returns 受影响的行数和插入的 ID
 */
export async function execute(
  sql: string,
  params?: any[]
): Promise<{ affectedRows: number; insertId?: number }> {
  try {
    const [result] = await pool.execute(sql, params || []) as any
    return {
      affectedRows: result.affectedRows,
      insertId: result.insertId,
    }
  } catch (error) {
    console.error('数据库更新错误:', error)
    throw error
  }
}

/**
 * 获取数据库连接（用于事务）
 */
export async function getConnection() {
  return await pool.getConnection()
}

/**
 * 关闭连接池
 */
export async function closePool() {
  await pool.end()
}

export default pool

