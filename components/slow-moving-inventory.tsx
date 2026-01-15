"use client"

import { useState, useEffect, useTransition, useRef } from "react"
import { Search, Download, Upload, Calendar, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react"
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
import { fetchInventoryData, fetchInventoryStatistics, importInventoryFile, refreshTaskTable } from "@/app/actions/inventory"
import type { InventoryRecord } from "@/lib/inventory-data"
import { getLabelName } from "@/lib/label-mapping"
import * as XLSX from "xlsx"

interface SlowMovingInventoryProps {
  chargeFilter?: string
}

export default function SlowMovingInventory({ chargeFilter }: SlowMovingInventoryProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [inventoryData, setInventoryData] = useState<InventoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [statistics, setStatistics] = useState({
    normal_sales: 0,
    over_15_days: 0,
    negative_inventory: 0,
    has_inventory_no_sales: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [labelFilter, setLabelFilter] = useState<'normal' | 4 | 5 | '2_not_1' | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    message?: string
    error?: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pageSize = 50

  // 加载库存数据
  const loadInventoryData = async (searchSku?: string, filter?: 'normal' | 4 | 5 | '2_not_1' | null) => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchInventoryData(searchSku, filter || undefined)
      if (result.success) {
        // 应用负责人筛选
        let filteredData = result.data
        if (chargeFilter) {
          filteredData = filteredData.filter((item) => item.charge === chargeFilter)
        }
        setInventoryData(filteredData)
        setCurrentPage(1) // 重置到第一页
      } else {
        setError(result.error || "加载库存数据失败")
        setInventoryData([])
      }
    } catch (error: any) {
      console.error("加载库存数据失败:", error)
      setError(error?.message || "加载库存数据失败，请检查数据库连接和表结构")
      setInventoryData([])
    } finally {
      setLoading(false)
    }
  }

  // 加载统计数据
  const loadStatistics = async () => {
    try {
      const result = await fetchInventoryStatistics(chargeFilter)
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
    // 并行加载数据和统计
    Promise.all([
      loadInventoryData(undefined, labelFilter),
      loadStatistics()
    ]).catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelFilter, chargeFilter])

  // 搜索功能
  const handleSearch = () => {
    startTransition(() => {
      loadInventoryData(searchQuery || undefined, labelFilter)
    })
  }

  // 处理卡片点击筛选
  const handleCardClick = (filterType: 'normal' | 4 | 5 | '2_not_1' | null) => {
    // 如果点击的是当前已选中的卡片，则取消筛选
    if (labelFilter === filterType) {
      setLabelFilter(null)
    } else {
      setLabelFilter(filterType)
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
  const totalPages = Math.ceil(inventoryData.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedData = inventoryData.slice(startIndex, endIndex)

  // 处理文件选择
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
      const result = await importInventoryFile(formData)

      setImportResult({
        success: result.success,
        message: result.message,
        error: result.error,
      })

      if (result.success) {
        // 导入成功，并行刷新数据
        await Promise.all([
          loadInventoryData(searchQuery || undefined, labelFilter),
          loadStatistics()
        ])
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

  // 导出数据功能
  const handleExport = () => {
    if (inventoryData.length === 0) {
      alert("没有数据可导出")
      return
    }

    try {
      // 准备导出数据
      const exportData = inventoryData.map((record) => {
        const labels = Array.isArray(record.label) ? record.label : []
        const labelNames = labels.map((label) => getLabelName(label))
        return {
          SKU货号: record.ware_sku,
          库存数量: record.inventory_num,
          最近七天销量: record.sales_num,
          可售天数: record.sale_day ?? '-',
          负责人: record.charge ?? '-',
          标识: labelNames.length > 0 ? labelNames.join(',') : '-',
        }
      })

      // 创建工作簿
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)

      // 设置列宽
      const colWidths = [
        { wch: 20 }, // SKU货号
        { wch: 12 }, // 库存数量
        { wch: 15 }, // 最近七天销量
        { wch: 12 }, // 可售天数
        { wch: 15 }, // 负责人
        { wch: 15 }, // 标识
      ]
      ws['!cols'] = colWidths

      // 添加工作表到工作簿
      XLSX.utils.book_append_sheet(wb, ws, "库存数据")

      // 生成文件名：当前日期+滞销库存.xlsx
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      const fileName = `${year}-${month}-${day}滞销库存.xlsx`

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
                placeholder="输入SKU货号查询..."
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
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="h-4 w-4" />
            {importing ? "导入中..." : "导入数据"}
          </Button>
        </div>
      </Card>

      {/* 导入结果提示 */}
      {importResult && (
        <Card
          className={`p-4 ${
            importResult.success
              ? 'bg-chart-2/10 border-chart-2/20'
              : 'bg-destructive/10 border-destructive/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-sm font-medium ${
                  importResult.success ? 'text-chart-2' : 'text-destructive'
                }`}
              >
                {importResult.success
                  ? '✓ 导入成功'
                  : '✗ 导入失败'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {importResult.message || importResult.error}
              </p>
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            labelFilter === 'normal' ? 'ring-2 ring-chart-2 bg-chart-2/5' : ''
          }`}
          onClick={() => handleCardClick('normal')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-2/10 rounded-lg">
              <CheckCircle className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">正常销售</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.normal_sales}</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            labelFilter === 4 ? 'ring-2 ring-chart-1 bg-chart-1/5' : ''
          }`}
          onClick={() => handleCardClick(4)}
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
            labelFilter === 5 ? 'ring-2 ring-chart-4 bg-chart-4/5' : ''
          }`}
          onClick={() => handleCardClick(5)}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-chart-4/10 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-chart-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">库存待冲平</p>
              <p className="text-2xl font-semibold text-foreground">{statistics.negative_inventory}</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            labelFilter === '2_not_1' ? 'ring-2 ring-chart-2 bg-chart-2/5' : ''
          }`}
          onClick={() => handleCardClick('2_not_1')}
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
                loadInventoryData(searchQuery || undefined, labelFilter)
                loadStatistics()
              }}
            >
              重试
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            请检查：1. PostgreSQL 服务是否启动（本地）或 Neon 连接是否正常（云端） 2. 数据库 seas_ware 是否存在 3. 表 inventory 是否存在（执行 sql/postgresql/create_inventory_table.sql） 4. 数据库配置是否正确（.env 文件）
          </p>
        </Card>
      )}

      {/* Inventory Table */}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading || isPending ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    加载中...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-destructive">
                    数据加载失败，请查看上方错误提示
                  </td>
                </tr>
              ) : inventoryData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
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
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 数据统计和分页 */}
        {!loading && !error && inventoryData.length > 0 && (
          <div className="p-4 border-t border-border">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                显示第 {startIndex + 1} - {Math.min(endIndex, inventoryData.length)} 条，共 {inventoryData.length} 条记录
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
        {!loading && !error && inventoryData.length === 0 && (
          <div className="p-4 border-t border-border text-center text-sm text-muted-foreground">
            暂无数据
          </div>
        )}
      </Card>
    </div>
  )
}
