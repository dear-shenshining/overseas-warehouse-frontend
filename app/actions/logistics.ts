'use server'

/**
 * Server Actions for Logistics
 * 服务端操作，直接在服务端查询数据库
 */
import { getLogisticsData, getLogisticsStatistics } from '@/lib/logistics-data'
import { importLogisticsData } from '@/lib/logistics-import'
import { runCrawler } from '@/lib/logistics-crawler'
import { revalidatePath } from 'next/cache'

export async function fetchLogisticsData(
  searchNum?: string,
  statusFilter?: 'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | 'not_queried' | 'delivered' | 'total' | 'has_transfer',
  dateFrom?: string,
  dateTo?: string,
  page: number = 1,
  pageSize: number = 50,
  createdAtToday?: boolean,
  hasTransferFilter?: boolean,
  updatedAtToday?: boolean
) {
  try {
    const result = await getLogisticsData(searchNum, statusFilter, dateFrom, dateTo, page, pageSize, createdAtToday, hasTransferFilter, updatedAtToday)
    return {
      success: true,
      data: result.data,
      total: result.total,
    }
  } catch (error: any) {
    console.error('获取物流数据失败:', error)
    
    // 提供更友好的错误提示
    let errorMessage = error.message || '获取物流数据失败'
    
    if (error.message?.includes('using password: NO') || error.message?.includes('password authentication failed')) {
      errorMessage = '数据库密码未配置或错误。请检查 .env 文件中的 DB_PASSWORD 配置，并确保已重启开发服务器。'
    } else if (error.message?.includes('Access denied') || error.message?.includes('authentication failed')) {
      errorMessage = '数据库访问被拒绝。请检查 .env 中的数据库用户名和密码是否正确。'
    } else if (error.message?.includes("doesn't exist") || error.message?.includes("does not exist") || error.message?.includes("column")) {
      if (error.message.includes('Unknown database')) {
        errorMessage = '数据库 seas_ware 不存在。请先创建数据库。'
      } else if (error.message.includes("Table") || error.message.includes("relation")) {
        errorMessage = '数据表 post_searchs 不存在。请在 Neon SQL Editor 中执行 sql/postgresql/create_post_searchs_table.sql 创建表。'
      } else if (error.message.includes("column") && (error.message.includes("transfer_num") || error.message.includes("order_num") || error.message.includes("notes"))) {
        errorMessage = '数据库表缺少新字段。请在 Neon SQL Editor 中执行 sql/postgresql/add_logistics_fields.sql 添加新字段（transfer_num, order_num, notes）。'
      } else if (error.message.includes("column")) {
        errorMessage = `数据库表字段错误：${error.message}。请检查表结构是否正确。`
      }
    } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connect') || error.message?.includes('timeout')) {
      errorMessage = '无法连接到数据库服务器。请检查：1. Neon 连接是否正常 2. .env 文件配置是否正确 3. 网络连接是否正常。'
    }
    
    return {
      success: false,
      error: errorMessage,
      data: [],
      total: 0,
    }
  }
}

export async function fetchLogisticsStatistics(dateFrom?: string, dateTo?: string) {
  try {
    const stats = await getLogisticsStatistics(dateFrom, dateTo)
    return {
      success: true,
      data: stats,
    }
  } catch (error: any) {
    console.error('获取统计数据失败:', error)
    
    // 统计失败不影响主数据加载，返回默认值
    // 但记录错误以便排查
    return {
      success: false,
      error: error.message || '获取统计数据失败',
      data: {
        in_transit: 0,
        returned: 0,
        not_online: 0,
        online_abnormal: 0,
        not_queried: 0,
        delivered: 0,
        total: 0,
        has_transfer: 0,
        updated_today: 0,
      },
    }
  }
}

/**
 * 导入物流数据（Excel文件）
 */
