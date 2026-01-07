# 爬虫完整工作流分析

## 1. 时间判断机制

### 当前实现
- **不再使用 `sessionStartTime` 参数**
- **直接使用数据库的 `NOW()` 进行比较**
- **查询条件**：`updated_at IS NULL OR updated_at < NOW()`

### 时间判断逻辑
```sql
-- 查询待处理的追踪号
SELECT search_num, states
FROM post_searchs
WHERE (states NOT IN ('Final delivery', 'Returned to sender') OR states IS NULL)
  AND (updated_at IS NULL OR updated_at < NOW())
ORDER BY updated_at ASC NULLS FIRST, id ASC
LIMIT 20
```

### updated_at 更新规则
1. **成功处理**：`updated_at = CURRENT_TIMESTAMP`（在 `updateSearchState` 中更新）
2. **处理失败**：`updated_at` 保持不变（不更新，下次还能被查询到）

## 2. 完整工作流程

### 阶段1：初始化（每次调用 runCrawler）
```
1. 获取数据库当前时间（仅用于日志）
   - SELECT NOW()::text as now
   - sessionStartTimeStr（仅用于日志显示）

2. 初始化内存变量（进程重启会丢失）
   - processedSet = new Set()  // 记录已处理的追踪号
   - stats = { success: 0, failed: 0, skipped: 0, totalRetries: 0 }
   - totalProcessed = 0
   - batchCount = 0
   - consecutiveNoNewItemsBatches = 0
```

### 阶段2：批次处理循环
```
while (hasEnoughTime(startTime)) {
  1. 查询待处理追踪号
     - 使用 NOW() 进行比较
     - 条件：updated_at < NOW()
     - 排除：Final delivery, Returned to sender
  
  2. 过滤已处理的追踪号
     - newItems = trackingNumbers.filter(item => !processedSet.has(item.search_num))
     - 如果 newItems.length === 0，检查连续未处理批次数
  
  3. 处理本批次
     - processBatch(newItems, stats)
     - 成功：更新 states 和 updated_at
     - 失败：不更新 updated_at（保持原值）
  
  4. 记录到 processedSet
     - newItems.forEach(item => processedSet.add(item.search_num))
  
  5. 更新统计
     - totalProcessed = stats.success + stats.failed
}
```

### 阶段3：判断 hasMore
```
1. 查询剩余追踪号数量
   - 排除：processedSet 中的追踪号
   - 条件：updated_at < NOW()
   - remainingCount = COUNT(*)

2. 额外检查
   - 如果 totalProcessed === 0 && processedSet.size > 0
     → remainingCount = 0（强制返回 hasMore = false）
   - 如果 consecutiveNoNewItemsBatches >= 3
     → remainingCount = 0（强制返回 hasMore = false）

3. hasMore = remainingCount > 0
```

## 3. 关键变量持久化分析

### ✅ 持久化（数据库）
| 变量 | 存储位置 | 是否持久化 | 说明 |
|------|---------|-----------|------|
| `updated_at` | `post_searchs.updated_at` | ✅ 是 | 成功处理时更新为 CURRENT_TIMESTAMP |
| `states` | `post_searchs.states` | ✅ 是 | 处理成功时更新 |
| `search_num` | `post_searchs.search_num` | ✅ 是 | 主键，唯一标识 |

### ❌ 不持久化（内存）
| 变量 | 存储位置 | 是否持久化 | 进程重启影响 |
|------|---------|-----------|------------|
| `processedSet` | 内存 Set | ❌ 否 | **会丢失**，但已成功处理的追踪号的 `updated_at` 已更新，不会被再次查询 |
| `stats` | 内存对象 | ❌ 否 | **会丢失**，仅用于统计 |
| `consecutiveNoNewItemsBatches` | 内存变量 | ❌ 否 | **会丢失**，但每轮重新开始 |
| `totalProcessed` | 内存变量 | ❌ 否 | **会丢失**，仅用于统计 |
| `batchCount` | 内存变量 | ❌ 否 | **会丢失**，仅用于统计 |

## 4. 进程重启场景分析

### 场景1：成功处理的追踪号
```
处理前：updated_at = 2024-01-01 10:00:00
处理中：成功更新 states，updated_at = 2024-01-01 10:05:00（CURRENT_TIMESTAMP）
进程重启：processedSet 丢失
重启后查询：updated_at (10:05:00) >= NOW() (10:06:00) ❌ 不会被查询到
结果：✅ 正确，不会重复处理
```

