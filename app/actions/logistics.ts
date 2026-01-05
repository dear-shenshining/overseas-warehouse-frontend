'use server'

/**
 * Server Actions for Logistics
 * 服务端操作，直接在服务端查询数据库
 */
import { getLogisticsData, getLogisticsStatistics } from '@/lib/logistics-data'
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
    return {
      success: false,
      error: error.message || '获取物流数据失败',
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

