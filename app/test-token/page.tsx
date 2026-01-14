'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { setWmimgToken, getWmimgProfile } from '@/app/actions/image-upload'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

export default function TestTokenPage() {
  const [token, setToken] = useState('9b71a65ff526e684a41c10d80d7a2fa5')
  const [testing, setTesting] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setError(null)
    setProfile(null)

    try {
      // 先测试Token是否有效
      const testResponse = await fetch('https://wmimg.com/api/v1/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      })

      const testResult = await testResponse.json()

      if (testResponse.ok && testResult.status !== false) {
        setProfile(testResult.data)
        toast.success('Token有效！', {
          description: 'Token验证成功',
        })
      } else {
        setError(testResult.message || 'Token无效或已过期')
        toast.error('Token无效', {
          description: testResult.message || 'Token验证失败',
        })
      }
    } catch (err: any) {
      setError(err.message || '测试失败')
      toast.error('测试失败', {
        description: err.message || '无法连接到服务器',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSetToken = async () => {
    setTesting(true)
    setError(null)

    try {
      const result = await setWmimgToken(token)
      if (result.success) {
        toast.success('Token设置成功', {
          description: 'Token已保存到cookie',
        })
        // 重新获取用户信息
        const profileResult = await getWmimgProfile()
        if (profileResult.success && profileResult.data) {
          setProfile(profileResult.data)
        }
      } else {
        setError(result.message)
        toast.error('Token设置失败', {
          description: result.message,
        })
      }
    } catch (err: any) {
      setError(err.message || '设置失败')
      toast.error('设置失败', {
        description: err.message || '设置Token时发生错误',
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-6">测试无铭图床Token</h1>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <Input
              id="token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="输入Token"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleTest} disabled={testing || !token}>
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  测试中...
                </>
              ) : (
                '测试Token'
              )}
            </Button>
            <Button onClick={handleSetToken} disabled={testing || !token} variant="outline">
              设置Token
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="font-medium">错误</span>
              </div>
              <p className="mt-2 text-sm">{error}</p>
            </div>
          )}

          {profile && (
            <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-4">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">Token有效！用户信息：</span>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">用户名：</span>
                  {profile.username}
                </div>
                <div>
                  <span className="font-medium">昵称：</span>
                  {profile.name || '未设置'}
                </div>
                <div>
                  <span className="font-medium">邮箱：</span>
                  {profile.email}
                </div>
                <div>
                  <span className="font-medium">存储：</span>
                  {(profile.size / 1024).toFixed(2)} MB / {(profile.capacity / 1024).toFixed(2)} MB
                </div>
                <div>
                  <span className="font-medium">图片数：</span>
                  {profile.image_num}
                </div>
                <div>
                  <span className="font-medium">相册数：</span>
                  {profile.album_num}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

