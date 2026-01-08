# 📖 PostgreSQL 视图方案详细指南

## 🎯 什么是数据库视图？

### 基本概念

**视图（View）** 是一个虚拟表，它基于 SQL 查询的结果集。视图本身不存储数据，而是存储查询定义。

**类比**：
- **表（Table）** = 真实的房子（存储数据）
- **视图（View）** = 房子的窗户（看到的数据，但不存储）

### 视图的特点

1. ✅ **虚拟表**：不存储数据，只存储查询定义
2. ✅ **实时计算**：每次查询时重新计算
3. ✅ **透明性**：可以像普通表一样查询
4. ✅ **安全性**：可以隐藏敏感字段或复杂逻辑

---

## 💡 为什么视图适合你的场景？

### 你的需求

```
count_down = 
  IF promised_land = 0 
  THEN 1 - (当前时间 - created_at 的天数)
  ELSE 7 - (当前时间 - created_at 的天数)
```

### 关键问题

1. **依赖当前时间**：`CURRENT_TIMESTAMP` 不断变化
2. **需要实时性**：每次查询都要最新值
3. **不能存储**：存储的值会立即过时

### 视图的优势

| 特性 | 存储列 | 视图 |
|------|--------|------|
| **实时性** | ❌ 需要定时更新 | ✅ 每次查询都最新 |
| **准确性** | ❌ 可能过时 | ✅ 总是准确 |
| **维护成本** | ❌ 需要定时任务 | ✅ 零维护 |
| **Vercel 限制** | ❌ 受 10 秒限制 | ✅ 不受限制 |

---

## 🏗️ 视图方案架构

### 架构图

```
┌─────────────────┐
│   task 表        │  (基表，存储实际数据)
│  - id            │
│  - ware_sku      │
│  - created_at    │
│  - promised_land │
│  - ...           │
└────────┬────────┘
         │
         │ 基于查询定义
         ↓
┌─────────────────┐
│ task_with_      │  (视图，虚拟表)
│ countdown        │
│  - 所有基表字段  │
│  + count_down    │  ← 实时计算
└────────┬────────┘
         │
         │ 查询时
         ↓
┌─────────────────┐
│  应用代码        │
│  SELECT * FROM   │
│  task_with_      │
│  countdown       │
└─────────────────┘
```

### 数据流

```
1. 用户访问页面
   ↓
2. 应用查询视图
   SELECT * FROM task_with_countdown
   ↓
3. PostgreSQL 执行视图定义
   - 从 task 表读取数据
   - 实时计算 count_down
   ↓
4. 返回结果（包含计算好的 count_down）
   ↓
5. 前端显示
```

---

## 📝 详细实现步骤

### 步骤 1：创建视图

#### 1.1 基础视图定义

```sql
-- 创建视图
CREATE OR REPLACE VIEW task_with_countdown AS
SELECT 
  -- 基表的所有字段
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
  -- 实时计算的 count_down
  CASE 
    WHEN promised_land = 0 
    THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
    ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
  END as count_down
FROM task;
```

#### 1.2 添加注释和说明

```sql
-- 添加视图注释
COMMENT ON VIEW task_with_countdown IS 
'任务表视图，包含实时计算的 count_down 字段。
count_down 根据 promised_land 和 created_at 自动计算：
- promised_land = 0: count_down = 1 - 天数差
- promised_land != 0: count_down = 7 - 天数差';

-- 添加字段注释
COMMENT ON COLUMN task_with_countdown.count_down IS 
'倒计时天数，实时计算，无需定时更新';
```

#### 1.3 验证视图

```sql
-- 测试查询
SELECT * FROM task_with_countdown LIMIT 5;

-- 检查视图定义
SELECT pg_get_viewdef('task_with_countdown', true);
```

---

### 步骤 2：修改应用代码

#### 2.1 修改查询函数

**文件**：`lib/inventory-data.ts`

**修改前**：
```typescript
export async function getTaskData(...) {
  try {
    // 先更新所有记录的 count_down
    await updateTaskCountDown()
    
    // 查询时计算 count_down
    let sql = `
      SELECT 
        id, ware_sku, inventory_num, sales_num, sale_day, 
        charge, label, promised_land,
        CASE 
          WHEN promised_land = 0 
          THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
          ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
        END as count_down,
        created_at, updated_at 
      FROM task 
      WHERE 1=1
    `
    // ...
  }
}
```

**修改后**：
```typescript
export async function getTaskData(...) {
  try {
    // 直接使用视图，count_down 自动计算
    let sql = `
      SELECT 
        id, ware_sku, inventory_num, sales_num, sale_day, 
        charge, label, promised_land, count_down,
        created_at, updated_at 
      FROM task_with_countdown 
      WHERE 1=1
    `
    // ... 其他筛选逻辑保持不变
  }
}
```

#### 2.2 修改统计函数

