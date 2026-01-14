'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * 登录验证
 * 支持两套密码系统：
 * - 密码1（管理员密码）：可以查看"每日发货毛利分析"和"每日发货毛利异常"，可以审核任务
 * - 密码2（普通用户密码）：只能查看"每日发货毛利异常"，不能查看"每日发货毛利分析"，不能审核任务
 */
export async function login(username: string, password: string) {
  try {
    // 从环境变量获取配置的用户名和密码
    const validUsername = process.env.ADMIN_USERNAME || 'admin'
    const fullAccessPassword = process.env.FULL_ACCESS_PASSWORD || 'admin123' // 完整权限密码（管理员）
    const limitedAccessPassword = process.env.LIMITED_ACCESS_PASSWORD || 'viewer123' // 受限权限密码（普通用户）

    // 验证用户名
    if (username !== validUsername) {
      return {
        success: false,
        error: '用户名或密码错误',
      }
    }

    // 验证密码并确定权限
    let canViewProfitAnalysis = false
    let isAdmin = false
    if (password === fullAccessPassword) {
      // 完整权限（管理员）：可以查看"每日发货毛利分析"和"每日发货毛利异常"，可以审核任务
      canViewProfitAnalysis = true
      isAdmin = true
    } else if (password === limitedAccessPassword) {
      // 受限权限（普通用户）：只能查看"每日发货毛利异常"
      canViewProfitAnalysis = false
      isAdmin = false
    } else {
      return {
        success: false,
        error: '用户名或密码错误',
      }
    }

    // 创建 session token（简单实现，生产环境建议使用 JWT）
    const sessionToken = Buffer.from(`${username}:${Date.now()}`).toString('base64')
    
    // 设置 cookie（30 天过期）
    const cookieStore = await cookies()
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 天
      path: '/',
    })

    // 同时存储用户名（用于显示）
    cookieStore.set('username', username, {
      httpOnly: false, // 允许前端读取
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    // 存储权限信息（用于前端控制显示）
    cookieStore.set('can_view_profit_analysis', canViewProfitAnalysis ? 'true' : 'false', {
      httpOnly: false, // 允许前端读取
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    // 存储管理员权限（用于审核功能）
    cookieStore.set('is_admin', isAdmin ? 'true' : 'false', {
      httpOnly: false, // 允许前端读取
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    return {
      success: true,
      username,
      canViewProfitAnalysis,
      isAdmin,
    }
  } catch (error: any) {
    console.error('登录失败:', error)
    return {
      success: false,
      error: error.message || '登录失败，请稍后重试',
    }
  }
}

/**
 * 登出
 */
export async function logout() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('session_token')
    cookieStore.delete('username')
    cookieStore.delete('can_view_profit_analysis')
    cookieStore.delete('is_admin')
    
    redirect('/login')
  } catch (error: any) {
    console.error('登出失败:', error)
    redirect('/login')
  }
}

/**
 * 检查是否已登录
 */
export async function checkAuth() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')
    const username = cookieStore.get('username')
    const canViewProfitAnalysis = cookieStore.get('can_view_profit_analysis')
    const isAdmin = cookieStore.get('is_admin')

    if (!sessionToken || !username) {
      return {
        isAuthenticated: false,
        username: null,
        canViewProfitAnalysis: false,
        isAdmin: false,
      }
    }

    return {
      isAuthenticated: true,
      username: username.value,
      canViewProfitAnalysis: canViewProfitAnalysis?.value === 'true',
      isAdmin: isAdmin?.value === 'true',
    }
  } catch (error: any) {
    console.error('检查认证状态失败:', error)
    return {
      isAuthenticated: false,
      username: null,
      canViewProfitAnalysis: false,
      isAdmin: false,
    }
  }
}