export async function importLogisticsFile(formData: FormData) {
  try {
    const file = formData.get('file') as File | null
    if (!file) {
      return {
        success: false,
        error: '请选择要导入的Excel文件',
      }
    }

    // 验证文件类型
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return {
        success: false,
        error: '请选择Excel文件（.xlsx或.xls格式）',
      }
    }

    // 验证文件大小（10MB）
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return {
        success: false,
        error: '文件大小不能超过10MB',
      }
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 导入数据
    const result = await importLogisticsData(buffer)

    if (result.success) {
      // 重新验证路径，刷新数据
      revalidatePath('/')
    }

    return result
  } catch (error: any) {
    console.error('导入物流文件失败:', error)
    return {
      success: false,
      error: error.message || '导入物流文件失败',
    }
  }
}

/**
 * 运行爬虫更新物流状态
 */
export async function updateLogisticsStatus(
  startId?: number,
  filters?: {
    statusFilter?: 'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | 'not_queried' | 'delivered' | 'total' | 'has_transfer'
    dateFrom?: string
    dateTo?: string
    searchNums?: string[]
    hasTransferFilter?: boolean
    updatedAtToday?: boolean
  }
) {
  try {
    const result = await runCrawler(startId || 0, filters)

    if (result.success) {
      // 重新验证路径，刷新数据
      revalidatePath('/')
    }

    return result
  } catch (error: any) {
    console.error('运行爬虫失败:', error)
    return {
      success: false,
      error: error.message || '运行爬虫失败',
    }
  }
}

/**
 * 更新物流记录字段（转单号、订单号、备注）
 */
export async function updateLogisticsField(
  id: number,
  field: 'transfer_num' | 'order_num' | 'notes',
  value: string | null
) {
  try {
    const { execute } = await import('@/lib/db')
    const { checkColumnExists } = await import('@/lib/check-table-structure')
    
    // 检查字段是否存在
    const fieldExists = await checkColumnExists('post_searchs', field)
    if (!fieldExists) {
      return {
        success: false,
        error: `字段 ${field} 不存在。请先执行 sql/postgresql/add_logistics_fields.sql 添加新字段。`,
      }
    }
    
    // 验证转单号只能是数字
    if (field === 'transfer_num' && value !== null && value !== '') {
      if (!/^\d+$/.test(value)) {
        return {
          success: false,
          error: '转单号只能包含数字',
        }
      }
    }

    const sql = `UPDATE post_searchs SET ${field} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
    const result = await execute(sql, [value || null, id])

    if (result.affectedRows > 0) {
      revalidatePath('/')
      return {
        success: true,
        message: '更新成功',
      }
    } else {
      return {
        success: false,
        error: '未找到要更新的记录',
      }
    }
  } catch (error: any) {
    console.error('更新物流字段失败:', error)
    return {
      success: false,
      error: error.message || '更新失败',
    }
  }
}

/**
 * 批量查询货运单号（优先查转单号，没有转单号才查原始单号）
 */
export async function batchSearchLogistics(searchNums: string[]) {
  try {
    const { query } = await import('@/lib/db')
    const { getLogisticsFields } = await import('@/lib/logistics-field-cache')
    
    if (searchNums.length === 0) {
      return {
        success: true,
        data: [],
        found: [],
        notFound: [],
      }
    }

    // 检查转单号字段是否存在
    const { hasTransferNum } = await getLogisticsFields()
    
    const placeholders = searchNums.map((_, i) => `$${i + 1}`).join(',')
    // 如果有转单号字段，优先查转单号，没有转单号才查原始单号
    let sql: string
    if (hasTransferNum) {
      sql = `SELECT DISTINCT search_num FROM post_searchs WHERE transfer_num IN (${placeholders}) OR ((transfer_num IS NULL OR transfer_num = '') AND search_num IN (${placeholders}))`
    } else {
      sql = `SELECT search_num FROM post_searchs WHERE search_num IN (${placeholders})`
    }
    const results = await query<{ search_num: string }>(sql, searchNums)
    
    const found = results.map(r => r.search_num)
    const notFound = searchNums.filter(num => !found.includes(num))

    return {
      success: true,
      data: results,
      found,
      notFound,
    }
  } catch (error: any) {
    console.error('批量查询失败:', error)
    return {
      success: false,
      error: error.message || '查询失败',
      data: [],
      found: [],
      notFound: [],
    }
  }
}