**修改前**：
```typescript
export async function getTaskStatistics(...) {
  // 超时任务统计
  let timeoutSql = `
    SELECT COUNT(*) as count 
    FROM task 
    WHERE (
      CASE 
        WHEN promised_land = 0 
        THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
        ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
      END
    ) < 0
  `
}
```

**修改后**：
```typescript
export async function getTaskStatistics(...) {
  // 超时任务统计（使用视图）
  let timeoutSql = `
    SELECT COUNT(*) as count 
    FROM task_with_countdown 
    WHERE count_down < 0
  `
}
```

#### 2.3 处理更新操作

**重要**：视图是只读的，更新操作需要针对基表：

```typescript
export async function updateTaskPromisedLand(
  wareSku: string,
  promisedLand: 0 | 1 | 2 | 3
): Promise<{ success: boolean; error?: string }> {
  try {
    // 更新基表（不是视图）
    await execute(
      `UPDATE task SET 
        promised_land = $1, 
        updated_at = CURRENT_TIMESTAMP
      WHERE ware_sku = $2`,
      [promisedLand, wareSku]
    )
    // count_down 会在下次查询视图时自动更新
    return { success: true }
  } catch (error: any) {
    console.error('更新任务方案失败:', error)
    return {
      success: false,
      error: error.message || '更新方案失败',
    }
  }
}
```

---

### 步骤 3：性能优化

#### 3.1 创建索引

```sql
-- 为基表的常用查询字段创建索引
CREATE INDEX IF NOT EXISTS idx_task_created_at 
ON task(created_at);

CREATE INDEX IF NOT EXISTS idx_task_promised_land 
ON task(promised_land);

CREATE INDEX IF NOT EXISTS idx_task_ware_sku 
ON task(ware_sku);

-- 复合索引（如果经常同时查询这两个字段）
CREATE INDEX IF NOT EXISTS idx_task_created_promised 
ON task(created_at, promised_land);
```

#### 3.2 优化视图查询

如果数据量很大，可以考虑：

```sql
-- 创建物化视图（定期刷新，适合数据变化不频繁的场景）
CREATE MATERIALIZED VIEW task_countdown_materialized AS
SELECT * FROM task_with_countdown;

-- 创建索引
CREATE INDEX ON task_countdown_materialized(count_down);
CREATE INDEX ON task_countdown_materialized(ware_sku);

-- 定期刷新（需要定时任务，不推荐）
REFRESH MATERIALIZED VIEW task_countdown_materialized;
```

**注意**：物化视图需要定时刷新，又回到了定时任务的问题，所以**不推荐**。

---

## 🔍 视图的查询优化

### PostgreSQL 查询优化器

PostgreSQL 的查询优化器会：

1. **视图展开**：将视图定义展开为实际查询
2. **查询重写**：优化查询计划
3. **索引使用**：自动使用基表的索引

### 示例：查询执行计划

```sql
-- 查看执行计划
EXPLAIN ANALYZE
SELECT * FROM task_with_countdown 
WHERE count_down < 0;

-- 优化后的查询（PostgreSQL 自动优化）
-- 实际执行：
-- SELECT ... FROM task 
-- WHERE (
--   CASE ... END
-- ) < 0
-- 可以使用 task 表的索引
```

---

## 🧪 测试和验证

### 测试 1：基本查询

```sql
-- 测试视图是否正常工作
SELECT 
  ware_sku,
  created_at,
  promised_land,
  count_down
FROM task_with_countdown
LIMIT 10;
```

### 测试 2：实时性验证

```sql
-- 1. 记录当前 count_down
SELECT ware_sku, count_down 
FROM task_with_countdown 
WHERE ware_sku = 'TEST123';

-- 2. 等待几分钟

-- 3. 再次查询，count_down 应该已更新
SELECT ware_sku, count_down 
FROM task_with_countdown 
WHERE ware_sku = 'TEST123';
```

### 测试 3：筛选功能

```sql
-- 测试超时任务筛选
SELECT COUNT(*) 
FROM task_with_countdown 
WHERE count_down < 0;

-- 测试排序
SELECT * 
FROM task_with_countdown 
ORDER BY count_down ASC 
LIMIT 10;
```

### 测试 4：更新操作

```sql
-- 更新基表
UPDATE task 
SET promised_land = 1 
WHERE ware_sku = 'TEST123';

-- 查询视图，count_down 应该自动更新
SELECT ware_sku, promised_land, count_down 
FROM task_with_countdown 
WHERE ware_sku = 'TEST123';
```

---

## 📊 性能分析

### 查询性能对比

| 操作 | 存储列 | 视图 | 差异 |
|------|--------|------|------|
| **简单查询** | ~1ms | ~2ms | +1ms（可忽略） |
| **复杂筛选** | ~5ms | ~6ms | +1ms（可忽略） |
| **大数据量** | ~50ms | ~55ms | +5ms（可接受） |

### 性能优化建议

1. **添加索引**：为 `created_at` 和 `promised_land` 创建索引
2. **限制查询范围**：使用 `WHERE` 和 `LIMIT` 减少数据量
3. **避免全表扫描**：总是使用索引字段筛选

