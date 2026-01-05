"use client"

import { useState, useEffect, useTransition } from "react"
import { Package, TrendingUp, Menu, X, Warehouse, ChevronRight, BarChart3, Clock, History, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import OverseasLogistics from "@/components/overseas-logistics"
import DailyProfitReport from "@/components/daily-profit-report"
import SlowMovingInventory from "@/components/slow-moving-inventory"
import TaskTimeline from "@/components/task-timeline"
import HistoryTasks from "@/components/history-tasks"
import { refreshTaskTable, fetchTaskChargeList } from "@/app/actions/inventory"

export default function LogisticsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activePage, setActivePage] = useState<"overseas" | "inventory" | "profit">("overseas")
  const [inventorySubMenu, setInventorySubMenu] = useState<"overview" | "task" | "history">("overview")
  const [inventorySubMenuOpen, setInventorySubMenuOpen] = useState(true) // 控制子菜单展开/收起
  const [isRefreshing, startRefresh] = useTransition()
  const [chargeList, setChargeList] = useState<string[]>([])
  const [selectedCharge, setSelectedCharge] = useState<string>("")

  // 加载负责人列表（只在任务及时限页面加载）
  useEffect(() => {
    if (activePage === "inventory" && inventorySubMenu === "task") {
      fetchTaskChargeList().then((result) => {
        if (result.success) {
          setChargeList(result.data)
        }
      })
    }
  }, [activePage, inventorySubMenu])

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } transition-all duration-300 bg-sidebar border-r border-sidebar-border overflow-hidden`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-sidebar-border">
            <h1 className="text-xl font-semibold text-sidebar-foreground">金焱焱数据系统</h1>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <button
              onClick={() => setActivePage("overseas")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activePage === "overseas"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
            >
              <Package className="h-5 w-5" />
              <span className="font-medium">海外物流</span>
            </button>

            <div>
              <button
                onClick={() => {
                  if (activePage === "inventory") {
                    // 如果已经是当前页面，切换子菜单展开/收起
                    setInventorySubMenuOpen(!inventorySubMenuOpen)
                  } else {
                    // 如果不是当前页面，切换到库存管理页面并展开子菜单
                    setActivePage("inventory")
                    setInventorySubMenuOpen(true)
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activePage === "inventory"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <Warehouse className="h-5 w-5" />
                <span className="font-medium">滞销库存管理</span>
                <ChevronRight 
                  className={`h-4 w-4 ml-auto transition-transform ${
                    activePage === "inventory" && inventorySubMenuOpen ? "rotate-90" : ""
                  }`} 
                />
              </button>
              
              {/* 子菜单 */}
              {activePage === "inventory" && inventorySubMenuOpen && (
                <div className="ml-8 mt-1 space-y-1">
                  <button
                    onClick={() => setInventorySubMenu("overview")}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                      inventorySubMenu === "overview"
                        ? "bg-sidebar-accent/80 text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30"
                    }`}
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span>大盘</span>
                  </button>
                  <button
                    onClick={() => setInventorySubMenu("task")}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                      inventorySubMenu === "task"
                        ? "bg-sidebar-accent/80 text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30"
                    }`}
                  >
                    <Clock className="h-4 w-4" />
                    <span>任务及时限</span>
                  </button>
                  <button
                    onClick={() => setInventorySubMenu("history")}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                      inventorySubMenu === "history"
                        ? "bg-sidebar-accent/80 text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30"
                    }`}
                  >
                    <History className="h-4 w-4" />
                    <span>历史任务</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setActivePage("profit")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activePage === "profit"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
            >
              <TrendingUp className="h-5 w-5" />
              <span className="font-medium">日利润报表</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card flex items-center px-6 gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="text-foreground">
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-lg font-semibold text-foreground">
              {activePage === "overseas" 
                ? "海外物流管理" 
                : activePage === "inventory"
                ? inventorySubMenu === "overview"
                  ? "滞销库存管理 - 大盘"
                  : inventorySubMenu === "task"
                  ? "滞销库存管理 - 任务及时限"
                  : "滞销库存管理 - 历史任务"
                : "日利润报表"}
            </h2>
            {activePage === "inventory" && inventorySubMenu === "overview" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  startRefresh(async () => {
                    const result = await refreshTaskTable()
                    if (result.success) {
                      // 可以添加成功提示
                      console.log('任务表刷新成功')
                    } else {
                      // 可以添加错误提示
                      console.error('任务表刷新失败:', result.error)
                    }
                  })
                }}
                disabled={isRefreshing}
                className="ml-auto"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            )}
            {activePage === "inventory" && inventorySubMenu === "task" && (
              <Select
                value={selectedCharge}
                onValueChange={(value) => {
                  setSelectedCharge(value === "all" ? "" : value)
                }}
              >
                <SelectTrigger className="w-[180px] ml-auto">
                  <SelectValue placeholder="筛选负责人" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部负责人</SelectItem>
                  {chargeList.map((charge) => (
                    <SelectItem key={charge} value={charge}>
                      {charge}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden p-6">
          {activePage === "overseas" ? (
            <OverseasLogistics />
          ) : activePage === "inventory" ? (
            inventorySubMenu === "overview" ? (
              <SlowMovingInventory />
            ) : inventorySubMenu === "task" ? (
              <TaskTimeline chargeFilter={selectedCharge || undefined} />
            ) : (
              <HistoryTasks />
            )
          ) : (
            <DailyProfitReport />
          )}
        </main>
      </div>
    </div>
  )
}
