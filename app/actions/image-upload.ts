'use server'

import { cookies } from 'next/headers'

/**
 * 无铭图床API配置
 */
const WMIMG_API_BASE = 'https://wmimg.com/api/v1'

/**
 * 登录无铭图床获取Token
 * @param email 邮箱或用户名
 * @param password 密码
 * @returns 登录结果
 */
export async function loginWmimg(
  email: string,
  password: string
): Promise<{
  success: boolean
  message: string
  token?: string
  user?: {
    username: string
    name: string
    avatar: string
    email: string
  }
}> {
  try {
    // 尝试多个可能的登录端点（不同版本的兰空图床可能使用不同的端点）
    const loginAttempts = [
      {
        url: `${WMIMG_API_BASE}/tokens`,
        body: { email, password },
        description: '标准tokens端点',
      },
      {
        url: `${WMIMG_API_BASE}/login`,
        body: { email, password },
        description: 'login端点',
      },
      {
        url: `${WMIMG_API_BASE}/auth/login`,
        body: { email, password },
        description: 'auth/login端点',
      },
      {
        url: `${WMIMG_API_BASE}/tokens`,
        body: { username: email, password },
        description: '使用username字段',
      },
    ]

    let lastError: any = null
    let lastResponse: Response | null = null
    let lastResult: any = null

    for (const attempt of loginAttempts) {
      try {
        const response = await fetch(attempt.url, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(attempt.body),
        })

        const result = await response.json()
        lastResponse = response
        lastResult = result

        // 如果返回了token，说明这个端点是对的
        const token = result.data?.token || result.token || result.data?.access_token
        if (token && response.ok && result.status !== false) {
          // 保存token到cookie
          const cookieStore = await cookies()
          cookieStore.set('wmimg_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30天
            path: '/',
          })

          return {
            success: true,
            message: '登录成功',
            token,
            user: result.data?.user || result.user,
          }
        }

        // 如果返回了明确的错误信息（不是404），说明端点存在但登录失败
        if (response.status !== 404 && result.message) {
          return {
            success: false,
            message: result.message || '登录失败，请检查账号密码',
          }
        }
      } catch (error: any) {
        lastError = error
        // 继续尝试下一个端点
        continue
      }
    }

    // 如果所有端点都返回404或失败，说明可能不支持API登录
    if (lastResponse?.status === 404 || !lastResult) {
      return {
        success: false,
        message: '无铭图床可能不支持API登录。请从个人中心获取Token，然后在环境变量中设置 WMIMG_TOKEN，或使用手动输入Token功能。',
      }
    }

    // 返回最后一个明确的错误信息
    if (lastResult?.message) {
      return {
        success: false,
        message: lastResult.message || '登录失败，请检查账号密码',
      }
    }

    return {
      success: false,
      message: lastError?.message || '登录失败，请稍后重试',
    }
  } catch (error: any) {
    console.error('登录错误:', error)
    return {
      success: false,
      message: error.message || '登录过程中发生错误',
    }
  }
}

/**
 * 手动设置Token（从个人中心获取的Token）
 */
