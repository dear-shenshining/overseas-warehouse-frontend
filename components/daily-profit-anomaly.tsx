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
import { fetchAnomalySKUs, fetchStoreList, fetchOperatorList } from "@/app/actions/orders"
import { format, subDays } from "date-fns"
import { zhCN } from "date-fns/locale"

interface AnomalySKU {
  platform_sku: string
  totalCount: number
  anomalyCount: number
  anomalyRate: number
  avg_profit_rate?: number
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
                        <td className="p-2 text-sm font-medium">{sku.platform_sku}</td>
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
                        <td className="p-2 text-sm font-medium">{sku.platform_sku}</td>
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
    </div>
  )
}

