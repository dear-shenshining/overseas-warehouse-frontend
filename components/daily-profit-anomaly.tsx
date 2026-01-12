"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, Package, TrendingDown, BarChart3 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { DateRangePicker } from "@/components/ui/date-range-picker"
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
import { fetchAnomalySKUs, fetchStoreList, fetchOperatorList, fetchAnomalyOrderDetails } from "@/app/actions/orders"
import { format, subDays } from "date-fns"
import { zhCN } from "date-fns/locale"

interface AnomalySKU {
  platform_sku: string
  totalCount: number
  anomalyCount: number
  anomalyRate: number
  avg_profit_rate?: number
}

interface AnomalyOrderDetail {
  order_number: string
  store_name?: string
  operator?: string
  payment_time?: Date | string
  platform_sku?: string
  logistics_channel?: string
  total_product_cost?: number
  actual_shipping_fee?: number
  sales_refund?: number
  shipping_refund?: number
  profit?: number
  profit_rate?: number
  total_amount?: number
}

export default function DailyProfitAnomaly() {
  // 默认显示最近14天
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const start = subDays(new Date(), 13)
    return format(start, "yyyy-MM-dd")
  })
  const [dateTo, setDateTo] = useState<string>(() => {
    return format(new Date(), "yyyy-MM-dd")
  })
  const [selectedStore, setSelectedStore] = useState<string>("all")
  const [selectedOperator, setSelectedOperator] = useState<string>("all")
  const [storeList, setStoreList] = useState<string[]>([])
  const [operatorList, setOperatorList] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    totalCount: 0,
    lowProfitRateCount: 0,
    noShippingRefundCount: 0,
    anomalyCount: 0,
    anomalyRate: 0,
  })
  const [lowProfitRateSKUs, setLowProfitRateSKUs] = useState<AnomalySKU[]>([])
  const [noShippingRefundSKUs, setNoShippingRefundSKUs] = useState<AnomalySKU[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedSKU, setSelectedSKU] = useState<string>("")
  const [selectedAnomalyType, setSelectedAnomalyType] = useState<'lowProfitRate' | 'noShippingRefund'>('lowProfitRate')
  const [orderDetails, setOrderDetails] = useState<AnomalyOrderDetail[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  // 加载店铺列表和运营人员列表
  useEffect(() => {
    const loadLists = async () => {
      const storeResult = await fetchStoreList()
      if (storeResult.success) {
        setStoreList(storeResult.data)
      }
      const operatorResult = await fetchOperatorList()
      if (operatorResult.success) {
        setOperatorList(operatorResult.data)
      }
    }
    loadLists()
  }, [])

  // 加载异常SKU数据
  useEffect(() => {
    const loadAnomalyData = async () => {
      setLoading(true)
      try {
        const result = await fetchAnomalySKUs(
          dateFrom,
          dateTo,
          selectedStore === "all" ? undefined : selectedStore,
          selectedOperator === "all" ? undefined : selectedOperator
        )
        
        if (result.success && result.data) {
          setStats({
            totalCount: result.data.totalCount || 0,
            lowProfitRateCount: result.data.lowProfitRateCount || 0,
            noShippingRefundCount: result.data.noShippingRefundCount || 0,
            anomalyCount: result.data.anomalyCount || 0,
            anomalyRate: result.data.anomalyRate || 0,
          })
          setLowProfitRateSKUs(result.data.lowProfitRateSKUs || [])
          setNoShippingRefundSKUs(result.data.noShippingRefundSKUs || [])
        }
      } catch (error) {
        console.error('加载异常SKU数据失败:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadAnomalyData()
  }, [dateFrom, dateTo, selectedStore, selectedOperator])

  // 处理日期范围变化
  const handleDateChange = (from: string | undefined, to: string | undefined) => {
    if (from && to) {
      setDateFrom(from)
      setDateTo(to)
    }
  }

  // 处理SKU点击事件
  const handleSKUClick = async (sku: string, anomalyType: 'lowProfitRate' | 'noShippingRefund') => {
    setSelectedSKU(sku)
    setSelectedAnomalyType(anomalyType)
    setIsDialogOpen(true)
    setLoadingDetails(true)
    setOrderDetails([])

    try {
      const result = await fetchAnomalyOrderDetails(
        sku,
        anomalyType,
        dateFrom,
        dateTo,
        selectedStore === "all" ? undefined : selectedStore,
        selectedOperator === "all" ? undefined : selectedOperator
      )

      if (result.success && result.data) {
        setOrderDetails(result.data)
      }
    } catch (error) {
      console.error('加载订单详情失败:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  // 格式化金额
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-'
    return `¥${Number(amount).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // 格式化日期
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-'
    if (typeof date === 'string') {
      const dateMatch = date.match(/^(\d{4}-\d{2}-\d{2})/)
      if (dateMatch) {
        return dateMatch[1]
      }
      return date.split('T')[0].split(' ')[0]
    }
    const dateObj = new Date(date)
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {/* 页面标题和过滤器 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">每日发货毛利异常</h1>
          <p className="text-sm text-muted-foreground mt-1">查看筛选日期范围内，筛选店铺范围内的异常SKU</p>
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
          <Select value={selectedOperator} onValueChange={setSelectedOperator}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="选择运营" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部运营</SelectItem>
              {operatorList.map((operator) => (
                <SelectItem key={operator} value={operator}>
                  {operator}
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
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 总数量 */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">总数量</p>
                  <p className="text-2xl font-semibold text-foreground">{stats.totalCount.toLocaleString()}</p>
                </div>
                <div className="p-2.5 bg-chart-1/10 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-chart-1" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                筛选范围内的订单总数
              </div>
            </Card>

            {/* 异常数量 */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">异常数量</p>
                  <p className="text-2xl font-semibold text-foreground text-orange-500">{stats.anomalyCount.toLocaleString()}</p>
                </div>
                <div className="p-2.5 bg-orange-500/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                毛利率低或无运费补贴
              </div>
            </Card>

            {/* 毛利率低数量 */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">毛利率低</p>
                  <p className="text-2xl font-semibold text-foreground text-orange-500">{stats.lowProfitRateCount.toLocaleString()}</p>
                </div>
                <div className="p-2.5 bg-orange-500/10 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-orange-500" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                毛利率低于20%的订单
              </div>
            </Card>

            {/* 无运费补贴数量 */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">无运费补贴</p>
                  <p className="text-2xl font-semibold text-foreground text-red-500">{stats.noShippingRefundCount.toLocaleString()}</p>
                </div>
                <div className="p-2.5 bg-red-500/10 rounded-lg">
                  <Package className="h-5 w-5 text-red-500" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                运费回款为0的订单
              </div>
            </Card>
          </div>

          {/* 异常率卡片 */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">异常率</p>
                <p className="text-3xl font-semibold text-foreground text-orange-500">
                  {stats.anomalyRate.toFixed(2)}%
                </p>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
              </div>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              异常订单数 / 总订单数 × 100%
            </div>
          </Card>

          {/* SKU列表 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 毛利率低数量最多的SKU */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold text-foreground">毛利率低数量最多的SKU（前10个）</h3>
            </div>
            {lowProfitRateSKUs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium text-sm">排名</th>
                      <th className="text-left p-2 font-medium text-sm">SKU</th>
                      <th className="text-right p-2 font-medium text-sm">总数量</th>
                      <th className="text-right p-2 font-medium text-sm">异常数量</th>
                      <th className="text-right p-2 font-medium text-sm">异常率</th>
                      <th className="text-right p-2 font-medium text-sm">平均毛利率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowProfitRateSKUs.map((sku, index) => (
                      <tr key={sku.platform_sku} className="border-b hover:bg-muted/50">
                        <td className="p-2 text-sm">{index + 1}</td>
                        <td 
                          className="p-2 text-sm font-medium cursor-pointer text-primary hover:underline"
                          onClick={() => handleSKUClick(sku.platform_sku, 'lowProfitRate')}
                          title="点击查看详情"
                        >
                          {sku.platform_sku}
                        </td>
                        <td className="p-2 text-right text-sm">{sku.totalCount.toLocaleString()}</td>
                        <td className="p-2 text-right text-sm text-orange-500">{sku.anomalyCount.toLocaleString()}</td>
                        <td className="p-2 text-right text-sm text-orange-500 font-medium">
                          {sku.anomalyRate.toFixed(2)}%
                        </td>
                        <td className="p-2 text-right text-sm text-orange-500">
                          {sku.avg_profit_rate !== undefined ? `${sku.avg_profit_rate.toFixed(2)}%` : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                暂无数据
              </div>
            )}
          </Card>

          {/* 无运费补贴数量最多的SKU */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-red-500" />
              <h3 className="text-lg font-semibold text-foreground">无运费补贴数量最多的SKU（前10个）</h3>
            </div>
            {noShippingRefundSKUs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium text-sm">排名</th>
                      <th className="text-left p-2 font-medium text-sm">SKU</th>
                      <th className="text-right p-2 font-medium text-sm">总数量</th>
                      <th className="text-right p-2 font-medium text-sm">异常数量</th>
                      <th className="text-right p-2 font-medium text-sm">异常率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noShippingRefundSKUs.map((sku, index) => (
                      <tr key={sku.platform_sku} className="border-b hover:bg-muted/50">
                        <td className="p-2 text-sm">{index + 1}</td>
                        <td 
                          className="p-2 text-sm font-medium cursor-pointer text-primary hover:underline"
                          onClick={() => handleSKUClick(sku.platform_sku, 'noShippingRefund')}
                          title="点击查看详情"
                        >
                          {sku.platform_sku}
                        </td>
                        <td className="p-2 text-right text-sm">{sku.totalCount.toLocaleString()}</td>
                        <td className="p-2 text-right text-sm text-red-500">{sku.anomalyCount.toLocaleString()}</td>
                        <td className="p-2 text-right text-sm text-red-500 font-medium">
                          {sku.anomalyRate.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                暂无数据
              </div>
            )}
          </Card>
          </div>
        </>
      )}

      {/* 订单详情对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          className="!max-w-[90vw] !w-[90vw] sm:!max-w-[90vw] max-h-[85vh] overflow-y-auto" 
          style={{ maxWidth: '95vw', width: '95vw' }}
        >
          <DialogHeader>
            <DialogTitle>
              {selectedAnomalyType === 'lowProfitRate' ? '毛利率低' : '无运费补贴'}订单详情 - {selectedSKU}
            </DialogTitle>
            <DialogDescription>
              查看该SKU的异常订单明细（共 {orderDetails.length} 条）
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">加载中...</div>
              </div>
            ) : orderDetails.length > 0 ? (
              <div>
                <table className="w-full border-collapse table-fixed">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium text-xs w-[10%]">单号</th>
                      <th className="text-left p-2 font-medium text-xs w-[10%]">SKU</th>
                      <th className="text-left p-2 font-medium text-xs w-[8%]">店铺名</th>
                      <th className="text-left p-2 font-medium text-xs w-[8%]">付款时间</th>
                      <th className="text-right p-2 font-medium text-xs w-[8%]">商品总成本</th>
                      <th className="text-right p-2 font-medium text-xs w-[8%]">实际运费</th>
                      <th className="text-right p-2 font-medium text-xs w-[8%]">销售回款</th>
                      <th className="text-right p-2 font-medium text-xs w-[8%]">运费回款</th>
                      <th className="text-right p-2 font-medium text-xs w-[8%]">毛利</th>
                      <th className="text-right p-2 font-medium text-xs w-[7%]">利润率</th>
                      <th className="text-left p-2 font-medium text-xs w-[12%]">店铺运营人员</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderDetails.map((order) => (
                      <tr key={order.order_number} className="border-b hover:bg-muted/50">
                        <td className="p-2 text-xs break-all" title={order.order_number || '-'}>
                          {order.order_number || '-'}
                        </td>
                        <td className="p-2 text-xs truncate" title={order.platform_sku || '-'}>
                          {order.platform_sku || '-'}
                        </td>
                        <td className="p-2 text-xs truncate" title={order.store_name || '-'}>
                          {order.store_name || '-'}
                        </td>
                        <td className="p-2 text-xs">{formatDate(order.payment_time)}</td>
                        <td className="p-2 text-xs text-right">{formatCurrency(order.total_product_cost)}</td>
                        <td className="p-2 text-xs text-right">{formatCurrency(order.actual_shipping_fee)}</td>
                        <td className="p-2 text-xs text-right">{formatCurrency(order.sales_refund)}</td>
                        <td className="p-2 text-xs text-right">{formatCurrency(order.shipping_refund)}</td>
                        <td className="p-2 text-xs text-right">{formatCurrency(order.profit)}</td>
                        <td className="p-2 text-xs text-right">
                          {order.profit_rate !== null && order.profit_rate !== undefined 
                            ? `${Number(order.profit_rate).toFixed(2)}%` 
                            : '-'}
                        </td>
                        <td className="p-2 text-xs truncate" title={order.operator || '-'}>
                          {order.operator || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">暂无订单数据</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

