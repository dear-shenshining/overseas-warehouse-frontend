# 导入功能性能问题分析

## 🔍 问题发现

导入功能运行很久的原因：**每条记录执行了 2 次数据库查询**

### 当前代码逻辑（lib/logistics-import.ts 第 157-192 行）

```typescript
for (const item of orderData) {
  try {
    // ❌ 问题1：先执行 SELECT 查询检查记录是否存在
    const existing = await query<{ id: number }>(
      'SELECT id FROM post_searchs WHERE search_num = $1',
      [item.shipping_num]
    )

    // ❌ 问题2：然后执行 INSERT ... ON CONFLICT
    const sql = `
      INSERT INTO post_searchs (search_num, Ship_date, channel)
      VALUES ($1, $2, $3)
      ON CONFLICT (search_num) 
      DO UPDATE SET ...
    `
    await execute(sql, [...])

    // 根据 existing 判断是插入还是更新
    if (existing.length > 0) {
      updated++
    } else {
      inserted++
    }
  } catch (error) {
    skipped++
  }
}
```

## ⚠️ 性能问题

### 1. 双重查询问题

- **每条记录执行 2 次数据库查询**：
  - 1 次 SELECT（检查是否存在）
  - 1 次 INSERT ... ON CONFLICT（插入或更新）

- **如果 Excel 有 1000 条记录**：
  - 需要执行 **2000 次数据库查询**
  - 每次查询都有网络延迟（Neon 是云端数据库）
  - 总耗时 = 2000 × (网络延迟 + 数据库处理时间)

### 2. 不必要的 SELECT 查询

- `ON CONFLICT` 已经可以自动处理冲突
- 不需要先查询是否存在
- SELECT 查询是多余的

### 3. 逐条处理

- 每条记录单独处理，没有批量操作
- 无法利用数据库的批量插入优化

## 📊 性能估算

假设：
- 每条记录：SELECT (50ms) + INSERT (50ms) = 100ms
- 1000 条记录：1000 × 100ms = **100 秒**（约 1.7 分钟）
- 5000 条记录：5000 × 100ms = **500 秒**（约 8.3 分钟）

如果网络延迟更高，时间会更长。

## ✅ 优化方案（暂不实施，仅分析）

### 方案 1：移除多余的 SELECT 查询

```typescript
for (const item of orderData) {
  try {
    // 直接执行 INSERT ... ON CONFLICT，不需要先查询
    const sql = `
      INSERT INTO post_searchs (search_num, Ship_date, channel)
      VALUES ($1, $2, $3)
      ON CONFLICT (search_num) 
      DO UPDATE SET
        Ship_date = EXCLUDED.Ship_date,
        channel = EXCLUDED.channel,
        updated_at = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS inserted  -- 判断是插入还是更新
    `
    
    const result = await query(sql, [...])
    if (result[0]?.inserted) {
      inserted++
    } else {
      updated++
    }
  } catch (error) {
    skipped++
  }
}
```

**性能提升**：减少 50% 的数据库查询

### 方案 2：批量插入（最佳方案）

```typescript
// 使用 PostgreSQL 的批量插入
const values = orderData.map((item, index) => 
  `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`
).join(',')

const params = orderData.flatMap(item => [
  item.shipping_num,
  item.ship_date,
  item.channel
])

const sql = `
  INSERT INTO post_searchs (search_num, Ship_date, channel)
  VALUES ${values}
  ON CONFLICT (search_num) 
  DO UPDATE SET
    Ship_date = EXCLUDED.Ship_date,
    channel = EXCLUDED.channel,
    updated_at = CURRENT_TIMESTAMP
`

await execute(sql, params)
```

**性能提升**：
- 1000 条记录：从 2000 次查询 → 1 次查询
- 性能提升：**2000 倍**

## 🎯 当前状态

- ✅ 功能正常，没有错误
- ⚠️ 性能较慢，因为每条记录执行 2 次查询
- ⏳ 如果数据量大，需要等待较长时间

## 💡 建议

1. **如果数据量小（< 100 条）**：可以等待完成
2. **如果数据量大（> 1000 条）**：建议优化代码后再导入
3. **临时方案**：可以分批导入，每次导入 100-200 条

## 📝 总结

**问题根源**：每条记录执行了 2 次数据库查询（SELECT + INSERT），导致性能慢。

**解决方案**：
1. 移除多余的 SELECT 查询（简单，提升 50%）
2. 使用批量插入（复杂，提升 2000 倍）

**当前状态**：功能正常，只是慢，可以等待完成。

