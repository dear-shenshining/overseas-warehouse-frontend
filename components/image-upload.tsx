'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, X, Check, Copy, Loader2, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { uploadImage } from '@/app/actions/image-upload'
import { useToast } from '@/hooks/use-toast'
import { WmimgLogin } from '@/components/wmimg-login'

interface UploadResult {
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

export function ImageUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [hasToken, setHasToken] = useState<boolean | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // 检查是否有token
  useEffect(() => {
    checkToken()
    // 每5秒检查一次token状态（用于登录后自动更新）
    const interval = setInterval(checkToken, 5000)
    return () => clearInterval(interval)
  }, [])

  const checkToken = async () => {
    try {
      const response = await fetch('/api/check-wmimg-token', {
        method: 'GET',
        cache: 'no-store',
      })
      const data = await response.json()
      setHasToken(data.hasToken || false)
    } catch (error) {
      setHasToken(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // 验证文件类型
      if (!selectedFile.type.startsWith('image/')) {
        toast({
          title: '文件类型错误',
          description: '请选择图片文件',
          variant: 'destructive',
        })
        return
      }
      setFile(selectedFile)
      setResult(null)
      setProgress(0)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: '请选择文件',
        description: '请先选择一个图片文件',
        variant: 'destructive',
      })
      return
    }

    // 检查是否有token
    if (hasToken === false) {
      toast({
        title: '需要登录',
        description: '上传图片需要先登录无铭图床，请先设置Token',
        variant: 'destructive',
      })
      return
    }

    setUploading(true)
    setProgress(0)

    try {
      // 创建FormData，强制设置为私密（0）
      const formData = new FormData()
      formData.append('file', file)
      formData.append('permission', '0') // 强制设置为私密

      // 模拟进度（实际进度需要根据API支持情况调整）
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev
          return prev + 10
        })
      }, 200)

      const response = await uploadImage(formData)

      clearInterval(progressInterval)
      setProgress(100)

      if (response.success && response.data) {
        setResult(response.data)
        toast({
          title: '上传成功',
          description: '图片已成功上传到无铭图床',
        })
      } else {
        toast({
          title: '上传失败',
          description: response.message || '上传过程中发生错误',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: '上传失败',
        description: error.message || '上传过程中发生错误',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast({
        title: '已复制',
        description: '内容已复制到剪贴板',
      })
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      toast({
        title: '复制失败',
        description: '无法复制到剪贴板',
        variant: 'destructive',
      })
    }
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* 登录状态 */}
      <div className="flex justify-end">
        <WmimgLogin />
      </div>

      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <ImageIcon className="h-6 w-6" />
          图片上传
        </h2>

        {/* 文件选择区域 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">选择图片文件</Label>
            <div className="flex items-center gap-4">
              <Input
                id="file-upload"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={uploading}
                className="flex-1"
              />
              {file && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleReset}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {file && (
              <div className="text-sm text-muted-foreground">
                已选择: {file.name} ({formatFileSize(file.size)})
              </div>
            )}
          </div>

          {hasToken === false && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <div className="text-sm text-yellow-800 dark:text-yellow-400">
                <strong>提示：</strong>上传图片需要先登录无铭图床。请点击右上角的"登录无铭图床"按钮设置Token。
              </div>
            </div>
          )}
          
          {hasToken === true && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="text-sm text-blue-800 dark:text-blue-400">
                <strong>注意：</strong>所有上传的图片将自动设置为<strong>私密</strong>，仅您本人可见。
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading || hasToken === false}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                上传图片
              </>
            )}
          </Button>

          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <div className="text-sm text-center text-muted-foreground">
                {progress}%
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 上传结果区域 */}
      {result && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">上传结果</h3>
          <div className="space-y-4">
            {/* 图片预览 */}
            <div className="space-y-2">
              <Label>图片预览</Label>
              <div className="border rounded-lg p-4 bg-muted/50">
                <img
                  src={result.links.url}
                  alt={result.origin_name}
                  className="max-w-full max-h-64 mx-auto rounded"
                />
              </div>
            </div>

            {/* 链接信息 */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>图片URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={result.links.url}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(result.links.url, 'url')}
                  >
                    {copiedField === 'url' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Markdown格式</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={result.links.markdown}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(result.links.markdown, 'markdown')}
                  >
                    {copiedField === 'markdown' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>HTML格式</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={result.links.html}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(result.links.html, 'html')}
                  >
                    {copiedField === 'html' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>BBCode格式</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={result.links.bbcode}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(result.links.bbcode, 'bbcode')}
                  >
                    {copiedField === 'bbcode' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>缩略图URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={result.links.thumbnail_url}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(result.links.thumbnail_url, 'thumbnail')}
                  >
                    {copiedField === 'thumbnail' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* 图片信息 */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <Label className="text-muted-foreground">原始文件名</Label>
                <div className="text-sm font-medium">{result.origin_name}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">文件大小</Label>
                <div className="text-sm font-medium">{formatFileSize(result.size * 1024)}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">文件类型</Label>
                <div className="text-sm font-medium">{result.mimetype}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">扩展名</Label>
                <div className="text-sm font-medium">{result.extension}</div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

