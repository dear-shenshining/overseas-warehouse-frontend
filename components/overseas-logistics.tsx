"use client"

import { useState, useEffect, useTransition } from "react"
import { Search, Download, Upload, Package, Calendar, MapPin, AlertCircle } from "lucide-react"
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
import { fetchLogisticsData, fetchLogisticsStatistics } from "@/app/actions/logistics"
import type { LogisticsRecord } from "@/lib/logistics-data"
import { getStatusLabel } from "@/lib/status-mapping"
import * as XLSX from "xlsx"

export default function OverseasLogistics() {
  const [searchQuery, setSearchQuery] = useState("")
  const [logisticsData, setLogisticsData] = useState<LogisticsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [statistics, setStatistics] = useState({
    in_transit: 0,
    returned: 0,
    not_online: 0,
    online_abnormal: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  // 加载物流数据
  const loadLogisticsData = async (searchNum?: string, filter?: 'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | null) => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchLogisticsData(searchNum, filter || undefined)
      if (result.success) {
        setLogisticsData(result.data)
        setCurrentPage(1) // 重置到第一页
      } else {
        setError(result.error || "加载物流数据失败")
        setLogisticsData([])
      }
    } catch (error: any) {
      console.error("加载物流数据失败:", error)
      setError(error?.message || "加载物流数据失败，请检查数据库连接和表结构")
      setLogisticsData([])
    } finally {
      setLoading(false)
    }
  }

  // 加载统计数据
  const loadStatistics = async () => {
    try {
      const result = await fetchLogisticsStatistics()
      if (result.success) {
        setStatistics(result.data)
      }
    } catch (error: any) {
      console.error("加载统计数据失败:", error)
      // 统计数据失败不影响主数据加载，只记录错误
    }
  }

  // 初始加载
  useEffect(() => {
    loadLogisticsData(undefined, statusFilter)
    loadStatistics()
  }, [statusFilter])

  // 搜索功能
  const handleSearch = () => {
    startTransition(() => {
      loadLogisticsData(searchQuery || undefined, statusFilter)
    })
  }

  // 处理卡片点击筛选
  const handleCardClick = (filterType: 'in_transit' | 'returned' | 'not_online' | 'online_abnormal' | null) => {
    // 如果点击的是当前已选中的卡片，则取消筛选
    if (statusFilter === filterType) {
      setStatusFilter(null)
    } else {
      setStatusFilter(filterType)
    }
    setCurrentPage(1) // 重置到第一页
  }

  // 处理回车搜索
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  // 计算分页数据
  const totalPages = Math.ceil(logisticsData.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedData = logisticsData.slice(startIndex, endIndex)

  // 导出数据功能（导出所有筛选后的数据，不是当前页）
  const handleExport = () => {
    if (logisticsData.length === 0) {
      alert("没有数据可导出")
      return
    }

    try {
      // 准备导出数据
      const exportData = logisticsData.map((record) => ({
        货运单号: record.search_num,
        状态: getStatusLabel(record.states),
        发货日期: record.Ship_date 
          ? new Date(record.Ship_date).toLocaleDateString('zh-CN')
          : '-',
        发货渠道: record.channel || '-',
      }))

      // 创建工作簿
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)

      // 设置列宽
      const colWidths = [
        { wch: 20 }, // 货运单号
        { wch: 15 }, // 状态
        { wch: 15 }, // 发货日期
        { wch: 15 }, // 发货渠道
      ]
      ws['!cols'] = colWidths

      // 添加工作表到工作簿
      XLSX.utils.book_append_sheet(wb, ws, "货运数据")

      // 生成文件名：当前日期+货运状况.xlsx
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      const fileName = `${year}-${month}-${day}货运状况.xlsx`

      // 导出文件
      XLSX.writeFile(wb, fileName)
    } catch (error: any) {
      console.error("导出数据失败:", error)
      alert(`导出数据失败: ${error.message || "未知错误"}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search and Export Section */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="输入货运单号查询..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} className="gap-2" disabled={isPending}>
              <Search className="h-4 w-4" />
              {isPending ? "搜索中..." : "搜索"}
            </Button>
          </div>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            导出数据
          </Button>
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            导入数据
          </Button>
        </div>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
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
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'returned' ? 'ring-2 ring-chart-2 bg-chart-2/5' : ''
          }`}
          onClick={() => handleCardClick('returned')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-2/10 rounded-lg">
              <MapPin className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">退回/异常</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.returned}</p>
            </div>
          </div>
        </Card>

        <Card 
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'not_online' ? 'ring-2 ring-chart-3 bg-chart-3/5' : ''
          }`}
          onClick={() => handleCardClick('not_online')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-3/10 rounded-lg">
              <Calendar className="h-6 w-6 text-chart-3" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">未上网</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.not_online}</p>
            </div>
          </div>
        </Card>

        <Card 
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'online_abnormal' ? 'ring-2 ring-chart-4 bg-chart-4/5' : ''
          }`}
          onClick={() => handleCardClick('online_abnormal')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-4/10 rounded-lg">
              <AlertCircle className="h-6 w-6 text-chart-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">上网异常</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.online_abnormal}</p>
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
                loadLogisticsData(searchQuery || undefined, statusFilter)
                loadStatistics()
              }}
            >
              重试
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            请检查：1. MySQL 服务是否启动 2. 数据库 seas_ware 是否存在 3. 表 post_searchs 是否存在 4. 数据库配置是否正确
          </p>
        </Card>
      )}

      {/* Logistics Table */}
      <Card className="flex flex-col">
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 500px)', minHeight: '400px' }}>
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border sticky top-0">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">货运单号</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">发货日期</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-foreground">发货渠道</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading || isPending ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    加载中...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-destructive">
                    数据加载失败，请查看上方错误提示
                  </td>
                </tr>
              ) : logisticsData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    暂无数据
                  </td>
                </tr>
              ) : (
                paginatedData.map((record, index) => (
                  <tr key={`${record.search_num}-${index}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-foreground">{record.search_num}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          record.states === "Final delivery"
                            ? "bg-background border border-border text-foreground" // 白色/无颜色
                            : record.states === "Returned to Sender" || 
                              record.states === "退回" || 
                              record.states === "异常" || 
                              record.states === "退回/异常" ||
                              record.states === "Office closed. Retention." ||
                              record.states === "Absence. Attempted delivery."
                              ? "bg-chart-4/10 text-chart-4" // 黄色（退回/异常，包括办公室关闭/滞留和缺席/尝试投递，Retention属于运输中）
                              : record.states === "Not registered" || 
                                record.states === "未上网"
                                ? "bg-destructive/10 text-destructive" // 红色
                                : "bg-chart-2/10 text-chart-2" // 绿色（运输中和其他状态，包括Retention）
                        }`}
                      >
                        {getStatusLabel(record.states)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {record.Ship_date ? new Date(record.Ship_date).toLocaleDateString('zh-CN') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {record.channel || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* 数据统计和分页 */}
        {!loading && !error && logisticsData.length > 0 && (
          <div className="p-4 border-t border-border">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                显示第 {startIndex + 1} - {Math.min(endIndex, logisticsData.length)} 条，共 {logisticsData.length} 条记录
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
        {!loading && !error && logisticsData.length === 0 && (
          <div className="p-4 border-t border-border text-center text-sm text-muted-foreground">
            暂无数据
          </div>
        )}
      </Card>
    </div>
  )
}