export async function setWmimgToken(token: string): Promise<{
  success: boolean
  message: string
}> {
  try {
    if (!token || token.trim() === '') {
      return {
        success: false,
        message: 'Token不能为空',
      }
    }

    // 验证Token是否有效（通过获取用户信息）
    const testResponse = await fetch(`${WMIMG_API_BASE}/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Accept': 'application/json',
      },
    })

    const testResult = await testResponse.json()

    if (!testResponse.ok || testResult.status === false) {
      return {
        success: false,
        message: testResult.message || 'Token无效，请检查Token是否正确',
      }
    }

    // Token有效，保存到cookie
    const cookieStore = await cookies()
    cookieStore.set('wmimg_token', token.trim(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30天
      path: '/',
    })

    return {
      success: true,
      message: 'Token设置成功',
    }
  } catch (error: any) {
    console.error('设置Token错误:', error)
    return {
      success: false,
      message: error.message || '设置Token过程中发生错误',
    }
  }
}

/**
 * 获取当前保存的Token
 */
export async function getWmimgToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('wmimg_token')
    return token?.value || null
  } catch (error) {
    return null
  }
}

/**
 * 清除Token（登出）
 */
export async function logoutWmimg() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('wmimg_token')
    return { success: true }
  } catch (error) {
    return { success: false }
  }
}

/**
 * 获取用户资料（验证token是否有效）
 */
export async function getWmimgProfile(): Promise<{
  success: boolean
  message: string
  data?: {
    username: string
    name: string
    avatar: string
    email: string
    capacity: number
    size: number
    url: string
    image_num: number
    album_num: number
  }
}> {
  try {
    const token = await getWmimgToken()
    if (!token) {
      return {
        success: false,
        message: '未登录，请先登录',
      }
    }

    const response = await fetch(`${WMIMG_API_BASE}/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    })

    const result = await response.json()

    if (!response.ok || result.status === false) {
      return {
        success: false,
        message: result.message || '获取用户信息失败',
      }
    }

    return {
      success: true,
      message: '获取成功',
      data: result.data,
    }
  } catch (error: any) {
    console.error('获取用户信息错误:', error)
    return {
      success: false,
      message: error.message || '获取用户信息过程中发生错误',
    }
  }
}

/**
 * 上传图片到无铭图床
 * @param formData FormData对象，包含file和其他可选参数
 * @returns 上传结果
 */
export async function uploadImage(formData: FormData): Promise<{
  success: boolean
  message: string
  data?: {
    key: string
    name: string
    pathname: string
    origin_name: string
    size: number
    mimetype: string
    extension: string
    md5: string
    sha1: string
    links: {
      url: string
      html: string
      bbcode: string
      markdown: string
      markdown_with_link: string
      thumbnail_url: string
      delete_url: string
    }
  }
}> {
  try {
    // 优先从cookie获取token，其次从环境变量获取
    const cookieToken = await getWmimgToken()
    const envToken = process.env.WMIMG_TOKEN
    const token = cookieToken || envToken

    // 强制要求token，如果没有token则拒绝上传
    if (!token) {
      return {
        success: false,
        message: '未设置Token，请先登录无铭图床。上传图片必须使用Token进行身份验证。',
      }
    }

    // 设置请求头，必须包含Authorization
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    }

    // 发送上传请求
    const response = await fetch(`${WMIMG_API_BASE}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })

    const result = await response.json()

    if (!response.ok) {
      return {
        success: false,
        message: result.message || `上传失败: ${response.status} ${response.statusText}`,
      }
    }

    if (result.status === false) {
      return {
        success: false,
        message: result.message || '上传失败',
      }
    }

    return {
      success: true,
      message: result.message || '上传成功',
      data: result.data,
    }
  } catch (error: any) {
    console.error('图片上传错误:', error)
    return {
      success: false,
      message: error.message || '上传过程中发生错误',
    }
  }
}

/**
 * 生成临时上传Token（可选功能）
 * @param num 生成数量，最大100
 * @param seconds 有效期(秒)，最大2626560 (一个月)
 * @returns 临时Token列表
 */
export async function generateUploadTokens(
  num: number = 1,
  seconds: number = 3600
): Promise<{
  success: boolean
  message: string
  data?: Array<{
    token: string
    expired_at: string
  }>
}> {
  try {
    const cookieToken = await getWmimgToken()
    const envToken = process.env.WMIMG_TOKEN
    const token = cookieToken || envToken

    if (!token) {
      return {
        success: false,
        message: '未登录或未配置WMIMG_TOKEN，无法生成临时Token',
      }
    }

    const response = await fetch(`${WMIMG_API_BASE}/images/tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        num: Math.min(num, 100),
        seconds: Math.min(seconds, 2626560),
      }),
    })

    const result = await response.json()

    if (!response.ok || result.status === false) {
      return {
        success: false,
        message: result.message || '生成Token失败',
      }
    }

    return {
      success: true,
      message: result.message || '生成成功',
      data: result.data?.tokens || [],
    }
  } catch (error: any) {
    console.error('生成Token错误:', error)
    return {
      success: false,
      message: error.message || '生成Token过程中发生错误',
    }
  }
}

