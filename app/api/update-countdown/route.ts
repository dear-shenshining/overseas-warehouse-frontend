/**
 * API 路由：更新倒计时
 * 用于外部 Cron 服务定时调用
 * 
 * 使用方法：
 * GET/POST https://your-domain.com/api/update-countdown?secret=YOUR_SECRET_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { updateTaskCountDown } from '@/lib/inventory-data'

export async function GET(request: NextRequest) {
  return handleRequest(request)
}

export async function POST(request: NextRequest) {
  return handleRequest(request)
}

async function handleRequest(request: NextRequest) {
  try {
    // 1. 验证 Secret Key（防止未授权访问）
    const secret = request.nextUrl.searchParams.get('secret')
    const expectedSecret = process.env.CRON_SECRET_KEY

    if (!expectedSecret) {
      console.error('❌ CRON_SECRET_KEY 环境变量未设置')
      return NextResponse.json(
        { success: false, error: '服务器配置错误：CRON_SECRET_KEY 未设置' },
        { status: 500 }
      )
    }

    if (secret !== expectedSecret) {
      console.warn('⚠️ 未授权的访问尝试，secret 不匹配')
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    // 2. 调用 Server Action 更新倒计时
    console.log('🔄 开始更新倒计时...', new Date().toISOString())
    const result = await updateTaskCountDown()

    if (result.success) {
      console.log('✅ 倒计时更新成功', new Date().toISOString())
      return NextResponse.json({
        success: true,
        message: '倒计时更新成功',
        timestamp: new Date().toISOString(),
      })
    } else {
      console.error('❌ 倒计时更新失败:', result.error)
      return NextResponse.json(
        {
          success: false,
          error: result.error || '更新失败',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('❌ API 路由错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || '服务器内部错误',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}


