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
  statusFilter?: 'in_transit' | 'returned' | 'not_online' | 'online_abnormal'
) {
  try {
    const data = await getLogisticsData(searchNum, statusFilter)
    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('获取物流数据失败:', error)
    
    // 提供更友好的错误提示
    let errorMessage = error.message || '获取物流数据失败'
    
    if (error.message?.includes('using password: NO') || error.message?.includes('password authentication failed')) {
      errorMessage = '数据库密码未配置或错误。请检查 .env 文件中的 DB_PASSWORD 配置，并确保已重启开发服务器。'
    } else if (error.message?.includes('Access denied') || error.message?.includes('authentication failed')) {
      errorMessage = '数据库访问被拒绝。请检查 .env 中的数据库用户名和密码是否正确。'
    } else if (error.message?.includes("doesn't exist")) {
      if (error.message.includes('Unknown database')) {
        errorMessage = '数据库 seas_ware 不存在。请先创建数据库。'
      } else if (error.message.includes("Table") || error.message.includes("relation") || error.message.includes("does not exist")) {
        errorMessage = '数据表 post_searchs 不存在。请在 Neon SQL Editor 中执行 sql/postgresql/create_post_searchs_table.sql 创建表。'
      }
    } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connect') || error.message?.includes('timeout')) {
      errorMessage = '无法连接到数据库服务器。请检查：1. Neon 连接是否正常 2. .env 文件配置是否正确 3. 网络连接是否正常。'
    }
    
    return {
      success: false,
      error: errorMessage,
      data: [],
    }
  }
}

export async function fetchLogisticsStatistics() {
  try {
    const stats = await getLogisticsStatistics()
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
export async function updateLogisticsStatus() {
  try {
    const result = await runCrawler()

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