---

## ⚠️ 注意事项和限制

### 1. 视图是只读的

```sql
-- ❌ 不能直接插入
INSERT INTO task_with_countdown VALUES (...);

-- ❌ 不能直接更新
UPDATE task_with_countdown SET count_down = 5;

-- ✅ 必须操作基表
INSERT INTO task VALUES (...);
UPDATE task SET promised_land = 1 WHERE ...;
```

### 2. 视图定义变更

如果修改了基表结构，需要重新创建视图：

```sql
-- 如果 task 表添加了新字段
ALTER TABLE task ADD COLUMN new_field TEXT;

-- 需要更新视图定义
CREATE OR REPLACE VIEW task_with_countdown AS
SELECT 
  *,
  -- count_down 计算
  CASE ... END as count_down
FROM task;
```

### 3. 性能考虑

- **小数据量**（< 1000 条）：性能影响可忽略
- **中等数据量**（1000-10000 条）：性能影响很小
- **大数据量**（> 10000 条）：考虑添加索引和优化查询

---

## 🔄 迁移步骤

### 完整迁移流程

#### 步骤 1：备份数据

```sql
-- 备份 task 表
CREATE TABLE task_backup AS SELECT * FROM task;
```

#### 步骤 2：创建视图

```sql
-- 执行视图创建脚本
\i sql/postgresql/create_task_countdown_view.sql
```

#### 步骤 3：测试视图

```sql
-- 验证视图是否正常工作
SELECT COUNT(*) FROM task_with_countdown;
SELECT * FROM task_with_countdown LIMIT 5;
```

#### 步骤 4：修改应用代码

- 修改 `getTaskData()` 函数
- 修改 `getTaskStatistics()` 函数
- 测试所有功能

#### 步骤 5：部署和验证

- 部署到生产环境
- 验证功能正常
- 监控性能

#### 步骤 6：清理（可选）

```sql
-- 如果不再需要 count_down 列，可以删除
ALTER TABLE task DROP COLUMN IF EXISTS count_down;

-- 删除不再需要的更新函数和 API 路由
-- （代码层面）
```

---

## 🎯 最佳实践

### 1. 视图命名规范

```sql
-- ✅ 好的命名
task_with_countdown
task_with_statistics
user_with_profile

-- ❌ 不好的命名
task_view
view1
temp_view
```

### 2. 添加注释

```sql
-- 总是为视图添加注释
COMMENT ON VIEW task_with_countdown IS '任务表视图，包含实时计算的倒计时';
```

### 3. 版本控制

```sql
-- 使用 CREATE OR REPLACE 支持版本更新
CREATE OR REPLACE VIEW task_with_countdown AS ...
```

### 4. 权限管理

```sql
-- 授予特定用户访问权限
GRANT SELECT ON task_with_countdown TO app_user;

-- 撤销权限
REVOKE SELECT ON task_with_countdown FROM app_user;
```

---

## 🔧 故障排查

### 问题 1：视图查询慢

**原因**：缺少索引

**解决**：
```sql
-- 检查执行计划
EXPLAIN ANALYZE SELECT * FROM task_with_countdown;

-- 添加缺失的索引
CREATE INDEX ON task(created_at);
```

### 问题 2：count_down 值不正确

**原因**：时区问题或计算逻辑错误

**解决**：
```sql
-- 检查时区设置
SHOW timezone;

-- 检查计算逻辑
SELECT 
  created_at,
  promised_land,
  CURRENT_TIMESTAMP,
  EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER as days_diff,
  count_down
FROM task_with_countdown
LIMIT 5;
```

### 问题 3：视图不存在

**原因**：视图未创建或名称错误

**解决**：
```sql
-- 检查视图是否存在
SELECT * FROM information_schema.views 
WHERE table_name = 'task_with_countdown';

-- 重新创建视图
CREATE OR REPLACE VIEW task_with_countdown AS ...;
```

---

## 📚 相关资源

- PostgreSQL 视图文档：https://www.postgresql.org/docs/current/sql-createview.html
- 查询优化：https://www.postgresql.org/docs/current/performance-tips.html
- 索引优化：https://www.postgresql.org/docs/current/indexes.html

---

## 🎉 总结

### 视图方案的优势

1. ✅ **实时性**：每次查询都是最新值
2. ✅ **零维护**：不需要定时任务
3. ✅ **绕过限制**：完全不受 Vercel 限制
4. ✅ **代码简洁**：查询逻辑集中
5. ✅ **性能可接受**：对于大多数场景

### 适用场景

- ✅ 需要实时计算的字段
- ✅ 依赖当前时间的计算
- ✅ 复杂的计算逻辑
- ✅ 需要隐藏实现细节

### 不适用场景

- ❌ 需要存储历史值
- ❌ 数据量极大且需要极致性能
- ❌ 需要物化视图（需要定时刷新）

**视图方案是你的最佳选择！** 🚀

