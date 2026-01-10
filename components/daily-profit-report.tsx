"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { TrendingUp, TrendingDown, DollarSign, Package, Upload, RefreshCw, ShoppingCart } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { importOrdersFile, fetchOrdersStatistics, fetchStoreList, recalculateProfit, fetchOrdersList } from "@/app/actions/orders"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { format, subDays } from "date-fns"
import { zhCN } from "date-fns/locale"

interface DailyData {
  date: string
  profit: number
  shipping: number
  dateLabel: string
}

interface OrderDetail {
  id: string
  orderNo: string
  amount: number
  profit: number
  shipping: number
}

export default function DailyProfitReport() {
  // 默认显示最近14天
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const start = subDays(new Date(), 13)
    return format(start, "yyyy-MM-dd")
  })
  const [dateTo, setDateTo] = useState<string>(() => {
    return format(new Date(), "yyyy-MM-dd")
  })
  const [selectedStore, setSelectedStore] = useState<string>("all")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'profit' | 'shipping' | 'orders' | 'lowProfitRate' | 'noShippingRefund' | null>(null)
  const [filteredOrders, setFilteredOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50
  const [importing, setImporting] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [importResult, setImportResult] = useState<{
    success: boolean
    message?: string
    error?: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 店铺列表和统计数据
  const [storeList, setStoreList] = useState<string[]>([])
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [stats, setStats] = useState({
    totalProfit: 0,
    totalShipping: 0,
    totalOrders: 0,
    days: 0,
    lowProfitRateCount: 0,
    noShippingRefundCount: 0,
    shippingPercentage: "0.0",
  })

  // 加载店铺列表
  useEffect(() => {
    const loadStoreList = async () => {
      const result = await fetchStoreList()
      if (result.success) {
        setStoreList(result.data)
      }
    }
    loadStoreList()
  }, [])

  // 加载统计数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        console.log('加载数据，参数:', { dateFrom, dateTo, selectedStore })
        const result = await fetchOrdersStatistics(
          dateFrom,
          dateTo,
          selectedStore === "all" ? undefined : selectedStore
        )
        
        console.log('获取到的数据结果:', result)
        
        if (result.success && result.data) {
          // 转换每日数据格式
          const formattedDailyData: DailyData[] = result.data.dailyData.map(item => ({
            date: item.date,
            dateLabel: format(new Date(item.date), "MM-dd"),
            profit: item.profit,
            shipping: item.shipping,
          }))

          console.log('格式化后的每日数据:', formattedDailyData)
          console.log('统计数据:', {
            totalProfit: result.data.totalProfit,
            totalShipping: result.data.totalShipping,
            lowProfitRateCount: result.data.lowProfitRateCount,
            noShippingRefundCount: result.data.noShippingRefundCount,
          })

          setDailyData(formattedDailyData)
          setStats({
            totalProfit: result.data.totalProfit,
            totalShipping: result.data.totalShipping,
            totalOrders: result.data.totalOrders || 0,
            days: formattedDailyData.length,
            lowProfitRateCount: result.data.lowProfitRateCount,
            noShippingRefundCount: result.data.noShippingRefundCount,
            shippingPercentage: result.data.totalProfit > 0 
              ? ((result.data.totalShipping / result.data.totalProfit) * 100).toFixed(1) 
              : "0.0",
          })
        } else {
          console.error('获取数据失败:', result.error)
        }
      } catch (error) {
        console.error('加载数据失败:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [dateFrom, dateTo, selectedStore])

  // 当筛选条件变化时，如果当前显示的是表格，重新加载数据
  useEffect(() => {
    if (activeTab === 'lowProfitRate' || activeTab === 'noShippingRefund') {
      setCurrentPage(1)
      const loadOrders = async () => {
        setLoadingOrders(true)
        try {
          const result = await fetchOrdersList(
            dateFrom,
            dateTo,
            selectedStore === "all" ? undefined : selectedStore,
            activeTab
          )
          if (result.success) {
            setFilteredOrders(result.data)
          } else {
            console.error('获取订单列表失败:', result.error)
            setFilteredOrders([])
          }
        } catch (error) {
          console.error('加载订单列表失败:', error)
          setFilteredOrders([])
        } finally {
          setLoadingOrders(false)
        }
      }
      loadOrders()
    }
  }, [dateFrom, dateTo, selectedStore, activeTab])

  // 处理选项卡点击
  const handleTabClick = async (tab: 'profit' | 'shipping' | 'orders' | 'lowProfitRate' | 'noShippingRefund' | null) => {
    setActiveTab(tab)
    setCurrentPage(1) // 切换选项卡时重置到第一页
    
    // 如果点击的是需要显示表格的选项卡，加载订单数据
    if (tab === 'lowProfitRate' || tab === 'noShippingRefund') {
      setLoadingOrders(true)
      try {
        const result = await fetchOrdersList(
          dateFrom,
          dateTo,
          selectedStore === "all" ? undefined : selectedStore,
          tab
        )
        if (result.success) {
          setFilteredOrders(result.data)
        } else {
          console.error('获取订单列表失败:', result.error)
          setFilteredOrders([])
        }
      } catch (error) {
        console.error('加载订单列表失败:', error)
        setFilteredOrders([])
      } finally {
        setLoadingOrders(false)
      }
    } else {
      // 其他选项卡显示图表，清空订单列表
      setFilteredOrders([])
    }
  }

  // 计算分页数据
  const totalPages = Math.ceil(filteredOrders.length / pageSize)
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredOrders.slice(startIndex, endIndex)
  }, [filteredOrders, currentPage, pageSize])

  // 处理页码变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // 滚动到表格顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 格式化日期范围显示（用于日期选择器）
  const dateRangeLabel = useMemo(() => {
    if (dateFrom && dateTo) {
      const start = new Date(dateFrom)
      const end = new Date(dateTo)
      return `${format(start, "MM月dd日", { locale: zhCN })} - ${format(end, "MM月dd日", { locale: zhCN })}`
    }
    return ""
  }, [dateFrom, dateTo])

  // 处理日期范围变化
  const handleDateChange = (from: string | undefined, to: string | undefined) => {
    if (from && to) {
      setDateFrom(from)
      setDateTo(to)
    }
  }

  // 处理图表点击事件
  const handleChartClick = async (dateLabel: string) => {
    const clickedDate = dailyData.find(item => item.dateLabel === dateLabel)
    if (clickedDate) {
      setSelectedDate(clickedDate.date)
      // TODO: 加载该日期的真实订单详情
      // 暂时使用空数组，后续可以实现
      setOrderDetails([])
      setIsDialogOpen(true)
    }
  }

  // 自定义 Tooltip，添加点击功能
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => handleChartClick(label)}
        >
          <p className="font-medium mb-2 text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm mb-1" style={{ color: entry.color }}>
              {entry.name === "profit" ? "利润" : "运费"}: {formatCurrency(entry.value)}
            </p>
          ))}
          <p className="text-xs text-gray-500 mt-2">点击查看订单详情</p>
        </div>
      )
    }
    return null
  }

  // 格式化金额
  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString("zh-CN")}`
  }

  // 处理重新计算profit字段
  const handleRecalculateProfit = async () => {
    if (!confirm('确定要重新计算所有订单的profit字段吗？这可能需要一些时间。')) {
      return
    }
    
    setRecalculating(true)
    setImportResult(null)
    
    try {
      const result = await recalculateProfit()
      
      setImportResult({
        success: result.success,
        message: result.message,
        error: result.error,
      })
      
      // 重新计算成功后，刷新数据
      if (result.success && result.updated > 0) {
        const statsResult = await fetchOrdersStatistics(
          dateFrom,
          dateTo,
          selectedStore === "all" ? undefined : selectedStore
        )
        
        if (statsResult.success && statsResult.data) {
          const formattedDailyData: DailyData[] = statsResult.data.dailyData.map(item => ({
            date: item.date,
            dateLabel: format(new Date(item.date), "MM-dd"),
            profit: item.profit,
            shipping: item.shipping,
          }))

          setDailyData(formattedDailyData)
          setStats({
            totalProfit: statsResult.data.totalProfit,
            totalShipping: statsResult.data.totalShipping,
            totalOrders: statsResult.data.totalOrders || 0,
            days: formattedDailyData.length,
            lowProfitRateCount: statsResult.data.lowProfitRateCount,
            noShippingRefundCount: statsResult.data.noShippingRefundCount,
            shippingPercentage: statsResult.data.totalProfit > 0 
              ? ((statsResult.data.totalShipping / statsResult.data.totalProfit) * 100).toFixed(1) 
              : "0.0",
          })
        }
      }
    } catch (error: any) {
      console.error('重新计算失败:', error)
      setImportResult({
        success: false,
        error: error.message || '重新计算失败，请重试',
      })
    } finally {
      setRecalculating(false)
    }
  }

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
      const result = await importOrdersFile(formData)

      setImportResult({
        success: result.success,
        message: result.message,
        error: result.error,
      })

      // 导入成功后，刷新数据
      if (result.success) {
        // 重新加载数据
        const statsResult = await fetchOrdersStatistics(
          dateFrom,
          dateTo,
          selectedStore === "all" ? undefined : selectedStore
        )
        
        if (statsResult.success && statsResult.data) {
          const formattedDailyData: DailyData[] = statsResult.data.dailyData.map(item => ({
            date: item.date,
            dateLabel: format(new Date(item.date), "MM-dd"),
            profit: item.profit,
            shipping: item.shipping,
          }))

          setDailyData(formattedDailyData)
          setStats({
            totalProfit: statsResult.data.totalProfit,
            totalShipping: statsResult.data.totalShipping,
            totalOrders: statsResult.data.totalOrders || 0,
            days: formattedDailyData.length,
            lowProfitRateCount: statsResult.data.lowProfitRateCount,
            noShippingRefundCount: statsResult.data.noShippingRefundCount,
            shippingPercentage: statsResult.data.totalProfit > 0 
              ? ((statsResult.data.totalShipping / statsResult.data.totalProfit) * 100).toFixed(1) 
              : "0.0",
          })
        }
        
        // 重新加载店铺列表（可能有新店铺）
        const storeResult = await fetchStoreList()
        if (storeResult.success) {
          setStoreList(storeResult.data)
        }
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

  return (
    <div className="space-y-4">
      {/* 页面标题和过滤器 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">每日发货毛利分析</h1>
          <p className="text-sm text-muted-foreground mt-1">查看店铺每日发货毛利和运费趋势</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="选择店铺" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部店铺</SelectItem>
              {storeList.map((store) => (
                <SelectItem key={store} value={store}>
                  {store}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateChange={handleDateChange}
            className="w-[280px]"
          />
          {/* 重新计算profit */}
          <Button 
            variant="outline" 
            className="gap-2" 
            disabled={recalculating || importing}
            onClick={handleRecalculateProfit}
          >
            <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? '计算中...' : '重新计算profit'}
          </Button>
          {/* 导入数据 */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={importing || recalculating}
            />
            <Button variant="outline" className="gap-2" disabled={importing || recalculating}>
              <Upload className="h-4 w-4" />
              {importing ? '导入中...' : '导入数据'}
            </Button>
          </div>
        </div>
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

      {/* 统计卡片 */}
      {loading ? (
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-3">
          {/* 总毛利 */}
          <Card 
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${
              activeTab === 'profit' ? 'ring-2 ring-primary ring-offset-2' : ''
            }`}
            onClick={() => handleTabClick('profit')}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">总毛利（金额）</p>
                <p className="text-2xl font-semibold text-foreground">{formatCurrency(stats.totalProfit)}</p>
              </div>
              <div className="p-2.5 bg-chart-1/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-chart-1" />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              总毛利金额
            </div>
          </Card>

          {/* 总运费 */}
          <Card 
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${
              activeTab === 'shipping' ? 'ring-2 ring-primary ring-offset-2' : ''
            }`}
            onClick={() => handleTabClick('shipping')}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">总运费（金额）</p>
                <p className="text-2xl font-semibold text-foreground">{formatCurrency(stats.totalShipping)}</p>
              </div>
              <div className="p-2.5 bg-chart-2/10 rounded-lg">
                <Package className="h-5 w-5 text-chart-2" />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              总运费金额
            </div>
          </Card>

          {/* 总订单 */}
          <Card 
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${
              activeTab === 'orders' ? 'ring-2 ring-primary ring-offset-2' : ''
            }`}
            onClick={() => handleTabClick('orders')}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">总订单（数量）</p>
                <p className="text-2xl font-semibold text-foreground">{stats.totalOrders}</p>
              </div>
              <div className="p-2.5 bg-chart-5/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-chart-5" />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              筛选条件下的所有订单数量
            </div>
          </Card>

          {/* 毛利率低 */}
          <Card 
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${
              activeTab === 'lowProfitRate' ? 'ring-2 ring-primary ring-offset-2' : ''
            }`}
            onClick={() => handleTabClick('lowProfitRate')}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">毛利率低（数量）</p>
                <p className="text-2xl font-semibold text-foreground">{stats.lowProfitRateCount}</p>
              </div>
              <div className="p-2.5 bg-chart-3/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-chart-3" />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              毛利率低于20%的订单数量
            </div>
          </Card>

          {/* 无运费补贴 */}
          <Card 
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${
              activeTab === 'noShippingRefund' ? 'ring-2 ring-primary ring-offset-2' : ''
            }`}
            onClick={() => handleTabClick('noShippingRefund')}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">无运费补贴（数量）</p>
                <p className="text-2xl font-semibold text-foreground">{stats.noShippingRefundCount}</p>
              </div>
              <div className="p-2.5 bg-chart-4/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-chart-4" />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              运费回款为0的订单数量
            </div>
          </Card>
        </div>
      )}

      {/* 根据选项卡显示图表或表格 */}
      {(activeTab === null || activeTab === 'profit' || activeTab === 'shipping' || activeTab === 'orders') ? (
        /* 利润与运费趋势图表 */
        <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">利润与运费趋势</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-muted-foreground">利润</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-muted-foreground">运费</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart 
            data={dailyData}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="dateLabel"
              stroke="#9ca3af"
              tick={{ fill: "#6b7280", fontSize: 12 }}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              yAxisId="left"
              stroke="#9ca3af"
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
              domain={[0, 'dataMax + 2000']}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#9ca3af"
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickFormatter={(value) => `¥${(value / 1000).toFixed(1)}k`}
              domain={[0, 'dataMax + 400']}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ display: 'none' }} />
            {/* 利润用蓝色柱状图 */}
            <Bar
              yAxisId="left"
              dataKey="profit"
              name="profit"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
            />
            {/* 运费用绿色折线图 */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="shipping"
              name="shipping"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: "#10b981", r: 4, cursor: "pointer" }}
              activeDot={{ r: 6, cursor: "pointer", fill: "#10b981" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-sm text-muted-foreground mt-3 text-center">
          点击图表数据点查看当日订单详情
        </p>
      </Card>
      ) : (
        /* 订单列表表格 */
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              {activeTab === 'lowProfitRate' ? '毛利率低订单列表' : '无运费补贴订单列表'}
            </h3>
            <span className="text-sm text-muted-foreground">
              共 {filteredOrders.length} 条订单
              {totalPages > 1 && `，第 ${currentPage}/${totalPages} 页`}
            </span>
          </div>
          {loadingOrders ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-muted-foreground">加载中...</div>
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-sm">单号</th>
                    <th className="text-left p-3 font-medium text-sm">店铺名</th>
                    <th className="text-left p-3 font-medium text-sm">付款时间</th>
                    <th className="text-left p-3 font-medium text-sm">SKU</th>
                    <th className="text-left p-3 font-medium text-sm">物流渠道</th>
                    <th className="text-right p-3 font-medium text-sm">商品总成本</th>
                    <th className="text-right p-3 font-medium text-sm">运费</th>
                    <th className="text-right p-3 font-medium text-sm">毛利</th>
                    <th className="text-right p-3 font-medium text-sm">利润率</th>
                    <th className="text-right p-3 font-medium text-sm">运费回款</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => {
                    // 格式化付款时间（只显示年月日）
                    let paymentDate = ''
                    if (order.payment_time) {
                      if (typeof order.payment_time === 'string') {
                        const dateMatch = order.payment_time.match(/^(\d{4}-\d{2}-\d{2})/)
                        paymentDate = dateMatch ? dateMatch[1] : order.payment_time.split('T')[0].split(' ')[0]
                      } else {
                        const dateObj = new Date(order.payment_time)
                        paymentDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
                      }
                    }
                    
                    return (
                      <tr key={order.order_number} className="border-b hover:bg-muted/50">
                        <td className="p-3 text-sm">{order.order_number}</td>
                        <td className="p-3 text-sm">{order.store_name || '-'}</td>
                        <td className="p-3 text-sm">{paymentDate || '-'}</td>
                        <td className="p-3 text-sm">{order.platform_sku || '-'}</td>
                        <td className="p-3 text-sm">{order.logistics_channel || '-'}</td>
                        <td className="p-3 text-sm text-right">{formatCurrency(order.total_product_cost || 0)}</td>
                        <td className="p-3 text-sm text-right">{formatCurrency(order.actual_shipping_fee || 0)}</td>
                        <td className="p-3 text-sm text-right">{formatCurrency(order.profit || 0)}</td>
                        <td className="p-3 text-sm text-right">
                          {order.profit_rate !== null && order.profit_rate !== undefined 
                            ? `${Number(order.profit_rate).toFixed(2)}%` 
                            : '-'}
                        </td>
                        <td className="p-3 text-sm text-right">{formatCurrency(order.shipping_refund || 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">暂无订单数据</p>
            </div>
          )}
          {/* 分页组件 */}
          {!loadingOrders && filteredOrders.length > 0 && totalPages > 1 && (
            <div className="mt-4 flex justify-center">
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
                    const pages: number[] = []
                    const maxVisiblePages = 5
                    
                    if (totalPages <= maxVisiblePages) {
                      // 如果总页数少于等于5页，显示所有页码
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i)
                      }
                    } else {
                      // 如果总页数大于5页，显示当前页附近的页码
                      if (currentPage <= 3) {
                        // 当前页在前3页
                        for (let i = 1; i <= 4; i++) {
                          pages.push(i)
                        }
                        pages.push(-1) // 省略号占位
                        pages.push(totalPages)
                      } else if (currentPage >= totalPages - 2) {
                        // 当前页在后3页
                        pages.push(1)
                        pages.push(-1) // 省略号占位
                        for (let i = totalPages - 3; i <= totalPages; i++) {
                          pages.push(i)
                        }
                      } else {
                        // 当前页在中间
                        pages.push(1)
                        pages.push(-1) // 省略号占位
                        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                          pages.push(i)
                        }
                        pages.push(-1) // 省略号占位
                        pages.push(totalPages)
                      }
                    }
                    
                    return pages.map((page, index) => {
                      if (page === -1) {
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
            </div>
          )}
        </Card>
      )}

      {/* 订单详情对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              订单详情 - {selectedDate && format(new Date(selectedDate), "yyyy年MM月dd日", { locale: zhCN })}
            </DialogTitle>
            <DialogDescription>
              查看当日的所有订单明细
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {orderDetails.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">订单号</th>
                      <th className="text-right p-2 font-medium">订单金额</th>
                      <th className="text-right p-2 font-medium">利润</th>
                      <th className="text-right p-2 font-medium">运费</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderDetails.map((order) => (
                      <tr key={order.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">{order.orderNo}</td>
                        <td className="p-2 text-right">{formatCurrency(order.amount)}</td>
                        <td className="p-2 text-right text-chart-1">{formatCurrency(order.profit)}</td>
                        <td className="p-2 text-right text-chart-2">{formatCurrency(order.shipping)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td className="p-2">合计</td>
                      <td className="p-2 text-right">
                        {formatCurrency(orderDetails.reduce((sum, o) => sum + o.amount, 0))}
                      </td>
                      <td className="p-2 text-right text-chart-1">
                        {formatCurrency(orderDetails.reduce((sum, o) => sum + o.profit, 0))}
                      </td>
                      <td className="p-2 text-right text-chart-2">
                        {formatCurrency(orderDetails.reduce((sum, o) => sum + o.shipping, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">暂无订单数据</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
