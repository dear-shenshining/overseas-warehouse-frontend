# ✅ Server Actions 架构说明

## 📋 项目架构

项目使用 **Server Actions** 直接在服务端连接数据库，无需 API 路由层。

## ✅ 新的架构

### 数据服务层
- ✅ `lib/logistics-data.ts` - 直接连接数据库的服务函数
- ✅ `lib/db.ts` - 数据库连接配置（保持不变）

### Server Actions
- ✅ `app/actions/logistics.ts` - 物流相关的 Server Actions

### 组件
- ✅ `components/overseas-logistics.tsx` - 已更新为使用 Server Actions

## 📊 新的数据流

```
组件 (客户端)
    ↓
Server Actions (app/actions/logistics.ts)
    ↓
数据服务 (lib/logistics-data.ts)
    ↓
数据库连接 (lib/db.ts)
    ↓
MySQL 数据库
```

## 🔧 使用方式

### 在组件中使用

```typescript
import { fetchLogisticsData, fetchLogisticsStatistics } from "@/app/actions/logistics"
import type { LogisticsRecord } from "@/lib/logistics-data"

// 获取数据
const result = await fetchLogisticsData(searchNum)
if (result.success) {
  const data = result.data
}

// 获取统计
const statsResult = await fetchLogisticsStatistics()
if (statsResult.success) {
  const stats = statsResult.data
}
```

## ✨ 优势

1. **更简单** - 无需维护路由层
2. **更直接** - 直接在服务端查询数据库
3. **类型安全** - 完整的 TypeScript 支持
4. **性能更好** - 减少 HTTP 请求开销
5. **更安全** - 数据库连接只在服务端

## 📝 注意事项

1. **Server Actions 必须在服务端执行**
   - 使用 `'use server'` 指令
   - 只能在服务端组件或 Server Actions 中调用

2. **客户端组件使用方式**
   - 客户端组件可以调用 Server Actions
   - 使用 `useTransition` 处理加载状态

3. **数据库连接**
   - 数据库配置在 `lib/db.ts`
   - 使用连接池管理连接

## 🎯 下一步

如果需要添加利润报表的 Server Actions，可以创建：
- `app/actions/profit.ts` - 利润相关的 Server Actions
- `lib/profit-data.ts` - 利润数据服务

现在项目完全使用 Server Actions 架构，直接在服务端连接数据库！

