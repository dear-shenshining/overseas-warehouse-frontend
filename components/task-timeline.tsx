"use client"

import { useState, useEffect, useTransition } from "react"
import { Search, Calendar, TrendingDown, Clock, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import { fetchTaskData, fetchTaskStatistics, updateTaskPromisedLand } from "@/app/actions/inventory"
import type { InventoryRecord } from "@/lib/inventory-data"
import { getLabelName } from "@/lib/label-mapping"

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
  const [statistics, setStatistics] = useState({
    over_15_days: 0,
    has_inventory_no_sales: 0,
    no_solution: 0,
    in_progress: 0,
    timeout: 0,
  })
  const [labelFilter, setLabelFilter] = useState<'over_15_days' | 'has_inventory_no_sales' | null>(null)
  const [statusFilter, setStatusFilter] = useState<'no_solution' | 'in_progress' | 'timeout' | null>(null)
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
        alert('更新方案失败：' + (result.error || '未知错误'))
      }
    } catch (error: any) {
      console.error('更新方案失败:', error)
      alert('更新方案失败：' + (error?.message || '未知错误'))
    } finally {
      setUpdatingSku(null)
    }
  }

  // 加载任务数据
  const loadTaskData = async (
    searchSku?: string,
    labelFilterType?: 'over_15_days' | 'has_inventory_no_sales' | null,
    statusFilterType?: 'no_solution' | 'in_progress' | 'timeout' | null
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
        setTaskData(result.data)
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
        setStatistics(result.data)
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

  // 处理状态卡片点击（后三个）
  const handleStatusCardClick = (filterType: 'no_solution' | 'in_progress' | 'timeout' | null) => {
    // 如果点击的是当前已选中的卡片，则取消筛选
    if (statusFilter === filterType) {
      setStatusFilter(null)
    } else {
      setStatusFilter(filterType)
    }
    setCurrentPage(1) // 重置到第一页
  }

  // 初始加载和筛选变化时重新加载
  useEffect(() => {
    loadTaskData(searchQuery || undefined, labelFilter, statusFilter)
    loadStatistics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelFilter, statusFilter, chargeFilter])

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
      {/* 搜索栏 */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
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
        <Button onClick={handleSearch} disabled={isPending}>
          {isPending ? "搜索中..." : "搜索"}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <p className="text-sm text-muted-foreground">在售天数超15天</p>
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
            statusFilter === 'timeout' ? 'ring-2 ring-chart-3 bg-chart-3/5' : ''
          }`}
          onClick={() => handleStatusCardClick(statusFilter === 'timeout' ? null : 'timeout')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-3/10 rounded-lg">
              <CheckCircle className="h-6 w-6 text-chart-3" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">超时任务</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.timeout}</p>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading || isPending ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    加载中...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-destructive">
                    数据加载失败，请查看上方错误提示
                  </td>
                </tr>
              ) : taskData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-muted-foreground">
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
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatCountDown(record.count_down)}
                      </td>
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
    </div>
  )
}