### 场景2：处理失败的追踪号
```
处理前：updated_at = 2024-01-01 10:00:00
处理中：处理失败，updated_at 保持不变 = 2024-01-01 10:00:00
进程重启：processedSet 丢失
重启后查询：updated_at (10:00:00) < NOW() (10:06:00) ✅ 会被查询到
结果：✅ 正确，失败的需要重试
```

### 场景3：在 processedSet 中但未处理完
```
处理前：updated_at = 2024-01-01 10:00:00
处理中：添加到 processedSet，但处理失败，updated_at 保持不变
进程重启：processedSet 丢失
重启后查询：updated_at (10:00:00) < NOW() (10:06:00) ✅ 会被查询到
结果：✅ 正确，失败的应该重试
```

## 5. 潜在问题

### 问题1：processedSet 丢失导致重复处理？
**答案：不会**
- 成功处理的追踪号：`updated_at` 已更新，不会被查询到
- 失败的追踪号：`updated_at` 未更新，应该被重试，这是正确的行为

### 问题2：consecutiveNoNewItemsBatches 丢失？
**答案：影响有限**
- 这个计数器只在单次 `runCrawler()` 调用中有效
- 如果进程重启，会开始新的 `runCrawler()` 调用，计数器重新开始
- 但 `updated_at` 机制已经能防止重复处理

### 问题3：hasMore 判断是否准确？
**当前逻辑**：
```typescript
// 查询剩余追踪号（排除 processedSet 中的）
remainingCount = COUNT(*) WHERE updated_at < NOW() AND search_num != ALL(processedSet)

// 额外检查
if (totalProcessed === 0 && processedSet.size > 0) {
  remainingCount = 0  // 强制返回 hasMore = false
}
if (consecutiveNoNewItemsBatches >= 3) {
  remainingCount = 0  // 强制返回 hasMore = false
}
```

**潜在问题**：
- 如果 `processedSet` 很大（比如处理了1000个），但实际数据库中还有新的追踪号（`updated_at < NOW()`），`hasMore` 可能误判为 `true`
- 但这种情况应该很少，因为 `processedSet` 中的追踪号要么已经成功（`updated_at` 已更新），要么失败（`updated_at` 未更新，应该被重试）

## 6. 改进建议

### 建议1：使用数据库时间戳而不是内存 Set
**当前问题**：`processedSet` 是内存中的，进程重启会丢失

**改进方案**：不需要改进，因为：
- 成功处理的追踪号 `updated_at` 已更新，不会被再次查询
- 失败的追踪号 `updated_at` 未更新，应该被重试

### 建议2：优化 hasMore 判断
**当前问题**：需要查询数据库并排除 `processedSet`

**改进方案**：直接查询数据库，不需要排除 `processedSet`，因为：
- 成功处理的追踪号 `updated_at` 已更新，不会被查询到
- 失败的追踪号 `updated_at` 未更新，应该被查询到（用于重试）

```typescript
// 简化后的 hasMore 判断
const remainingCheck = await query<{ count: number }>(`
  SELECT COUNT(*) as count
  FROM post_searchs
  WHERE (states NOT IN ('Final delivery', 'Returned to sender') OR states IS NULL)
    AND (updated_at IS NULL OR updated_at < NOW())
`)
remainingCount = remainingCheck[0]?.count || 0
hasMore = remainingCount > 0
```

**优点**：
- 不需要维护 `processedSet`
- 不需要排除已处理的追踪号
- 更简单、更可靠
- 进程重启不影响判断

## 7. 结论

### 当前机制
- ✅ **时间判断**：使用 `NOW()` 和 `updated_at`，可靠
- ✅ **持久化**：`updated_at` 在数据库中，进程重启不影响
- ⚠️ **内存变量**：`processedSet` 等会丢失，但不影响正确性
- ⚠️ **hasMore 判断**：依赖 `processedSet`，可能可以简化

### 关键发现
1. **`processedSet` 丢失不影响正确性**：
   - 成功处理的追踪号 `updated_at` 已更新，不会被再次查询
   - 失败的追踪号 `updated_at` 未更新，应该被重试

2. **可以简化 `hasMore` 判断**：
   - 不需要排除 `processedSet` 中的追踪号
   - 直接查询 `updated_at < NOW()` 即可
   - 更简单、更可靠

3. **进程重启是安全的**：
   - 不会重复处理已成功的追踪号
   - 失败的追踪号会被正确重试

