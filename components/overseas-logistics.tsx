"use client"

import { useState, useEffect, useTransition, useRef, forwardRef, useImperativeHandle } from "react"
import { Search, Download, Upload, Package, Calendar, MapPin, AlertCircle, RefreshCw, CheckCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import { fetchLogisticsData, fetchLogisticsStatistics, importLogisticsFile, updateLogisticsStatus, updateLogisticsField, batchSearchLogistics } from "@/app/actions/logistics"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import type { LogisticsRecord } from "@/lib/logistics-data"
import { getStatusLabel } from "@/lib/status-mapping"
import * as XLSX from "xlsx"

interface OverseasLogisticsProps {
  onLastUpdateTimeChange?: (time: Date | null) => void
}

export interface OverseasLogisticsRef {
  handleUpdate: () => void
  clearCrawlerProgress: () => void
}

const OverseasLogistics = forwardRef<OverseasLogisticsRef, OverseasLogisticsProps>(
  ({ onLastUpdateTimeChange }, ref) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [logisticsData, setLogisticsData] = useState<LogisticsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [statistics, setStatistics] = useState({
    in_transit: 0,
    returned: 0,
    not_online: 0,
    online_abnormal: 0,
    not_queried: 0,
    delivered: 0,
    total: 0,
    has_transfer: 0,
    updated_today: 0,
  })
  const [error, setError] = useState<string | null>(null)
  // 获取当月第一天和最后一天的辅助函数
  const getCurrentMonthRange = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    
    // 当月第一天
    const firstDay = new Date(year, month, 1)
    const dateFrom = `${year}-${String(month + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
    
    // 当月最后一天
    const lastDay = new Date(year, month + 1, 0)
    const dateTo = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
    
    return { dateFrom, dateTo }
  }

  const [statusFilter, setStatusFilter] = useState<'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | 'not_queried' | 'delivered' | 'total' | null>(null)
  const [hasTransferFilter, setHasTransferFilter] = useState<boolean>(false)
  const [updatedAtTodayFilter, setUpdatedAtTodayFilter] = useState<boolean>(false)
  const { dateFrom: defaultDateFrom, dateTo: defaultDateTo } = getCurrentMonthRange()
  // 日期选择器的值（不会自动触发搜索）
  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom)
  const [dateTo, setDateTo] = useState<string>(defaultDateTo)
  // 实际用于搜索的日期（点击搜索按钮后更新）
  const [activeDateFrom, setActiveDateFrom] = useState<string>(defaultDateFrom)
  const [activeDateTo, setActiveDateTo] = useState<string>(defaultDateTo)
  const [editingField, setEditingField] = useState<{id: number, field: 'transfer_num' | 'order_num' | 'notes', value: string} | null>(null)
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [searchResult, setSearchResult] = useState<{total: number, found: number, notFound: string[]} | null>(null)
  const [actualSearchNumbers, setActualSearchNumbers] = useState<string[]>([]) // 实际搜索到的单号列表
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [importing, setImporting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [forceStop, setForceStop] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  const [importResult, setImportResult] = useState<{
    success: boolean
    message?: string
    error?: string
  } | null>(null)
  const [updateResult, setUpdateResult] = useState<{
    success: boolean
    message?: string
    error?: string
  } | null>(null)
  const [crawlerProgress, setCrawlerProgress] = useState<{
    lastProcessedId: number
    maxId: number
    totalProcessed: number
    totalSuccess: number
    totalFailed: number
    totalSkipped: number
    roundCount: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pageSize = 50

  // 从 localStorage 恢复爬虫进度
  useEffect(() => {
    const savedProgress = localStorage.getItem('crawlerProgress')
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress)
        setCrawlerProgress(progress)
        console.log('📋 从本地存储恢复爬虫进度:', progress)
      } catch (error) {
        console.error('恢复爬虫进度失败:', error)
        localStorage.removeItem('crawlerProgress')
      }
    }
  }, [])

  // 加载物流数据（支持分页）
  const loadLogisticsData = async (
    searchNum?: string,
    filter?: 'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | 'not_queried' | 'delivered' | 'total' | null,
    page: number = 1
  ) => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchLogisticsData(
        searchNum, 
        filter || undefined, 
        activeDateFrom && activeDateFrom.trim() ? activeDateFrom : undefined,
        activeDateTo && activeDateTo.trim() ? activeDateTo : undefined,
        page,
        pageSize,
        undefined, // createdAtToday
        hasTransferFilter,
        updatedAtTodayFilter
      )
      if (result.success) {
        setLogisticsData(result.data)
        // 使用后端返回的总数
        const total = (result as any).total || result.data.length
        setTotalRecords(total)
        setTotalPages(Math.ceil(total / pageSize))
        setCurrentPage(page)
      } else {
        setError(result.error || "加载物流数据失败")
        setLogisticsData([])
        setTotalRecords(0)
        setTotalPages(0)
      }
    } catch (error: any) {
      console.error("加载物流数据失败:", error)
      setError(error?.message || "加载物流数据失败，请检查数据库连接和表结构")
      setLogisticsData([])
      setTotalRecords(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }

  // 加载统计数据
  const loadStatistics = async () => {
    try {
      const dateFromValue = activeDateFrom && activeDateFrom.trim() ? activeDateFrom : undefined
      const dateToValue = activeDateTo && activeDateTo.trim() ? activeDateTo : undefined
      
      console.log('📊 加载统计数据，日期筛选:', { dateFrom: dateFromValue, dateTo: dateToValue })
      
      const result = await fetchLogisticsStatistics(dateFromValue, dateToValue)
      if (result.success) {
        console.log('📊 统计数据加载成功:', result.data)
        setStatistics({
          ...result.data,
          not_queried: result.data.not_queried ?? 0,
          total: result.data.total ?? 0,
          has_transfer: result.data.has_transfer ?? 0,
        })
      } else {
        console.error('📊 统计数据加载失败:', result.error)
      }
    } catch (error: any) {
      console.error("加载统计数据失败:", error)
      // 统计数据失败不影响主数据加载，只记录错误
    }
  }

  // 初始加载（并行加载数据和统计）
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true)
        setError(null)

        // 并行加载数据和统计
        const [dataResult, statsResult] = await Promise.allSettled([
            fetchLogisticsData(
              undefined, 
              statusFilter || undefined, 
              activeDateFrom && activeDateFrom.trim() ? activeDateFrom : undefined,
              activeDateTo && activeDateTo.trim() ? activeDateTo : undefined,
              1, // page
              pageSize,
              false, // createdAtToday
              hasTransferFilter // hasTransferFilter
            ),
          fetchLogisticsStatistics(
            activeDateFrom && activeDateFrom.trim() ? activeDateFrom : undefined,
            activeDateTo && activeDateTo.trim() ? activeDateTo : undefined
          )
        ])

        // 处理数据结果
        if (dataResult.status === 'fulfilled' && dataResult.value.success) {
          setLogisticsData(dataResult.value.data)
          // 使用后端返回的总数
          const total = (dataResult.value as any).total || dataResult.value.data.length
          setTotalRecords(total)
          setTotalPages(Math.ceil(total / pageSize))
          setCurrentPage(1)
        } else {
          const error = dataResult.status === 'rejected' ? dataResult.reason :
                       (dataResult.value as any)?.error || "加载物流数据失败"
          setError(error)
          setLogisticsData([])
          setTotalRecords(0)
          setTotalPages(0)
        }

        // 处理统计结果
        if (statsResult.status === 'fulfilled' && statsResult.value.success) {
          setStatistics({
            ...statsResult.value.data,
            not_queried: statsResult.value.data.not_queried ?? 0,
            total: statsResult.value.data.total ?? 0,
            has_transfer: statsResult.value.data.has_transfer ?? 0,
            updated_today: statsResult.value.data.updated_today ?? 0,
          })
        } else {
          console.error("加载统计数据失败:", statsResult.status === 'rejected' ? statsResult.reason : statsResult.value)
          // 统计失败不影响主数据加载
        }
      } catch (error: any) {
        console.error("加载数据失败:", error)
        setError(error?.message || "加载数据失败，请检查数据库连接")
        setLogisticsData([])
          setStatistics({
            in_transit: 0,
            returned: 0,
            not_online: 0,
            online_abnormal: 0,
            not_queried: 0,
            delivered: 0,
            total: 0,
            has_transfer: 0,
            updated_today: 0,
          })
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
  }, [statusFilter, hasTransferFilter, updatedAtTodayFilter, activeDateFrom, activeDateTo])

  // 解析多个发货单号（支持多种分隔符）
  const parseSearchNumbers = (input: string): string[] => {
    if (!input.trim()) return []
    
    // 支持的分隔符：空格、逗号（中英文）、顿号、换行符
    const separators = /[\s,，、\n]+/
    const numbers = input
      .split(separators)
      .map(s => s.trim())
      .filter(s => s.length > 0)
    
    return numbers
  }

  // 搜索功能（支持多个单号）
  const handleSearch = async () => {
    // 点击搜索时，更新实际用于搜索的日期
    setActiveDateFrom(dateFrom)
    setActiveDateTo(dateTo)
    
    if (!searchQuery.trim()) {
      // 如果没有输入，直接加载所有数据（使用更新后的日期）
      startTransition(() => {
        loadLogisticsData(undefined, statusFilter, 1)
        loadStatistics()
      })
      return
    }

    const searchNumbers = parseSearchNumbers(searchQuery)
    
    if (searchNumbers.length === 1) {
      // 单个单号，直接搜索
      setActualSearchNumbers(searchNumbers) // 保存搜索的单号
      startTransition(() => {
        loadLogisticsData(searchNumbers[0], statusFilter, 1)
        loadStatistics()
      })
    } else {
      // 多个单号，先批量查询，然后显示结果
      const result = await batchSearchLogistics(searchNumbers)
      if (result.success) {
        setSearchResult({
          total: searchNumbers.length,
          found: result.found.length,
          notFound: result.notFound,
        })
        setSearchDialogOpen(true)
        
        // 使用找到的单号进行查询
        if (result.found.length > 0) {
          setActualSearchNumbers(result.found) // 保存实际找到的单号
          startTransition(() => {
            loadLogisticsData(result.found.join(','), statusFilter, 1)
            loadStatistics()
          })
        } else {
          setActualSearchNumbers([]) // 没有找到，清空
          setLogisticsData([])
          setTotalRecords(0)
          setTotalPages(0)
        }
      }
    }
  }

  // 清空搜索
  const handleClearSearch = () => {
    setSearchQuery("")
    setActualSearchNumbers([]) // 清空实际搜索到的单号列表
    // 清空搜索时，使用当前的日期筛选
    startTransition(() => {
      loadLogisticsData(undefined, statusFilter, 1)
      loadStatistics()
    })
  }

  // 处理卡片点击筛选
  const handleCardClick = (filterType: 'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | 'not_queried' | 'delivered' | 'total' | null) => {
    // 如果点击的是当前已选中的卡片，则取消筛选
    if (statusFilter === filterType) {
      setStatusFilter(null)
    } else {
      setStatusFilter(filterType)
    }
    // 筛选条件改变时会触发 useEffect 重新加载，不需要手动调用
  }

  // 处理转单卡片点击（可以与其他状态筛选组合）
  const handleTransferCardClick = () => {
    setHasTransferFilter(!hasTransferFilter)
  }

  // 处理今日更新卡片点击
  const handleUpdatedTodayCardClick = () => {
    setUpdatedAtTodayFilter(!updatedAtTodayFilter)
  }

  // 重置所有筛选
  const handleResetFilters = () => {
    setStatusFilter(null)
    setHasTransferFilter(false)
    setUpdatedAtTodayFilter(false)
    // 重置日期选择器为当月
    const { dateFrom: defaultDateFrom, dateTo: defaultDateTo } = getCurrentMonthRange()
    setDateFrom(defaultDateFrom)
    setDateTo(defaultDateTo)
    // 重置实际用于搜索的日期
    setActiveDateFrom(defaultDateFrom)
    setActiveDateTo(defaultDateTo)
    setSearchQuery("")
    setActualSearchNumbers([]) // 清空实际搜索到的单号列表
    startTransition(() => {
      loadLogisticsData(undefined, null, 1)
      loadStatistics()
    })
  }

  // 更新字段（转单号、订单号、备注）
  const handleFieldUpdate = async (id: number, field: 'transfer_num' | 'order_num' | 'notes', value: string) => {
    // 转单号验证：只能是数字
    if (field === 'transfer_num' && value && !/^\d+$/.test(value)) {
      alert('转单号只能包含数字')
      return
    }

    // 保存原始值，用于失败时回滚
    const originalRecord = logisticsData.find(r => r.id === id)
    if (!originalRecord) return

    const originalValue = originalRecord[field]
    const newValue = value || null

    // 乐观更新：立即更新本地状态
    setLogisticsData(prevData => 
      prevData.map(record => 
        record.id === id 
          ? { ...record, [field]: newValue }
          : record
      )
    )
    setEditingField(null)

    // 异步更新数据库
    try {
      const result = await updateLogisticsField(id, field, newValue)
      if (!result.success) {
        // 更新失败，回滚本地状态
        setLogisticsData(prevData => 
          prevData.map(record => 
            record.id === id 
              ? { ...record, [field]: originalValue }
              : record
          )
        )
        alert(result.error || '更新失败')
      }
    } catch (error) {
      // 发生错误，回滚本地状态
      setLogisticsData(prevData => 
        prevData.map(record => 
          record.id === id 
            ? { ...record, [field]: originalValue }
            : record
        )
      )
      alert('更新失败，请重试')
    }
  }

  // 获取显示的状态（转单号优先）
  // 后端已经通过LEFT JOIN查询了转单号对应的状态，这里直接返回即可
  const getDisplayState = (record: LogisticsRecord): string => {
    // 后端查询时已经使用 COALESCE(t.states, p.states) 处理了转单号优先逻辑
    return record.states
  }

  // 处理回车搜索
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  // 处理分页切换
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      loadLogisticsData(searchQuery || undefined, statusFilter, page)
    }
  }

  // 分页数据（后端已分页，直接使用）
  const paginatedData = logisticsData

  // 处理文件选择（导入）
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('请选择Excel文件（.xlsx或.xls格式）')
      return
    }

    // 验证文件大小（10MB）
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      alert('文件大小不能超过10MB')
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      // 创建FormData
      const formData = new FormData()
      formData.append('file', file)

      // 调用Server Action导入
      const result = await importLogisticsFile(formData)

      setImportResult({
        success: result.success,
        message: 'message' in result ? result.message : undefined,
        error: 'error' in result ? result.error : undefined,
      })

      // 导入成功后，刷新数据
      if (result.success) {
        await loadLogisticsData(searchQuery || undefined, statusFilter, currentPage)
        await loadStatistics()
      }
    } catch (error: any) {
      console.error('导入失败:', error)
      setImportResult({
        success: false,
        error: error.message || '导入失败，请重试',
      })
    } finally {
      setImporting(false)
      // 清空文件输入，以便可以重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 处理更新按钮（运行爬虫）
  const handleUpdate = async (startId?: number, maxId?: number) => {
    setUpdating(true)

    // 从参数、组件状态或localStorage中获取进度
    let progress = {
      lastProcessedId: startId || 0,
      maxId: maxId || 0,
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
      totalSkipped: 0,
      roundCount: 0
    }

    // 如果没有传入参数，尝试从组件状态或localStorage恢复
    if (!startId && !maxId) {
      if (crawlerProgress) {
        progress = { ...crawlerProgress }
        console.log('📋 从组件状态恢复进度:', progress)
      } else {
        const savedProgress = localStorage.getItem('crawlerProgress')
        if (savedProgress) {
          try {
            progress = JSON.parse(savedProgress)
            console.log('📋 从localStorage恢复进度:', progress)
          } catch (error) {
            console.error('恢复进度失败:', error)
            localStorage.removeItem('crawlerProgress')
          }
        }
      }
    }

    // 只有第一次调用（没有进度）时才重置结果和更新时间
    if (progress.lastProcessedId === 0) {
      setUpdateResult(null)
      onLastUpdateTimeChange?.(null)
    }

    // 更新组件状态
    setCrawlerProgress(progress)

    const MAX_ROUNDS = 100 // 最多自动执行 100 轮，避免无限循环

    try {
      // 显示开始处理的提示
      if (progress.lastProcessedId === 0) {
        setUpdateResult({
          success: true,
          message: '正在启动爬虫...',
        })
      } else {
        setUpdateResult({
          success: true,
          message: `从ID ${progress.lastProcessedId} 继续处理（已处理 ${progress.totalProcessed} 个）...`,
        })
      }

      // 递归处理多轮，直到全部完成或达到最大轮数
      while (progress.roundCount < MAX_ROUNDS) {
        // 检查是否被强制停止
        if (forceStop) {
          console.log('🛑 检测到强制停止信号，中断处理')
          setUpdateResult({
            success: true,
            message: `🛑 已强制停止。已处理 ${progress.totalProcessed} 个，成功 ${progress.totalSuccess} 个，失败 ${progress.totalFailed} 个，执行了 ${progress.roundCount} 轮`,
          })
          // 保存进度以便下次继续
          localStorage.setItem('crawlerProgress', JSON.stringify(progress))
          setCrawlerProgress({ ...progress })
          setForceStop(false)
          return
        }

        progress.roundCount++
        console.log(`🔄 开始第 ${progress.roundCount} 轮处理，从ID ${progress.lastProcessedId} 开始（待处理单号最大ID: ${progress.maxId}）...`)

        // 更新UI显示当前轮次
        setUpdateResult({
          success: true,
          message: `正在处理第 ${progress.roundCount} 轮（从ID ${progress.lastProcessedId} 开始，已累计处理 ${progress.totalProcessed} 个）...`,
        })

        // 保存当前进度到localStorage
        localStorage.setItem('crawlerProgress', JSON.stringify(progress))
        setCrawlerProgress({ ...progress })

        // 使用 setTimeout 确保不阻塞UI线程
        await new Promise((resolve) => setTimeout(resolve, 0))

        // 调用爬虫处理一批追踪号
        // 构建筛选条件
        const filters = {
          statusFilter: statusFilter || undefined,
          dateFrom: dateFrom && dateFrom.trim() ? dateFrom : undefined,
          dateTo: dateTo && dateTo.trim() ? dateTo : undefined,
          searchNums: searchQuery ? parseSearchNumbers(searchQuery) : undefined,
          hasTransferFilter: hasTransferFilter || undefined,
          updatedAtToday: updatedAtTodayFilter || undefined,
        }

        const result = await updateLogisticsStatus(progress.lastProcessedId, filters)

        if (!result.success) {
          // 如果出错，停止递归
          const completionTime = new Date()
          setLastUpdateTime(completionTime)
          onLastUpdateTimeChange?.(completionTime)
          setUpdateResult({
            success: false,
            error: result.error || '更新失败',
          })
          // 清除进度
          localStorage.removeItem('crawlerProgress')
          setCrawlerProgress(null)
          break
        }

        // 累计统计信息
        if (result.success && 'stats' in result && result.stats) {
          progress.totalProcessed += result.stats.total || 0
          progress.totalSuccess += result.stats.success || 0
          progress.totalFailed += result.stats.failed || 0
          progress.totalSkipped += result.stats.skipped || 0

          // 更新起始ID和最大ID为下一轮的开始点
          progress.lastProcessedId = result.stats.lastProcessedId || progress.lastProcessedId
          progress.maxId = result.stats.maxId || progress.maxId
          const hasMore = result.stats.hasMore || false

          console.log(`📊 第 ${progress.roundCount} 轮统计：处理了 ${result.stats.total} 个（单轮数量，应≤20），最后ID ${progress.lastProcessedId}，待处理单号最大ID ${progress.maxId}，还有更多 ${hasMore}`)

          // 递归控制逻辑：优先使用本地验证，确保准确性
          // 主要条件：lastProcessedId >= maxId（已处理完所有单号）
          // 辅助条件：hasMore 作为额外参考

          if (progress.lastProcessedId >= progress.maxId) {
            // ✅ 已处理到最大ID，所有待处理单号都已处理完成
            console.log(`✅ 已处理到最大ID ${progress.maxId}，所有待处理单号都已处理完成。`)
            const completionTime = new Date()
            setLastUpdateTime(completionTime)
            onLastUpdateTimeChange?.(completionTime)
            setUpdateResult({
              success: true,
              message: `✅ 全部处理完成！总计处理 ${progress.totalProcessed} 个，成功 ${progress.totalSuccess} 个，失败 ${progress.totalFailed} 个，跳过 ${progress.totalSkipped} 个，执行了 ${progress.roundCount} 轮`,
            })
            // 清除进度
            localStorage.removeItem('crawlerProgress')
            setCrawlerProgress(null)
            break
          } else if (hasMore) {
            // 🔄 还有更多待处理的追踪号，继续下一轮
            console.log(`ℹ️ 还有待处理的追踪号，1 秒后自动继续第 ${progress.roundCount + 1} 轮...`)
            await new Promise((resolve) => setTimeout(resolve, 1000))
            continue
          } else {
            // ⚠️ 数据状态不一致：lastProcessedId < maxId 但 hasMore = false
            console.log(`⚠️ 数据状态不一致：hasMore=${hasMore}, lastProcessedId=${progress.lastProcessedId}, maxId=${progress.maxId}`)
            const completionTime = new Date()
            setLastUpdateTime(completionTime)
            onLastUpdateTimeChange?.(completionTime)
            setUpdateResult({
              success: true,
              message: `⚠️ 处理完成（检测到数据状态不一致，已安全停止）。总计处理 ${progress.totalProcessed} 个，成功 ${progress.totalSuccess} 个，失败 ${progress.totalFailed} 个，跳过 ${progress.totalSkipped} 个，执行了 ${progress.roundCount} 轮`,
            })
            // 清除进度
            localStorage.removeItem('crawlerProgress')
            setCrawlerProgress(null)
            break
          }
        } else {
          // 没有stats信息，出错处理
          const completionTime = new Date()
          setLastUpdateTime(completionTime)
          onLastUpdateTimeChange?.(completionTime)
          setUpdateResult({
            success: false,
            error: '服务器返回数据格式错误',
          })
          // 清除进度
          localStorage.removeItem('crawlerProgress')
          setCrawlerProgress(null)
          break
        }
      }

      // 如果达到最大轮数，强制停止
      if (progress.roundCount >= MAX_ROUNDS) {
        console.log(`⚠️ 已达到最大处理轮数（${MAX_ROUNDS} 轮），强制停止`)
        const completionTime = new Date()
        setLastUpdateTime(completionTime)
        onLastUpdateTimeChange?.(completionTime)
        setUpdateResult({
          success: true,
          message: `⚠️ 已达到最大处理轮数（${MAX_ROUNDS} 轮）。已处理 ${progress.totalProcessed} 个，成功 ${progress.totalSuccess} 个，失败 ${progress.totalFailed} 个。如果还有待处理的追踪号，请稍后再次点击"更新"按钮`,
        })
        // 保存进度以便下次继续
        localStorage.setItem('crawlerProgress', JSON.stringify(progress))
        setCrawlerProgress({ ...progress })
      }

      // 更新成功后，刷新数据
      setTimeout(async () => {
        await loadLogisticsData(searchQuery || undefined, statusFilter, currentPage)
        await loadStatistics()
      }, 0)
    } catch (error: any) {
      console.error('更新失败:', error)
      setUpdateResult({
        success: false,
        error: error.message || '更新失败，请重试',
      })
      // 即使失败，也要重置父组件的更新状态，让按钮恢复可用
      const completionTime = new Date()
      setLastUpdateTime(completionTime)
      onLastUpdateTimeChange?.(completionTime)
    } finally {
      setUpdating(false)
    }
  }

  // 清除爬虫进度
  const clearCrawlerProgress = () => {
    localStorage.removeItem('crawlerProgress')
    setCrawlerProgress(null)
    console.log('🗑️ 已清除爬虫进度')
  }

  // 调试：查看当前进度状态
  const debugCrawlerProgress = () => {
    const savedProgress = localStorage.getItem('crawlerProgress')
    console.log('🔍 localStorage中的进度:', savedProgress)
    console.log('🔍 组件状态中的进度:', crawlerProgress)

    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress)
        console.log('🔍 解析后的进度:', {
          lastProcessedId: progress.lastProcessedId,
          maxId: progress.maxId,
          shouldContinue: progress.lastProcessedId < progress.maxId,
          roundCount: progress.roundCount
        })
      } catch (error) {
        console.error('解析进度失败:', error)
      }
    }
  }

  // 暴露 handleUpdate 和 clearCrawlerProgress 函数给父组件
  // 必须在函数定义之后
  useImperativeHandle(ref, () => ({
    handleUpdate,
    clearCrawlerProgress,
  }))

  // 导出数据功能（导出所有筛选后的数据，不是当前页）
  const handleExport = async () => {
    try {
      // 显示加载提示（使用console而不是alert，避免阻塞）
      console.log("正在准备导出数据，请稍候...")
      
      // 确定要导出的搜索单号：如果有实际搜索到的单号列表，使用它；否则使用searchQuery
      let exportSearchQuery: string | undefined = undefined
      if (actualSearchNumbers.length > 0) {
        // 如果有实际搜索到的单号，使用它们（逗号分隔）
        exportSearchQuery = actualSearchNumbers.join(',')
      } else if (searchQuery && searchQuery.trim()) {
        // 如果没有实际搜索到的单号列表，但有搜索输入，解析并查询
        const searchNumbers = parseSearchNumbers(searchQuery)
        if (searchNumbers.length > 0) {
          // 先批量查询哪些单号存在
          const batchResult = await batchSearchLogistics(searchNumbers)
          if (batchResult.success && batchResult.found.length > 0) {
            exportSearchQuery = batchResult.found.join(',')
          } else {
            // 如果没有找到任何单号，提示用户
            alert("没有找到可导出的数据")
            return
          }
        } else {
          exportSearchQuery = searchQuery.trim()
        }
      }
      
      // 获取所有筛选后的数据（不分页，使用很大的pageSize）
      const result = await fetchLogisticsData(
        exportSearchQuery,
        statusFilter || undefined,
        activeDateFrom && activeDateFrom.trim() ? activeDateFrom : undefined,
        activeDateTo && activeDateTo.trim() ? activeDateTo : undefined,
        1, // 从第1页开始
        100000, // 使用很大的pageSize来获取所有数据
        false, // 不限制创建时间
        hasTransferFilter, // 转单筛选
        updatedAtTodayFilter // 今日更新筛选
      )

      if (!result.success) {
        alert(`导出失败：${result.error || "未知错误"}`)
        return
      }

      if (result.data.length === 0) {
        alert("没有数据可导出")
        return
      }

      // 准备导出数据（订单号放在第一列）
      const exportData = result.data.map((record) => ({
        订单号: record.order_num || '',
        发货单号: record.search_num,
        状态: getStatusLabel(record.states),
        发货日期: record.Ship_date 
          ? new Date(record.Ship_date).toLocaleDateString('zh-CN')
          : '',
        发货渠道: record.channel || '',
        转单号: record.transfer_num || '',
        转单日期: record.transfer_date 
          ? new Date(record.transfer_date).toLocaleDateString('zh-CN')
          : '',
        备注: record.notes || '',
      }))

      // 使用 xlsx 库导出
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)

      // 设置列宽（订单号在第一列）
      const colWidths = [
        { wch: 20 }, // 订单号
        { wch: 20 }, // 发货单号
        { wch: 15 }, // 状态
        { wch: 15 }, // 发货日期
        { wch: 15 }, // 发货渠道
        { wch: 20 }, // 转单号
        { wch: 15 }, // 转单日期
        { wch: 30 }, // 备注
      ]
      ws['!cols'] = colWidths

      // 添加工作表到工作簿
      XLSX.utils.book_append_sheet(wb, ws, "发货数据")

      // 生成文件名：筛选日期（仅包括月日）+海外物流+筛选分类（若有）+当前年月日
      // 例如：1.2-1.5海外物流三天未上网20260109.xlsx
      
      // 获取筛选分类的中文名称
      const getFilterLabel = (filter: typeof statusFilter): string => {
        const filterMap: Record<string, string> = {
          'in_transit': '运输中',
          'returned': '投递失败退回',
          'not_online': '未上网',
          'online_abnormal': '三天未上网',
          'not_queried': '未查询',
          'delivered': '成功签收',
          'total': '总发货',
          'has_transfer': '转单',
        }
        return filter ? filterMap[filter] || '' : ''
      }

      // 格式化日期为月日格式（例如：1.2）
      const formatMonthDay = (dateStr: string): string => {
        if (!dateStr) return ''
        try {
          const date = new Date(dateStr)
          const month = date.getMonth() + 1
          const day = date.getDate()
          return `${month}.${day}`
        } catch {
          return ''
        }
      }

      // 构建文件名各部分
      const parts: string[] = []

      // 1. 筛选日期（仅包括月日）
      if (dateFrom && dateTo) {
        const fromStr = formatMonthDay(dateFrom)
        const toStr = formatMonthDay(dateTo)
        if (fromStr && toStr) {
          parts.push(`${fromStr}-${toStr}`)
        }
      } else if (dateFrom) {
        const fromStr = formatMonthDay(dateFrom)
        if (fromStr) {
          parts.push(fromStr)
        }
      }

      // 2. 海外物流（固定文本）
      parts.push('海外物流')

      // 3. 筛选分类（若有）
      const filterLabel = getFilterLabel(statusFilter)
      if (filterLabel) {
        parts.push(filterLabel)
      }

      // 4. 当前年月日（例如：20260109）
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      parts.push(`${year}${month}${day}`)

      // 组合文件名
      const fileName = `${parts.join('')}.xlsx`

      // 导出文件
      XLSX.writeFile(wb, fileName)
      
      console.log(`✅ 成功导出 ${exportData.length} 条记录`)
    } catch (error: any) {
      console.error("导出数据失败:", error)
      alert(`导出数据失败: ${error.message || "未知错误"}`)
    }
  }


  return (
    <div className="space-y-6">
      {/* Search and Export Section */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* 发货单号查询 */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="输入发货单号查询（支持多个，用空格、逗号、换行分隔）..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10"
            />
          </div>
          
          {/* 日期范围 */}
          <div className="w-[280px]">
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateChange={(from, to) => {
                setDateFrom(from || "")
                setDateTo(to || "")
              }}
              placeholder="选择发货日期"
            />
          </div>
          
          {/* 搜索按钮 */}
          <Button onClick={handleSearch} className="gap-2" disabled={isPending}>
            <Search className="h-4 w-4" />
            {isPending ? "搜索中..." : "搜索"}
          </Button>
          
          {/* 导出数据 */}
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            导出数据
          </Button>
          
          {/* 导入数据 */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={importing}
            />
            <Button variant="outline" className="gap-2" disabled={importing}>
              <Upload className="h-4 w-4" />
              {importing ? '导入中...' : '导入数据'}
            </Button>
          </div>
          
          {/* 重置筛选 */}
          <Button onClick={handleResetFilters} variant="outline" className="gap-2">
            重置筛选
          </Button>
        </div>
      </Card>

      {/* Statistics Cards */}
      <div className="flex gap-4">
        <Card 
          className={`p-6 cursor-pointer transition-all hover:shadow-md flex-1 ${
            statusFilter === 'total' ? 'ring-2 ring-purple-500 bg-purple-50' : ''
          }`}
          onClick={() => handleCardClick('total')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">总发货</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.total}</p>
            </div>
          </div>
        </Card>

        <Card 
          className={`p-6 cursor-pointer transition-all hover:shadow-md flex-1 ${
            statusFilter === 'delivered' ? 'ring-2 ring-green-500 bg-green-50' : ''
          }`}
          onClick={() => handleCardClick('delivered')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">成功签收</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.delivered}</p>
            </div>
          </div>
        </Card>

        <Card 
          className={`p-6 cursor-pointer transition-all hover:shadow-md flex-1 ${
            statusFilter === 'in_transit' ? 'ring-2 ring-chart-1 bg-chart-1/5' : ''
          }`}
          onClick={() => handleCardClick('in_transit')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-1/10 rounded-lg">
              <Package className="h-6 w-6 text-chart-1" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">运输中</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.in_transit}</p>
            </div>
          </div>
        </Card>

        <Card 
          className={`p-6 cursor-pointer transition-all hover:shadow-md flex-1 ${
            statusFilter === 'returned' ? 'ring-2 ring-chart-2 bg-chart-2/5' : ''
          }`}
          onClick={() => handleCardClick('returned')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-2/10 rounded-lg">
              <MapPin className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">投递失败</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.returned}</p>
            </div>
          </div>
        </Card>

        <Card 
          className={`p-6 cursor-pointer transition-all hover:shadow-md flex-1 ${
            statusFilter === 'not_online' ? 'ring-2 ring-chart-3 bg-chart-3/5' : ''
          }`}
          onClick={() => handleCardClick('not_online')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-3/10 rounded-lg">
              <Calendar className="h-6 w-6 text-chart-3" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">未上网总数</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.not_online}</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md flex-1 ${
            statusFilter === 'online_abnormal' ? 'ring-2 ring-chart-4 bg-chart-4/5' : ''
          }`}
          onClick={() => handleCardClick('online_abnormal')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-4/10 rounded-lg">
              <AlertCircle className="h-6 w-6 text-chart-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">三天未上网</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.online_abnormal}</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md flex-1 ${
            statusFilter === 'not_queried' ? 'ring-2 ring-blue-500 bg-blue-50' : ''
          }`}
          onClick={() => handleCardClick('not_queried')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Search className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">未查询</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.not_queried}</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md flex-1 ${
            updatedAtTodayFilter ? 'ring-2 ring-purple-500 bg-purple-50' : ''
          }`}
          onClick={handleUpdatedTodayCardClick}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">今日更新</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.updated_today}</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md flex-1 ${
            hasTransferFilter ? 'ring-2 ring-orange-500 bg-orange-50' : ''
          }`}
          onClick={handleTransferCardClick}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <RefreshCw className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">转单</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.has_transfer}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* 导入结果提示 */}
      {importResult && (
        <Card className={`p-4 ${importResult.success ? 'bg-green-50 border-green-200' : 'bg-destructive/10 border-destructive/20'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {importResult.success ? (
                <span className="text-sm font-medium text-green-700">{importResult.message}</span>
              ) : (
                <span className="text-sm font-medium text-destructive">导入失败：{importResult.error}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setImportResult(null)}
            >
              关闭
            </Button>
          </div>
        </Card>
      )}

      {/* 更新结果提示 */}
      {updateResult && (
        <Card className={`p-4 ${updateResult.success ? 'bg-green-50 border-green-200' : 'bg-destructive/10 border-destructive/20'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {updateResult.success ? (
                <span className="text-sm font-medium text-green-700">{updateResult.message}</span>
              ) : (
                <span className="text-sm font-medium text-destructive">更新失败：{updateResult.error}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUpdateResult(null)}
            >
              关闭
            </Button>
          </div>
        </Card>
      )}

      {/* 爬虫进度显示 */}
      {crawlerProgress && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-blue-700">爬虫处理进度</h3>
              <div className="text-xs text-blue-600 space-y-1">
                <p>已执行轮数: {crawlerProgress.roundCount}</p>
                <p>最后处理ID: {crawlerProgress.lastProcessedId}</p>
                <p>待处理最大ID: {crawlerProgress.maxId}</p>
                <p>累计处理: {crawlerProgress.totalProcessed} 个</p>
                <p>成功: {crawlerProgress.totalSuccess} | 失败: {crawlerProgress.totalFailed} | 跳过: {crawlerProgress.totalSkipped}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={debugCrawlerProgress}
              className="text-green-700 border-green-300 hover:bg-green-100 mr-2"
            >
              调试进度
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForceStop(true)}
              className="text-red-700 border-red-300 hover:bg-red-100 mr-2"
              disabled={!updating}
            >
              强制停止
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearCrawlerProgress}
              className="text-blue-700 border-blue-300 hover:bg-blue-100"
            >
              清除进度
            </Button>
          </div>
        </Card>
      )}

      {/* 搜索结果弹窗 */}
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>搜索结果</DialogTitle>
            <DialogDescription>
              {searchResult && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm">
                    输入 <span className="font-semibold">{searchResult.total}</span> 个发货单号，
                    搜索到 <span className="font-semibold text-green-600">{searchResult.found}</span> 个发货单号，
                    <span className="font-semibold text-red-600">{searchResult.notFound.length}</span> 个发货单号未搜索到
                  </p>
                  {searchResult.notFound.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">未搜索到的发货单号：</p>
                      <div className="max-h-40 overflow-y-auto bg-muted p-2 rounded">
                        <p className="text-xs font-mono break-all">{searchResult.notFound.join(', ')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

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
                loadLogisticsData(searchQuery || undefined, statusFilter, currentPage)
                loadStatistics()
              }}
            >
              重试
            </Button>
          </div>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>请按以下步骤检查：</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>检查 PostgreSQL 服务是否已启动（本地）或 Neon 连接是否正常（云端）</li>
              <li>检查数据库 <code className="px-1 py-0.5 bg-muted rounded">seas_ware</code> 是否存在</li>
              <li>检查表 <code className="px-1 py-0.5 bg-muted rounded">post_searchs</code> 是否存在（执行 sql/postgresql/create_post_searchs_table.sql）</li>
              <li>检查 <code className="px-1 py-0.5 bg-muted rounded">.env</code> 文件中的数据库配置（DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL）</li>
              <li>确认已重启开发服务器（环境变量修改后需要重启）</li>
            </ol>
            <p className="mt-2 pt-2 border-t border-border">
              📖 详细配置说明请查看：<code className="px-1 py-0.5 bg-muted rounded">md/快速配置指南.md</code>
            </p>
          </div>
        </Card>
      )}

      {/* Logistics Table */}
      <Card className="flex flex-col">
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 500px)', minHeight: '400px' }}>
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border sticky top-0">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">订单号</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">发货单号</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">转单号</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">发货日期</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">发货渠道</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading || isPending ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    加载中...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-destructive">
                    数据加载失败，请查看上方错误提示
                  </td>
                </tr>
              ) : logisticsData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    暂无数据
                  </td>
                </tr>
              ) : (
                paginatedData.map((record, index) => {
                  const displayState = getDisplayState(record)
                  const isEditing = editingField?.id === record.id
                  
                  return (
                    <tr key={`${record.search_num}-${index}`} className="hover:bg-muted/30 transition-colors">
                      {/* 订单号 */}
                      <td className="px-6 py-4">
                        {isEditing && editingField?.field === 'order_num' ? (
                          <Input
                            value={editingField.value}
                            onChange={(e) => setEditingField({...editingField, value: e.target.value})}
                            onBlur={() => handleFieldUpdate(record.id, 'order_num', editingField.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleFieldUpdate(record.id, 'order_num', editingField.value)
                              }
                            }}
                            className="w-full"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="text-sm text-muted-foreground cursor-pointer hover:text-foreground"
                            onClick={() => setEditingField({id: record.id, field: 'order_num', value: record.order_num || ''})}
                          >
                            {record.order_num || '-'}
                          </span>
                        )}
                      </td>
                      
                      {/* 发货单号 */}
                      <td className="px-6 py-4 text-sm font-mono text-foreground">{record.search_num}</td>
                      
                      {/* 转单号 */}
                      <td className="px-6 py-4">
                        {isEditing && editingField?.field === 'transfer_num' ? (
                          <Input
                            value={editingField.value}
                            onChange={(e) => {
                              const value = e.target.value
                              // 只允许数字
                              if (value === '' || /^\d+$/.test(value)) {
                                setEditingField({...editingField, value})
                              }
                            }}
                            onBlur={() => handleFieldUpdate(record.id, 'transfer_num', editingField.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleFieldUpdate(record.id, 'transfer_num', editingField.value)
                              }
                            }}
                            className="w-full"
                            autoFocus
                            placeholder="只能输入数字"
                          />
                        ) : (
                          <span 
                            className="text-sm text-muted-foreground cursor-pointer hover:text-foreground"
                            onClick={() => setEditingField({id: record.id, field: 'transfer_num', value: record.transfer_num || ''})}
                          >
                            {record.transfer_num || '-'}
                          </span>
                        )}
                      </td>
                      
                      {/* 状态 */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            displayState === "Final delivery"
                              ? "bg-background border border-border text-foreground"
                              : displayState === "Returned to Sender" || 
                                displayState === "退回" || 
                                displayState === "异常" || 
                                displayState === "退回/异常" ||
                                displayState === "Office closed. Retention." ||
                                displayState === "Absence. Attempted delivery."
                                ? "bg-chart-4/10 text-chart-4"
                                : displayState === "Not registered" || 
                                  displayState === "未上网"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-chart-2/10 text-chart-2"
                          }`}
                        >
                          {getStatusLabel(displayState)}
                        </span>
                      </td>
                      
                      {/* 发货日期 */}
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {record.Ship_date ? new Date(record.Ship_date).toLocaleDateString('zh-CN') : '-'}
                      </td>
                      
                      {/* 发货渠道 */}
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {record.channel || '-'}
                      </td>
                      
                      {/* 备注 */}
                      <td className="px-6 py-4">
                        {isEditing && editingField?.field === 'notes' ? (
                          <Input
                            value={editingField.value}
                            onChange={(e) => setEditingField({...editingField, value: e.target.value})}
                            onBlur={() => handleFieldUpdate(record.id, 'notes', editingField.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleFieldUpdate(record.id, 'notes', editingField.value)
                              }
                            }}
                            className="w-full"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="text-sm text-muted-foreground cursor-pointer hover:text-foreground"
                            onClick={() => setEditingField({id: record.id, field: 'notes', value: record.notes || ''})}
                          >
                            {record.notes || '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* 数据统计和分页 */}
        {!loading && !error && logisticsData.length > 0 && (
          <div className="p-4 border-t border-border">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground whitespace-nowrap">
                显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalRecords)} 条，共 {totalRecords} 条记录
              </div>
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (currentPage > 1) handlePageChange(currentPage - 1)
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
                                handlePageChange(page)
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
                          if (currentPage < totalPages) handlePageChange(currentPage + 1)
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
        {!loading && !error && logisticsData.length === 0 && (
          <div className="p-4 border-t border-border text-center text-sm text-muted-foreground">
            暂无数据
          </div>
        )}
      </Card>
    </div>
  )
})

OverseasLogistics.displayName = 'OverseasLogistics'

export default OverseasLogistics
