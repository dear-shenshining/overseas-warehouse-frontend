/**
 * 测试无铭图床Token是否有效
 * 使用方法: npx tsx scripts/test-wmimg-token.ts <token>
 */

const WMIMG_API_BASE = 'https://wmimg.com/api/v1'
const token = process.argv[2] || '9b71a65ff526e684a41c10d80d7a2fa5'

async function testToken() {
  console.log('正在测试Token:', token)
  console.log('---')

  try {
    // 测试获取用户信息
    const response = await fetch(`${WMIMG_API_BASE}/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    })

    const result = await response.json()

    console.log('响应状态:', response.status, response.statusText)
    console.log('响应内容:', JSON.stringify(result, null, 2))

    if (response.ok && result.status !== false) {
      console.log('\n✅ Token有效！')
      console.log('用户信息:')
      console.log('  用户名:', result.data?.username)
      console.log('  昵称:', result.data?.name)
      console.log('  邮箱:', result.data?.email)
      console.log('  容量:', result.data?.capacity, 'KB')
      console.log('  已用:', result.data?.size, 'KB')
      console.log('  图片数:', result.data?.image_num)
      console.log('  相册数:', result.data?.album_num)
    } else {
      console.log('\n❌ Token无效或已过期')
      console.log('错误信息:', result.message || '未知错误')
    }
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message)
  }
}

testToken()








