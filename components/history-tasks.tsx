"use client"

import { useState, useEffect, useTransition } from "react"
import { Search, Calendar, CheckCircle, Package, DollarSign, AlertCircle, XCircle } from "lucide-react"
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
import { fetchTaskHistoryData, fetchTaskHistoryStatistics, fetchTaskHistoryChargeList } from "@/app/actions/inventory"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import type { TaskHistoryRecord } from "@/lib/inventory-data"

// 方案映射
function getPromisedLandText(promisedLand: number, failureCount?: number): string {
  switch (promisedLand) {
    case 1:
      return '退回厂家'
    case 2:
      // 根据失败次数显示不同的降价清仓选项
      if (failureCount === 0) {
        return '降价清仓（20%）'
      } else if (failureCount === 1) {
        return '降价清仓（10%）'
      } else if (failureCount === 2) {
        return '降价清仓（0%）'
      } else {
        return '降价清仓'
      }
    case 3:
      return '打处理'
    default:
      return '未选择方案'
  }
}

interface HistoryTasksProps {
  chargeFilter?: string
}

export default function HistoryTasks({ chargeFilter: propChargeFilter }: HistoryTasksProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [historyData, setHistoryData] = useState<TaskHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [statistics, setStatistics] = useState({
    total: 0,
    total_failed: 0,
    promised_land_1: 0,
    promised_land_2: 0,
    promised_land_3: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [chargeFilter, setChargeFilter] = useState<string | null>(propChargeFilter || null)
  const [promisedLandFilter, setPromisedLandFilter] = useState<number | null>(null)
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'approved' | 'failed' | null>(null)
  const [chargeList, setChargeList] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  // 加载历史任务数据
  const loadHistoryData = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchTaskHistoryData(
        searchQuery || undefined,
        chargeFilter || undefined,
        promisedLandFilter !== null ? promisedLandFilter : undefined,
        dateFrom || undefined,
        dateTo || undefined,
        reviewStatusFilter || undefined
      )
      if (result.success) {
        setHistoryData(result.data)
        setCurrentPage(1) // 重置到第一页
      } else {
        setError(result.error || "加载历史任务数据失败")
        setHistoryData([])
      }
    } catch (error: any) {
      console.error("加载历史任务数据失败:", error)
      setError(error?.message || "加载历史任务数据失败，请检查数据库连接和表结构")
      setHistoryData([])
    } finally {
      setLoading(false)
    }
  }

  // 加载统计数据
  const loadStatistics = async () => {
    try {
      const result = await fetchTaskHistoryStatistics()
      if (result.success) {
        setStatistics(result.data)
      }
    } catch (error: any) {
      console.error("加载统计数据失败:", error)
    }
  }

  // 加载负责人列表
  const loadChargeList = async () => {
    try {
      const result = await fetchTaskHistoryChargeList()
      if (result.success) {
        setChargeList(result.data)
      }
    } catch (error: any) {
      console.error("加载负责人列表失败:", error)
    }
  }

  // 同步外部传入的 chargeFilter
  useEffect(() => {
    setChargeFilter(propChargeFilter || null)
  }, [propChargeFilter])

  // 初始加载
  useEffect(() => {
    // 并行加载数据、统计和负责人列表
    Promise.all([
      loadHistoryData(),
      loadStatistics(),
      loadChargeList()
    ]).catch(console.error)
  }, [chargeFilter, promisedLandFilter, dateFrom, dateTo, reviewStatusFilter])

  // 搜索功能
  const handleSearch = () => {
    startTransition(() => {
      loadHistoryData()
    })
  }

  // 处理回车搜索
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  // 计算分页数据
  const totalPages = Math.ceil(historyData.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedData = historyData.slice(startIndex, endIndex)

  return (
    <div className="space-y-6">
      {/* 搜索和筛选区域 */}
      <Card className="p-6">
        <div className="flex items-center gap-4 flex-wrap">
          {/* SKU搜索 */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="输入SKU货号搜索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
          </div>

          {/* 日期搜索 */}
          <div className="flex-1 min-w-[280px]">
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateChange={(from, to) => {
                setDateFrom(from || "")
                setDateTo(to || "")
              }}
              placeholder="选择日期范围"
            />
          </div>

          {/* 方案筛选和搜索按钮 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-[180px]">
              <Select
                value={promisedLandFilter !== null ? promisedLandFilter.toString() : "all"}
                onValueChange={(value) => setPromisedLandFilter(value === "all" ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部方案" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部方案</SelectItem>
                  <SelectItem value="0">未选择方案</SelectItem>
                  <SelectItem value="1">退回厂家</SelectItem>
                  <SelectItem value="2">降价清仓</SelectItem>
                  <SelectItem value="3">打处理</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} className="gap-2" disabled={isPending}>
              <Search className="h-4 w-4" />
              {isPending ? "搜索中..." : "搜索"}
            </Button>
          </div>
        </div>
      </Card>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            reviewStatusFilter === 'approved' ? 'ring-2 ring-chart-1 bg-chart-1/5' : ''
          }`}
          onClick={() => {
            setReviewStatusFilter(reviewStatusFilter === 'approved' ? null : 'approved')
            setCurrentPage(1)
          }}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-1/10 rounded-lg">
              <CheckCircle className="h-6 w-6 text-chart-1" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">总完成数</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.total}</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            reviewStatusFilter === 'failed' ? 'ring-2 ring-chart-2 bg-chart-2/5' : ''
          }`}
          onClick={() => {
            setReviewStatusFilter(reviewStatusFilter === 'failed' ? null : 'failed')
            setCurrentPage(1)
          }}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-2/10 rounded-lg">
              <XCircle className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">总失败数</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.total_failed}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-3/10 rounded-lg">
              <Package className="h-6 w-6 text-chart-3" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">退回厂家</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.promised_land_1}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-4/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-chart-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">降价清仓</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.promised_land_2}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">打处理</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.promised_land_3}</p>
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
                loadHistoryData()
                loadStatistics()
              }}
            >
              重试
            </Button>
          </div>
        </Card>
      )}

      {/* 历史任务表格 */}
      <Card className="flex flex-col">
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 500px)', minHeight: '400px' }}>
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border sticky top-0">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">SKU货号</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">负责人</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">完成/失败时可售天数</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">方案</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">完成/失败时间</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">完成/失败时库存</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">完成/失败时销量</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">完成/失败</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading || isPending ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    加载中...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-destructive">
                    数据加载失败，请查看上方错误提示
                  </td>
                </tr>
              ) : historyData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    暂无历史任务数据
                  </td>
                </tr>
              ) : (
                paginatedData.map((record) => {
                  // 根据 review_status 判断成功/失败
                  const getStatusText = () => {
                    if (record.review_status === 'approved') {
                      return '成功'
                    } else if (record.review_status === 'timeout') {
                      return '失败'
                    } else if (record.review_status === 'rejected') {
                      return '失败'
                    }
                    return '-'
                  }
                  
                  const getStatusColor = () => {
                    if (record.review_status === 'approved') {
                      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    } else if (record.review_status === 'rejected' || record.review_status === 'timeout') {
                      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }
                    return 'bg-muted text-muted-foreground'
                  }
                  
                  return (
                    <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-foreground">{record.ware_sku}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{record.charge || '-'}</td>
                      <td className="px-6 py-4 text-sm text-foreground font-medium">
                        {record.completed_sale_day !== null ? record.completed_sale_day : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-muted text-foreground">
                          {getPromisedLandText(record.promised_land, record.price_reduction_failure_count)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {record.completed_at
                          ? new Date(record.completed_at).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{record.inventory_num}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{record.sales_num}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor()}`}>
                          {getStatusText()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-muted-foreground">
                          {record.notes || '-'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 数据统计和分页 */}
        {!loading && !error && historyData.length > 0 && (
          <div className="p-4 border-t border-border">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                显示第 {startIndex + 1} - {Math.min(endIndex, historyData.length)} 条，共 {historyData.length} 条记录
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
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(i)
                        }
                      } else {
                        pages.push(1)
                        
                        if (currentPage <= 3) {
                          for (let i = 2; i <= 4; i++) {
                            pages.push(i)
                          }
                          pages.push('ellipsis')
                          pages.push(totalPages)
                        } else if (currentPage >= totalPages - 2) {
                          pages.push('ellipsis')
                          for (let i = totalPages - 3; i <= totalPages; i++) {
                            pages.push(i)
                          }
                        } else {
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
        {!loading && !error && historyData.length === 0 && (
          <div className="p-4 border-t border-border text-center text-sm text-muted-foreground">
            暂无历史任务数据
          </div>
        )}
      </Card>
    </div>
  )
}
