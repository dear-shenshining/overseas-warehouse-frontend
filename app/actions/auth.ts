'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * 登录验证
 * 使用环境变量存储用户名和密码
 */
export async function login(username: string, password: string) {
  try {
    // 从环境变量获取配置的用户名和密码
    const validUsername = process.env.ADMIN_USERNAME || 'admin'
    const validPassword = process.env.ADMIN_PASSWORD || 'admin123'

    // 验证用户名和密码
    if (username !== validUsername || password !== validPassword) {
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

    return {
      success: true,
      username,
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

    if (!sessionToken || !username) {
      return {
        isAuthenticated: false,
        username: null,
      }
    }

    return {
      isAuthenticated: true,
      username: username.value,
    }
  } catch (error: any) {
    console.error('检查认证状态失败:', error)
    return {
      isAuthenticated: false,
      username: null,
    }
  }
}







