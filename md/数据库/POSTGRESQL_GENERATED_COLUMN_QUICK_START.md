# ⚡ PostgreSQL 生成列快速开始

## 🎯 核心要点

### 你的场景的特殊性

你的 `count_down` 字段：
- ✅ 依赖于 `created_at`（创建时间）
- ✅ 依赖于 `promised_land`（方案选择）
- ❌ **依赖于 `CURRENT_TIMESTAMP`（当前时间）** ← 这是关键！

**问题**：因为依赖当前时间，值会不断变化，**不能使用 STORED 生成列**。

**解决方案**：使用**视图（View）**实现实时计算，效果相同！

---

## 🚀 快速实现（3 步）

### 步骤 1：创建视图

```sql
CREATE OR REPLACE VIEW task_with_countdown AS
SELECT 
  t.*,
  CASE 
    WHEN t.promised_land = 0 
    THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - t.created_at))::INTEGER
    ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - t.created_at))::INTEGER
  END as count_down
FROM task t;
```

### 步骤 2：修改查询代码

在 `lib/inventory-data.ts` 中，将：

```typescript
// 修改前
let sql = 'SELECT ... FROM task WHERE 1=1'

// 修改后
let sql = 'SELECT ... FROM task_with_countdown WHERE 1=1'
```

### 步骤 3：测试

```sql
-- 测试查询
SELECT * FROM task_with_countdown LIMIT 5;
```

---

## 📊 生成列 vs 视图对比

| 特性 | STORED 生成列 | 视图（你的方案） |
|------|--------------|----------------|
| **适用场景** | 确定性计算 | ✅ 动态计算（依赖时间） |
| **存储空间** | 需要存储 | ✅ 不存储 |
| **查询速度** | ⭐⭐⭐⭐⭐ 最快 | ⭐⭐⭐⭐ 快 |
| **实时性** | ❌ 需要更新 | ✅ 实时 |
| **复杂度** | ⭐⭐ 简单 | ⭐⭐ 简单 |

---

## 💡 为什么不能用 STORED 生成列？

### 示例说明

```sql
-- ❌ 这样不行（会报错或行为异常）
ALTER TABLE task 
ADD COLUMN count_down INTEGER 
GENERATED ALWAYS AS (
  CASE 
    WHEN promised_land = 0 
    THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
    ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
  END
) STORED;
```

**问题**：
- `CURRENT_TIMESTAMP` 是**非确定性**的
- 每次查询时间都不同
- STORED 生成列在插入/更新时计算一次，之后不会变化
- 但你的需求是每次查询都要最新值

**结果**：存储的值会过时，不符合需求。

---

## ✅ 视图方案的优势

### 1. 实时计算

```sql
-- 每次查询都是最新值
SELECT count_down FROM task_with_countdown WHERE id = 1;
-- 10:00 查询 → count_down = 5
-- 10:01 查询 → count_down = 5（如果时间没跨天）
-- 第二天查询 → count_down = 4（自动减少）
```

### 2. 代码简洁

```typescript
// 查询时直接使用视图，不需要手动计算
const tasks = await query('SELECT * FROM task_with_countdown')
// count_down 已经自动计算好了
```

### 3. 性能可接受

对于大多数场景（< 10000 条记录），性能影响可以忽略。

---

## 🔧 完整实现示例

### SQL 脚本

```sql
-- 1. 创建视图
CREATE OR REPLACE VIEW task_with_countdown AS
SELECT 
  id,
  ware_sku,
  inventory_num,
  sales_num,
  sale_day,
  charge,
  label,
  promised_land,
  created_at,
  updated_at,
  CASE 
    WHEN promised_land = 0 
    THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
    ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
  END as count_down
FROM task;

-- 2. 创建索引（优化性能）
CREATE INDEX IF NOT EXISTS idx_task_created_at ON task(created_at);
CREATE INDEX IF NOT EXISTS idx_task_promised_land ON task(promised_land);
```

### TypeScript 代码修改

```typescript
// lib/inventory-data.ts

// 修改 getTaskData 函数
export async function getTaskData(...) {
  try {
    // 使用视图，count_down 自动计算
    let sql = `
      SELECT 
        id, ware_sku, inventory_num, sales_num, sale_day, 
        charge, label, promised_land, count_down,
        created_at, updated_at 
      FROM task_with_countdown 
      WHERE 1=1
    `
    // ... 其他筛选逻辑
  }
}
```

---

## 🎯 什么时候用生成列？

### ✅ 适合使用 STORED 生成列的场景

```sql
-- 示例 1：计算总价（确定性）
ALTER TABLE order_items 
ADD COLUMN total_price DECIMAL 
GENERATED ALWAYS AS (quantity * unit_price) STORED;

-- 示例 2：计算全名（确定性）
ALTER TABLE users 
ADD COLUMN full_name TEXT 
GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED;

-- 示例 3：计算年龄（基于固定日期）
ALTER TABLE users 
ADD COLUMN age INTEGER 
GENERATED ALWAYS AS (
  EXTRACT(YEAR FROM AGE('2024-01-01'::DATE, birth_date))
) STORED;
```

### ❌ 不适合使用 STORED 生成列的场景

```sql
-- ❌ 依赖当前时间
GENERATED ALWAYS AS (CURRENT_TIMESTAMP - created_at) STORED;

-- ❌ 依赖随机数
GENERATED ALWAYS AS (RANDOM()) STORED;

-- ❌ 依赖其他表的数据
GENERATED ALWAYS AS (SELECT COUNT(*) FROM other_table) STORED;
```

---

## 📚 相关文档

- 详细指南：`POSTGRESQL_GENERATED_COLUMN_GUIDE.md`
- SQL 脚本：`sql/postgresql/create_task_countdown_view.sql`
- 无需 Cron 方案：`NO_CRON_SOLUTIONS.md`

---

## 🎉 总结

1. **生成列不适合你的场景**（因为依赖 `CURRENT_TIMESTAMP`）
2. **视图方案可以达到相同效果**（实时计算）
3. **实现简单**：创建视图 + 修改查询
4. **完全绕过 Vercel 限制**（不需要定时任务）

**推荐使用视图方案！** 🚀


