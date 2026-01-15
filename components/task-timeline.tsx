"use client"

import { useState, useEffect, useTransition, useRef } from "react"
import { Search, Calendar, TrendingDown, Clock, AlertCircle, CheckCircle, Upload, Image as ImageIcon, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import { fetchTaskData, fetchTaskStatistics, updateTaskPromisedLand, updateTaskNotes, addTaskImageUrl, removeTaskImageUrl, confirmTaskCheck, confirmTaskReview, approveTask, rejectTask } from "@/app/actions/inventory"
import { uploadImage, getWmimgToken, loginWmimg, setWmimgToken } from "@/app/actions/image-upload"
import type { InventoryRecord } from "@/lib/inventory-data"
import { getLabelName } from "@/lib/label-mapping"
import { toast } from "sonner"

interface TaskTimelineProps {
  chargeFilter?: string
}

export default function TaskTimeline({ chargeFilter }: TaskTimelineProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [taskData, setTaskData] = useState<InventoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [updatingSku, setUpdatingSku] = useState<string | null>(null)
  const [uploadingSku, setUploadingSku] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [statistics, setStatistics] = useState({
    over_15_days: 0,
    has_inventory_no_sales: 0,
    no_solution: 0,
    in_progress: 0,
    checking: 0,
    reviewing: 0,
  })
  const [labelFilter, setLabelFilter] = useState<'over_15_days' | 'has_inventory_no_sales' | null>(null)
  const [statusFilter, setStatusFilter] = useState<'no_solution' | 'in_progress' | 'checking' | 'reviewing' | null>(null)
  const [promisedLandFilter, setPromisedLandFilter] = useState<number | null>(null) // 方案筛选：0=未选择，1=退回厂家，2=降价清仓，3=打处理
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectSku, setRejectSku] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [imagePreview, setImagePreview] = useState<{ sku: string; url: string } | null>(null)
  const [editingNotes, setEditingNotes] = useState<{ sku: string; value: string } | null>(null)
  const [updatingNotesSku, setUpdatingNotesSku] = useState<string | null>(null)
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  const pageSize = 50

  // 方案映射
  const getPromisedLandText = (value: number | undefined): string => {
    switch (value) {
      case 1:
        return '退回厂家'
      case 2:
        return '降价清仓'
      case 3:
        return '打处理'
      default:
        return '未选择方案'
    }
  }

  // 格式化倒计时：将小时数转换为"x天x小时"格式
  const formatCountDown = (hours: number | null | undefined): string => {
    if (hours === null || hours === undefined) {
      return '0天0小时'
    }
    
    // 如果为负数，显示为"已超时"
    if (hours < 0) {
      const absHours = Math.abs(hours)
      const days = Math.floor(absHours / 24)
      const remainingHours = Math.floor(absHours % 24)
      return `已超时 ${days}天${remainingHours}小时`
    }
    
    const days = Math.floor(hours / 24)
    const remainingHours = Math.floor(hours % 24)
    
    if (days === 0) {
      return `${remainingHours}小时`
    } else if (remainingHours === 0) {
      return `${days}天`
    } else {
      return `${days}天${remainingHours}小时`
    }
  }

  // 处理方案选择
  const handlePromisedLandChange = async (wareSku: string, value: string) => {
    const promisedLand = parseInt(value) as 0 | 1 | 2 | 3
    setUpdatingSku(wareSku)
    try {
      const result = await updateTaskPromisedLand(wareSku, promisedLand)
      if (result.success) {
        // 更新本地数据
        setTaskData((prev) =>
          prev.map((item) =>
            item.ware_sku === wareSku ? { ...item, promised_land: promisedLand } : item
          )
        )
      } else {
        console.error('更新方案失败:', result.error)
        toast.error('更新方案失败：' + (result.error || '未知错误'))
      }
    } catch (error: any) {
      console.error('更新方案失败:', error)
      toast.error('更新方案失败：' + (error?.message || '未知错误'))
    } finally {
      setUpdatingSku(null)
    }
  }

  // 自动登录无铭图床（检查是否有 token，如果没有则提示用户）
  const ensureWmimgLogin = async (): Promise<boolean> => {
    try {
      // 检查是否有 token
      const token = await getWmimgToken()
      if (token) {
        return true
      }

      // 如果没有 token，提示用户需要先登录
      toast.error('请先登录无铭图床。请访问 http://localhost:3000/image-upload 进行登录')
      return false
    } catch (error: any) {
      console.error('检查登录状态失败:', error)
      toast.error('检查登录状态失败：' + (error?.message || '未知错误'))
      return false
    }
  }

  // 处理图片上传（支持多文件）
  const handleImageUpload = async (wareSku: string, files: File[]) => {
    // 验证文件类型
    const invalidFiles = files.filter(file => !file.type.startsWith('image/'))
    if (invalidFiles.length > 0) {
      toast.error('请选择图片文件')
      return
    }

    // 确保已登录
    const isLoggedIn = await ensureWmimgLogin()
    if (!isLoggedIn) {
      return
    }

    setUploadingSku(wareSku)
    try {
      const uploadedUrls: string[] = []
      
      // 逐个上传文件
      for (const file of files) {
        // 创建 FormData
        const formData = new FormData()
        formData.append('file', file)
        formData.append('permission', '0') // 私密

        // 上传图片
        const uploadResult = await uploadImage(formData)
        
        if (uploadResult.success && uploadResult.data) {
          uploadedUrls.push(uploadResult.data.links.url)
        } else {
          toast.error(`图片 ${file.name} 上传失败：${uploadResult.message || '未知错误'}`)
        }
      }

      // 将所有上传成功的图片URL添加到数据库
      if (uploadedUrls.length > 0) {
        for (const imageUrl of uploadedUrls) {
          const updateResult = await addTaskImageUrl(wareSku, imageUrl)
          if (!updateResult.success) {
            toast.error(`添加图片URL失败：${updateResult.error || '未知错误'}`)
          }
        }
        
        // 重新加载数据以获取最新的图片列表
        await loadTaskData(searchQuery || undefined, labelFilter, statusFilter)
        toast.success(`成功上传 ${uploadedUrls.length} 张图片`)
      }
    } catch (error: any) {
      console.error('上传图片失败:', error)
      toast.error('上传图片失败：' + (error?.message || '未知错误'))
    } finally {
      setUploadingSku(null)
    }
  }

  // 处理文件选择（支持多文件）
  const handleFileSelect = (wareSku: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleImageUpload(wareSku, files)
    }
    // 重置 input，允许重复选择同一文件
    if (fileInputRefs.current[wareSku]) {
      fileInputRefs.current[wareSku]!.value = ''
    }
  }

  // 加载任务数据
  const loadTaskData = async (
    searchSku?: string,
    labelFilterType?: 'over_15_days' | 'has_inventory_no_sales' | null,
    statusFilterType?: 'no_solution' | 'in_progress' | 'checking' | 'reviewing' | null
  ) => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchTaskData(
        searchSku,
        labelFilterType || undefined,
        statusFilterType || undefined,
        chargeFilter
      )
      if (result.success) {
        // 应用方案筛选
        let filteredData = result.data
        if (promisedLandFilter !== null) {
          filteredData = filteredData.filter((item) => {
            const promisedLand = statusFilterType === 'checking' || statusFilterType === 'reviewing' 
              ? (item.promised_land_snapshot ?? item.promised_land)
              : item.promised_land
            return promisedLand === promisedLandFilter
          })
        }
        setTaskData(filteredData)
        setCurrentPage(1) // 重置到第一页
      } else {
        setError(result.error || "加载任务数据失败")
        setTaskData([])
      }
    } catch (error: any) {
      console.error("加载任务数据失败:", error)
      setError(error?.message || "加载任务数据失败，请检查数据库连接和表结构")
      setTaskData([])
    } finally {
      setLoading(false)
    }
  }

  // 加载统计数据
  const loadStatistics = async () => {
    try {
      const result = await fetchTaskStatistics(chargeFilter)
      if (result.success) {
        // 只提取需要的字段，忽略 timeout，使用可选链处理可能缺失的字段
        const data = result.data as any
        setStatistics({
          over_15_days: data.over_15_days || 0,
          has_inventory_no_sales: data.has_inventory_no_sales || 0,
          no_solution: data.no_solution || 0,
          in_progress: data.in_progress || 0,
          checking: data.checking || 0,
          reviewing: data.reviewing || 0,
        })
      }
    } catch (error: any) {
      console.error("加载统计数据失败:", error)
      // 统计数据失败不影响主数据加载，只记录错误
    }
  }

  // 处理标签卡片点击（前两个）
  const handleLabelCardClick = (filterType: 'over_15_days' | 'has_inventory_no_sales' | null) => {
    // 如果点击的是当前已选中的卡片，则取消筛选
    if (labelFilter === filterType) {
      setLabelFilter(null)
    } else {
      setLabelFilter(filterType)
    }
    setCurrentPage(1) // 重置到第一页
  }

  // 处理状态卡片点击
  const handleStatusCardClick = (filterType: 'no_solution' | 'in_progress' | 'checking' | 'reviewing' | null) => {
    // 如果点击的是当前已选中的卡片，则取消筛选
    if (statusFilter === filterType) {
      setStatusFilter(null)
    } else {
      setStatusFilter(filterType)
    }
    setCurrentPage(1) // 重置到第一页
  }

  // 处理确认完成检查（任务正在进行中点击确定）
  const handleConfirmCheck = async (wareSku: string) => {
    try {
      const result = await confirmTaskCheck(wareSku)
      if (result.success) {
        toast.success('已进入完成检查')
        await loadTaskData(searchQuery || undefined, labelFilter, statusFilter)
        await loadStatistics()
      } else {
        toast.error('确认失败：' + (result.error || '未知错误'))
      }
    } catch (error: any) {
      console.error('确认完成检查失败:', error)
      toast.error('确认失败：' + (error?.message || '未知错误'))
    }
  }

  // 处理确认审核
  const handleConfirmReview = async (wareSku: string) => {
    try {
      const result = await confirmTaskReview(wareSku)
      if (result.success) {
        toast.success('已进入审核')
        await loadTaskData(searchQuery || undefined, labelFilter, statusFilter)
        await loadStatistics()
      } else {
        toast.error('确认失败：' + (result.error || '未知错误'))
      }
    } catch (error: any) {
      console.error('确认审核失败:', error)
      toast.error('确认失败：' + (error?.message || '未知错误'))
    }
  }

  // 处理审核通过
  const handleApprove = async (wareSku: string) => {
    try {
      const result = await approveTask(wareSku)
      if (result.success) {
        toast.success('审核通过，任务已完成')
        await loadTaskData(searchQuery || undefined, labelFilter, statusFilter)
        await loadStatistics()
      } else {
        toast.error('审核失败：' + (result.error || '未知错误'))
      }
    } catch (error: any) {
      console.error('审核通过失败:', error)
      toast.error('审核失败：' + (error?.message || '未知错误'))
    }
  }

  // 处理审核打回
  const handleReject = async () => {
    if (!rejectSku || !rejectReason.trim()) {
      toast.error('请填写打回理由')
      return
    }
    try {
      const result = await rejectTask(rejectSku, rejectReason.trim())
      if (result.success) {
        toast.success('已打回')
        setRejectDialogOpen(false)
        setRejectSku(null)
        setRejectReason("")
        await loadTaskData(searchQuery || undefined, labelFilter, statusFilter)
        await loadStatistics()
      } else {
        toast.error('打回失败：' + (result.error || '未知错误'))
      }
    } catch (error: any) {
      console.error('审核打回失败:', error)
      toast.error('打回失败：' + (error?.message || '未知错误'))
    }
  }

  // 获取管理员权限
  useEffect(() => {
    // 从 cookie 中读取管理员权限
    const getCookie = (name: string) => {
      if (typeof document === 'undefined') return null
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) {
        const cookieValue = parts.pop()?.split(';').shift()
        return cookieValue ? decodeURIComponent(cookieValue) : null
      }
      return null
    }
    const adminValue = getCookie('is_admin')
    const isAdminUser = adminValue === 'true'
    setIsAdmin(isAdminUser)
    // 调试信息（开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.log('is_admin cookie value:', adminValue, 'isAdmin:', isAdminUser)
    }
  }, [])

  // 初始加载和筛选变化时重新加载
  useEffect(() => {
    loadTaskData(searchQuery || undefined, labelFilter, statusFilter)
    loadStatistics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelFilter, statusFilter, chargeFilter, promisedLandFilter])

  // 搜索功能
  const handleSearch = () => {
    startTransition(() => {
      loadTaskData(searchQuery || undefined, labelFilter, statusFilter)
    })
  }

  // 处理回车搜索
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  // 计算分页数据
  const totalPages = Math.ceil(taskData.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedData = taskData.slice(startIndex, endIndex)

  return (
    <div className="space-y-6">
      {/* 搜索栏和筛选器 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="搜索SKU货号..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-10"
          />
        </div>
        {/* 方案筛选器（仅在任务正在进行中、完成检查、审核中显示） */}
        {(statusFilter === 'in_progress' || statusFilter === 'checking' || statusFilter === 'reviewing') && (
          <Select
            value={promisedLandFilter !== null ? promisedLandFilter.toString() : 'all'}
            onValueChange={(value) => {
              setPromisedLandFilter(value === 'all' ? null : parseInt(value))
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="筛选方案" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部方案</SelectItem>
              <SelectItem value="0">未选择方案</SelectItem>
              <SelectItem value="1">退回厂家</SelectItem>
              <SelectItem value="2">降价清仓</SelectItem>
              <SelectItem value="3">打处理</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button onClick={handleSearch} disabled={isPending}>
          {isPending ? "搜索中..." : "搜索"}
        </Button>
      </div>

      {/* 完成检查提示框 */}
      {statusFilter === 'checking' && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                提示
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                退回厂家和降价清仓需要上传图片
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            labelFilter === 'over_15_days' ? 'ring-2 ring-chart-1 bg-chart-1/5' : ''
          }`}
          onClick={() => handleLabelCardClick(labelFilter === 'over_15_days' ? null : 'over_15_days')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-1/10 rounded-lg">
              <Calendar className="h-6 w-6 text-chart-1" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">在售天数超20天</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.over_15_days}</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            labelFilter === 'has_inventory_no_sales' ? 'ring-2 ring-chart-2 bg-chart-2/5' : ''
          }`}
          onClick={() => handleLabelCardClick(labelFilter === 'has_inventory_no_sales' ? null : 'has_inventory_no_sales')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-2/10 rounded-lg">
              <TrendingDown className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">有库存无销量</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.has_inventory_no_sales}</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'no_solution' ? 'ring-2 ring-chart-3 bg-chart-3/5' : ''
          }`}
          onClick={() => handleStatusCardClick(statusFilter === 'no_solution' ? null : 'no_solution')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-3/10 rounded-lg">
              <AlertCircle className="h-6 w-6 text-chart-3" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">未选择方案</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.no_solution}</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'in_progress' ? 'ring-2 ring-chart-4 bg-chart-4/5' : ''
          }`}
          onClick={() => handleStatusCardClick(statusFilter === 'in_progress' ? null : 'in_progress')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-4/10 rounded-lg">
              <Clock className="h-6 w-6 text-chart-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">任务正在进行中</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.in_progress}</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'checking' ? 'ring-2 ring-chart-5 bg-chart-5/5' : ''
          }`}
          onClick={() => handleStatusCardClick(statusFilter === 'checking' ? null : 'checking')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-5/10 rounded-lg">
              <CheckCircle className="h-6 w-6 text-chart-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">完成检查</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.checking}</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'reviewing' ? 'ring-2 ring-chart-6 bg-chart-6/5' : ''
          }`}
          onClick={() => handleStatusCardClick(statusFilter === 'reviewing' ? null : 'reviewing')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-6/10 rounded-lg">
              <AlertCircle className="h-6 w-6 text-chart-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">审核</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.reviewing}</p>
            </div>
          </div>
        </Card>

      </div>

      {/* 错误提示 */}
      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-destructive">错误：{error}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null)
                loadTaskData(searchQuery || undefined, labelFilter, statusFilter)
              }}
            >
              重试
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            请检查：1. PostgreSQL 服务是否启动 2. 数据库 seas_ware 是否存在 3. 表 task 是否存在 4. 数据库配置是否正确（.env 文件）
          </p>
        </Card>
      )}

      {/* Task Table */}
      <Card className="flex flex-col">
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 500px)', minHeight: '400px' }}>
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border sticky top-0">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">SKU货号</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">库存数量</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">最近七天销量</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">可售天数</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">负责人</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">标识</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">方案</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">倒计时</th>
                {(statusFilter === 'in_progress' || statusFilter === 'checking' || statusFilter === 'reviewing') && (
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">备注</th>
                )}
                {statusFilter === 'in_progress' && (
                  <>
                    <th className="px-6 py-4 text-left text-sm font-medium text-foreground">上传图片</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-foreground">图片</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-foreground">操作</th>
                  </>
                )}
                {statusFilter === 'checking' && (
                  <>
                    <th className="px-6 py-4 text-left text-sm font-medium text-foreground">打回理由</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-foreground">上传图片</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-foreground">图片</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-foreground">确定</th>
                  </>
                )}
                {statusFilter === 'reviewing' && (
                  <>
                    <th className="px-6 py-4 text-left text-sm font-medium text-foreground">图片</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-foreground">确定</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading || isPending ? (
                <tr>
                  <td colSpan={
                    statusFilter === 'in_progress' ? 12 : 
                    statusFilter === 'checking' ? 13 :
                    statusFilter === 'reviewing' ? 11 : 8
                  } className="px-6 py-8 text-center text-sm text-muted-foreground">
                    加载中...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={
                    statusFilter === 'in_progress' ? 12 : 
                    statusFilter === 'checking' ? 13 :
                    statusFilter === 'reviewing' ? 11 : 8
                  } className="px-6 py-8 text-center text-sm text-destructive">
                    数据加载失败，请查看上方错误提示
                  </td>
                </tr>
              ) : taskData.length === 0 ? (
                <tr>
                  <td colSpan={
                    statusFilter === 'in_progress' ? 12 : 
                    statusFilter === 'checking' ? 13 :
                    statusFilter === 'reviewing' ? 11 : 8
                  } className="px-6 py-8 text-center text-sm text-muted-foreground">
                    暂无数据
                  </td>
                </tr>
              ) : (
                paginatedData.map((record, index) => {
                  const labels = Array.isArray(record.label) ? record.label : []
                  return (
                    <tr key={`${record.ware_sku}-${index}`} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-foreground">{record.ware_sku}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{record.inventory_num}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{record.sales_num}</td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {record.sale_day !== null && record.sale_day !== undefined ? record.sale_day : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{record.charge || '-'}</td>
                      <td className="px-6 py-4">
                        {labels.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {labels.map((label, idx) => (
                              <span
                                key={idx}
                                className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-chart-2/10 text-chart-2"
                              >
                                {getLabelName(label)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {(statusFilter === 'checking' || statusFilter === 'reviewing') ? (
                          // 完成检查和审核中：显示固定方案（从promised_land_snapshot读取）
                          <span className="text-sm text-foreground">
                            {getPromisedLandText(record.promised_land_snapshot ?? record.promised_land)}
                          </span>
                        ) : (
                          // 其他状态：可编辑
                          <Select
                            value={record.promised_land?.toString() || '0'}
                            onValueChange={(value) => handlePromisedLandChange(record.ware_sku, value)}
                            disabled={updatingSku === record.ware_sku}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-sm">
                              <SelectValue>
                                {getPromisedLandText(record.promised_land)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">未选择方案</SelectItem>
                              <SelectItem value="1">退回厂家</SelectItem>
                              <SelectItem value="2">降价清仓</SelectItem>
                              <SelectItem value="3">打处理</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatCountDown(record.count_down)}
                      </td>
                      {(statusFilter === 'in_progress' || statusFilter === 'checking' || statusFilter === 'reviewing') && (
                        <td className="px-6 py-4">
                          {editingNotes?.sku === record.ware_sku ? (
                            <Input
                              value={editingNotes.value}
                              onChange={(e) => setEditingNotes({...editingNotes, value: e.target.value})}
                              onBlur={async () => {
                                if (editingNotes) {
                                  setUpdatingNotesSku(record.ware_sku)
                                  const result = await updateTaskNotes(record.ware_sku, editingNotes.value || null)
                                  if (result.success) {
                                    // 更新本地数据
                                    setTaskData((prev) =>
                                      prev.map((item) =>
                                        item.ware_sku === record.ware_sku
                                          ? { ...item, notes: editingNotes.value || null }
                                          : item
                                      )
                                    )
                                    setEditingNotes(null)
                                    toast.success('备注已更新')
                                  } else {
                                    toast.error('更新备注失败：' + (result.error || '未知错误'))
                                  }
                                  setUpdatingNotesSku(null)
                                }
                              }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur()
                                }
                              }}
                              className="w-full min-w-[200px]"
                              autoFocus
                              disabled={updatingNotesSku === record.ware_sku}
                            />
                          ) : (
                            <span 
                              className="text-sm text-muted-foreground cursor-pointer hover:text-foreground"
                              onClick={() => setEditingNotes({sku: record.ware_sku, value: record.notes || ''})}
                            >
                              {record.notes || '-'}
                            </span>
                          )}
                        </td>
                      )}
                      {statusFilter === 'in_progress' && (
                        <>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <input
                                ref={(el) => {
                                  fileInputRefs.current[record.ware_sku] = el
                                }}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleFileSelect(record.ware_sku, e)}
                                className="hidden"
                                disabled={uploadingSku === record.ware_sku}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fileInputRefs.current[record.ware_sku]?.click()}
                                disabled={uploadingSku === record.ware_sku}
                                className="gap-2"
                              >
                                {uploadingSku === record.ware_sku ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    上传中
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4" />
                                    上传
                                  </>
                                )}
                              </Button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {record.image_urls && record.image_urls.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {record.image_urls.map((imageUrl, idx) => (
                                  <div key={idx} className="relative group">
                                    <img
                                      src={imageUrl}
                                      alt={`${record.ware_sku}-${idx}`}
                                      className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity border border-border"
                                      onClick={() => setImagePreview({ sku: record.ware_sku, url: imageUrl })}
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        const result = await removeTaskImageUrl(record.ware_sku, imageUrl)
                                        if (result.success) {
                                          // 更新本地数据
                                          setTaskData((prev) =>
                                            prev.map((item) =>
                                              item.ware_sku === record.ware_sku
                                                ? {
                                                    ...item,
                                                    image_urls: (item.image_urls || []).filter(url => url !== imageUrl)
                                                  }
                                                : item
                                            )
                                          )
                                          toast.success('图片已删除')
                                        } else {
                                          toast.error('删除图片失败：' + (result.error || '未知错误'))
                                        }
                                      }}
                                      className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <Button
                              size="sm"
                              onClick={() => handleConfirmCheck(record.ware_sku)}
                              className="gap-2"
                            >
                              <CheckCircle className="h-4 w-4" />
                              确认完成
                            </Button>
                          </td>
                        </>
                      )}
                      {statusFilter === 'checking' && (
                        <>
                          <td className="px-6 py-4">
                            <span className="text-sm text-muted-foreground">
                              {record.reject_reason || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <input
                                ref={(el) => {
                                  fileInputRefs.current[record.ware_sku] = el
                                }}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleFileSelect(record.ware_sku, e)}
                                className="hidden"
                                disabled={uploadingSku === record.ware_sku}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fileInputRefs.current[record.ware_sku]?.click()}
                                disabled={uploadingSku === record.ware_sku}
                                className="gap-2"
                              >
                                {uploadingSku === record.ware_sku ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    上传中
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4" />
                                    上传
                                  </>
                                )}
                              </Button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              // 确保 image_urls 是数组格式
                              let imageUrls: string[] = []
                              if (record.image_urls) {
                                if (Array.isArray(record.image_urls)) {
                                  imageUrls = record.image_urls
                                } else if (typeof record.image_urls === 'string') {
                                  try {
                                    imageUrls = JSON.parse(record.image_urls)
                                    if (!Array.isArray(imageUrls)) {
                                      imageUrls = []
                                    }
                                  } catch (e) {
                                    console.warn('解析 image_urls 失败:', record.image_urls)
                                    imageUrls = []
                                  }
                                }
                              }
                              
                              return imageUrls.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {imageUrls.map((imageUrl: string, idx: number) => (
                                    <div key={idx} className="relative group">
                                      <img
                                        src={imageUrl}
                                        alt={`${record.ware_sku}-${idx}`}
                                        className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity border border-border"
                                        onClick={() => setImagePreview({ sku: record.ware_sku, url: imageUrl })}
                                        onError={(e) => {
                                          console.error('图片加载失败:', imageUrl)
                                          e.currentTarget.style.display = 'none'
                                        }}
                                      />
                                      {/* 完成检查状态下不显示删除按钮 */}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )
                            })()}
                          </td>
                          <td className="px-6 py-4">
                            <Button
                              size="sm"
                              onClick={() => handleConfirmReview(record.ware_sku)}
                              className="gap-2"
                            >
                              <CheckCircle className="h-4 w-4" />
                              确认
                            </Button>
                          </td>
                        </>
                      )}
                      {statusFilter === 'reviewing' && (
                        <>
                          <td className="px-6 py-4">
                            {record.image_urls && record.image_urls.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {record.image_urls.map((imageUrl, idx) => (
                                  <div key={idx} className="relative group">
                                    <img
                                      src={imageUrl}
                                      alt={`${record.ware_sku}-${idx}`}
                                      className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity border border-border"
                                      onClick={() => setImagePreview({ sku: record.ware_sku, url: imageUrl })}
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isAdmin ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleApprove(record.ware_sku)}
                                  className="gap-2"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  通过
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setRejectSku(record.ware_sku)
                                    setRejectDialogOpen(true)
                                  }}
                                  className="gap-2"
                                >
                                  <X className="h-4 w-4" />
                                  打回
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">仅管理员可操作</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 数据统计和分页 */}
        {!loading && !error && taskData.length > 0 && (
          <div className="p-4 border-t border-border">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                显示第 {startIndex + 1} - {Math.min(endIndex, taskData.length)} 条，共 {taskData.length} 条记录
              </div>
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (currentPage > 1) setCurrentPage(currentPage - 1)
                        }}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {(() => {
                      const pages: (number | 'ellipsis')[] = []

                      if (totalPages <= 7) {
                        // 如果总页数少于等于7页，显示所有页码
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(i)
                        }
                      } else {
                        // 总是显示第一页
                        pages.push(1)

                        if (currentPage <= 3) {
                          // 当前页在前3页
                          for (let i = 2; i <= 4; i++) {
                            pages.push(i)
                          }
                          pages.push('ellipsis')
                          pages.push(totalPages)
                        } else if (currentPage >= totalPages - 2) {
                          // 当前页在后3页
                          pages.push('ellipsis')
                          for (let i = totalPages - 3; i <= totalPages; i++) {
                            pages.push(i)
                          }
                        } else {
                          // 当前页在中间
                          pages.push('ellipsis')
                          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                            pages.push(i)
                          }
                          pages.push('ellipsis')
                          pages.push(totalPages)
                        }
                      }

                      return pages.map((page, index) => {
                        if (page === 'ellipsis') {
                          return (
                            <PaginationItem key={`ellipsis-${index}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )
                        }
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                setCurrentPage(page)
                              }}
                              isActive={currentPage === page}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      })
                    })()}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                        }}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </div>
        )}
        {!loading && !error && taskData.length === 0 && (
          <div className="p-4 border-t border-border text-center text-sm text-muted-foreground">
            暂无数据
          </div>
        )}
      </Card>

      {/* 图片预览对话框 */}
      <Dialog open={!!imagePreview} onOpenChange={(open) => !open && setImagePreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>图片预览 - {imagePreview?.sku}</DialogTitle>
            <DialogDescription>
              点击图片可以查看大图
            </DialogDescription>
          </DialogHeader>
          {imagePreview && (
            <div className="flex justify-center">
              <img
                src={imagePreview.url}
                alt={imagePreview.sku}
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 打回理由对话框 */}
      <Dialog open={rejectDialogOpen} onOpenChange={(open) => {
        setRejectDialogOpen(open)
        if (!open) {
          setRejectSku(null)
          setRejectReason("")
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>打回理由</DialogTitle>
            <DialogDescription>
              请填写打回理由
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">打回理由</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="请输入打回理由..."
                className="min-h-[100px] mt-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false)
                  setRejectSku(null)
                  setRejectReason("")
                }}
              >
                取消
              </Button>
              <Button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
              >
                确认打回
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
