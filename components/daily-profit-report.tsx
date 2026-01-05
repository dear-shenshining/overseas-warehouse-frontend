"use client"

import { TrendingUp, TrendingDown, DollarSign, RefreshCw } from "lucide-react"
import { Card } from "@/components/ui/card"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

export default function DailyProfitReport() {
  // Mock data for charts
  const profitData = [
    { date: "01-15", profit: 4500, revenue: 12000, refund: 500 },
    { date: "01-16", profit: 5200, revenue: 14000, refund: 800 },
    { date: "01-17", profit: 4800, revenue: 13000, refund: 600 },
    { date: "01-18", profit: 6100, revenue: 16000, refund: 400 },
    { date: "01-19", profit: 5700, revenue: 15000, refund: 700 },
    { date: "01-20", profit: 6800, revenue: 17500, refund: 500 },
    { date: "01-21", profit: 7200, revenue: 18000, refund: 300 },
  ]

  const currentProfitRate = 38.5
  const currentRefundRate = 2.8
  const previousProfitRate = 35.2
  const previousRefundRate = 3.5

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">总收入</p>
              <p className="text-3xl font-semibold text-foreground mt-2">¥92,500</p>
            </div>
            <div className="p-3 bg-chart-1/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-chart-1" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-sm">
            <TrendingUp className="h-4 w-4 text-chart-2" />
            <span className="text-chart-2 font-medium">+12.5%</span>
            <span className="text-muted-foreground">较上周</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">总利润</p>
              <p className="text-3xl font-semibold text-foreground mt-2">¥35,600</p>
            </div>
            <div className="p-3 bg-chart-2/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-chart-2" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-sm">
            <TrendingUp className="h-4 w-4 text-chart-2" />
            <span className="text-chart-2 font-medium">+8.3%</span>
            <span className="text-muted-foreground">较上周</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">利润率</p>
              <p className="text-3xl font-semibold text-foreground mt-2">{currentProfitRate}%</p>
            </div>
            <div className="p-3 bg-chart-3/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-chart-3" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-sm">
            <TrendingUp className="h-4 w-4 text-chart-2" />
            <span className="text-chart-2 font-medium">+{(currentProfitRate - previousProfitRate).toFixed(1)}%</span>
            <span className="text-muted-foreground">较上周</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">退款率</p>
              <p className="text-3xl font-semibold text-foreground mt-2">{currentRefundRate}%</p>
            </div>
            <div className="p-3 bg-chart-4/10 rounded-lg">
              <RefreshCw className="h-6 w-6 text-chart-4" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-sm">
            <TrendingDown className="h-4 w-4 text-chart-2" />
            <span className="text-chart-2 font-medium">-{(previousRefundRate - currentRefundRate).toFixed(1)}%</span>
            <span className="text-muted-foreground">较上周</span>
          </div>
        </Card>
      </div>

      {/* Profit Trend Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">利润趋势</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={profitData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="profit"
              name="利润"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--chart-1))" }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              name="收入"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--chart-2))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Refund Analysis */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">退款分析</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={profitData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Bar dataKey="refund" name="退款金额" fill="hsl(var(--chart-4))" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
