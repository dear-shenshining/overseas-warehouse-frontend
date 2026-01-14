'use client'

import { useState, useEffect } from 'react'
import { LogIn, LogOut, User, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { loginWmimg, logoutWmimg, getWmimgProfile, setWmimgToken } from '@/app/actions/image-upload'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface UserProfile {
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

export function WmimgLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [checking, setChecking] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const { toast } = useToast()

  // 检查登录状态
  useEffect(() => {
    checkLoginStatus()
  }, [])

  const checkLoginStatus = async () => {
    setChecking(true)
    try {
      const result = await getWmimgProfile()
      if (result.success && result.data) {
        setProfile(result.data)
      } else {
        setProfile(null)
      }
    } catch (error) {
      setProfile(null)
    } finally {
      setChecking(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await loginWmimg(email, password)
      if (result.success) {
        toast({
          title: '登录成功',
          description: '已成功登录无铭图床',
        })
        setEmail('')
        setPassword('')
        setDialogOpen(false)
        // 重新获取用户信息
        await checkLoginStatus()
      } else {
        toast({
          title: '登录失败',
          description: result.message || '登录失败，请检查账号密码',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: '登录失败',
        description: error.message || '登录过程中发生错误',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSetToken = async (e: React.FormEvent) => {
    e.preventDefault()
    setTokenLoading(true)

    try {
      const result = await setWmimgToken(tokenInput)
      if (result.success) {
        toast({
          title: 'Token设置成功',
          description: 'Token已成功保存',
        })
        setTokenInput('')
        setDialogOpen(false)
        // 重新获取用户信息
        await checkLoginStatus()
      } else {
        toast({
          title: 'Token设置失败',
          description: result.message || 'Token无效',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Token设置失败',
        description: error.message || '设置Token过程中发生错误',
        variant: 'destructive',
      })
    } finally {
      setTokenLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logoutWmimg()
      setProfile(null)
      toast({
        title: '已登出',
        description: '已成功登出无铭图床',
      })
    } catch (error: any) {
      toast({
        title: '登出失败',
        description: error.message || '登出过程中发生错误',
        variant: 'destructive',
      })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>检查登录状态...</span>
      </div>
    )
  }

  if (profile) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="font-medium">{profile.name || profile.username}</div>
              <div className="text-sm text-muted-foreground">{profile.email}</div>
              <div className="text-xs text-muted-foreground mt-1">
                已用: {formatFileSize(profile.size * 1024)} / {formatFileSize(profile.capacity * 1024)}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            登出
          </Button>
        </div>
        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">图片数量</div>
            <div className="font-medium">{profile.image_num}</div>
          </div>
          <div>
            <div className="text-muted-foreground">相册数量</div>
            <div className="font-medium">{profile.album_num}</div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <LogIn className="h-4 w-4 mr-2" />
          登录无铭图床
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>登录无铭图床</DialogTitle>
          <DialogDescription>
            登录后可以使用您的账号上传图片，获取更多功能
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="password" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password">账号密码</TabsTrigger>
            <TabsTrigger value="token">手动输入Token</TabsTrigger>
          </TabsList>
          
          <TabsContent value="password" className="space-y-4 mt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱或用户名</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="请输入邮箱或用户名"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                * 如果API不支持登录，请使用"手动输入Token"方式
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    登录中...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    登录
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="token" className="space-y-4 mt-4">
            <form onSubmit={handleSetToken} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Token</Label>
                <Input
                  id="token"
                  type="text"
                  placeholder="从个人中心获取的Token"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  required
                  disabled={tokenLoading}
                />
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>* 从无铭图床个人中心获取Token</p>
                <p>* Token将保存30天，无需重复输入</p>
                <p>* Token格式示例: 1|1bJbwlqBfnggmOMEZqXT5XusaIwqiZjCDs7r1Ob5</p>
              </div>
              <Button type="submit" className="w-full" disabled={tokenLoading}>
                {tokenLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    验证中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    设置Token
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

