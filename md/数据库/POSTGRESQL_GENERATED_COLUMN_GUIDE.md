# 📚 PostgreSQL 生成列（Generated Column）详细指南

## 🎯 什么是生成列？

**生成列（Generated Column）** 是 PostgreSQL 12+ 引入的功能，允许你定义一个列的值由其他列自动计算得出。

### 基本概念

生成列有两种类型：
1. **STORED（存储型）**：值计算后存储在磁盘上
2. **VIRTUAL（虚拟型）**：值在查询时实时计算（PostgreSQL 目前不支持，但可以通过函数实现类似效果）

---

## 📖 语法说明

### 基本语法

```sql
ALTER TABLE table_name 
ADD COLUMN column_name data_type 
GENERATED ALWAYS AS (expression) STORED;
```

### 参数说明

- `GENERATED ALWAYS AS`：表示这个列总是由表达式生成
- `(expression)`：计算表达式，可以使用同一行的其他列
- `STORED`：将计算结果存储在磁盘上（推荐，性能好）
- `VIRTUAL`：PostgreSQL 目前不支持，但可以通过视图实现

---

## 💡 在你的项目中的应用

### 当前问题

你的 `count_down` 字段需要根据 `created_at` 和 `promised_land` 计算：

```sql
-- 当前的计算逻辑
CASE 
  WHEN promised_land = 0 
  THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
  ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
END
```

### 使用生成列的解决方案

```sql
-- 添加生成列
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

**⚠️ 注意**：上面的例子有个问题！`CURRENT_TIMESTAMP` 是动态的，每次查询都会变化，不适合用于 STORED 生成列。

---

## ⚠️ 重要限制

### 1. 表达式限制

生成列的表达式必须是：
- ✅ **确定性（Deterministic）**：相同输入总是产生相同输出
- ❌ **不能使用**：`CURRENT_TIMESTAMP`、`NOW()`、`RANDOM()` 等非确定性函数
- ❌ **不能引用**：其他表的数据
- ❌ **不能使用**：子查询（某些情况下）

### 2. 你的场景的特殊性

你的 `count_down` 依赖于 `CURRENT_TIMESTAMP`，这是**非确定性的**，因为时间在不断变化。

**解决方案**：使用**函数生成列**或**触发器**来实现动态计算。

---

## 🔧 实际实现方案

### 方案 A：使用函数 + 视图（推荐）

由于 `count_down` 依赖于当前时间，不能直接使用 STORED 生成列，可以使用**视图**：

```sql
-- 创建视图，包含实时计算的 count_down
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
  -- 实时计算 count_down
  CASE 
    WHEN promised_land = 0 
    THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
    ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
  END as count_down
FROM task;
```

**使用视图查询**：
```sql
-- 查询时使用视图
SELECT * FROM task_with_countdown WHERE count_down < 0;
```

**优点**：
- ✅ 实时计算，总是最新值
- ✅ 查询简单，就像普通表
- ✅ 可以创建索引（在某些情况下）

**缺点**：
- ⚠️ 每次查询都需要计算
- ⚠️ 不能直接更新视图（需要更新基表）

---

### 方案 B：使用函数生成列（PostgreSQL 12+）

创建一个函数来计算 `count_down`：

```sql
-- 创建计算函数
CREATE OR REPLACE FUNCTION calculate_count_down(
  created_at TIMESTAMP,
  promised_land INTEGER
) RETURNS INTEGER AS $$
BEGIN
  RETURN CASE 
    WHEN promised_land = 0 
    THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
    ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;  -- ⚠️ 注意：这里不能用 IMMUTABLE，因为依赖 CURRENT_TIMESTAMP
```

**修正**：由于依赖 `CURRENT_TIMESTAMP`，函数不能是 `IMMUTABLE`：

```sql
-- 正确的函数定义
CREATE OR REPLACE FUNCTION calculate_count_down(
  created_at TIMESTAMP,
  promised_land INTEGER
) RETURNS INTEGER AS $$
BEGIN
  RETURN CASE 
    WHEN promised_land = 0 
    THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
    ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
  END;
END;
$$ LANGUAGE plpgsql STABLE;  -- STABLE 表示函数在事务内是稳定的
```

**使用函数**：
```sql
-- 在查询中使用
SELECT 
  *,
  calculate_count_down(created_at, promised_land) as count_down
FROM task;
```

---

### 方案 C：使用触发器自动更新（传统方案）

虽然这不是生成列，但可以实现类似的效果：

```sql
-- 创建更新函数
CREATE OR REPLACE FUNCTION update_count_down()
RETURNS TRIGGER AS $$
BEGIN
  NEW.count_down = CASE 
    WHEN NEW.promised_land = 0 
    THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - NEW.created_at))::INTEGER
    ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - NEW.created_at))::INTEGER
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER task_count_down_trigger
BEFORE INSERT OR UPDATE ON task
FOR EACH ROW
EXECUTE FUNCTION update_count_down();
```

**优点**：
- ✅ 自动更新，无需手动计算
- ✅ 数据存储在表中，查询快

**缺点**：
- ⚠️ 仍然需要定时更新（因为时间在变化）
- ⚠️ 不能完全解决你的问题

---

## 🎯 最适合你项目的方案

### 推荐：方案 A（视图）+ 查询时计算

**原因**：
1. ✅ `count_down` 依赖于当前时间，必须实时计算
2. ✅ 视图可以封装计算逻辑，代码更简洁
3. ✅ 不需要定时更新，完全绕过 Vercel 限制
4. ✅ 性能可接受（对于大多数场景）

### 实现步骤

#### 步骤 1：创建视图

```sql
-- 创建视图
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

#### 步骤 2：修改查询代码

```typescript
// lib/inventory-data.ts

// 修改前
let sql = 'SELECT ... FROM task WHERE 1=1'

// 修改后
let sql = 'SELECT ... FROM task_with_countdown WHERE 1=1'
```

#### 步骤 3：处理更新操作

视图不能直接更新，需要更新基表：

```typescript
// 更新 promised_land 时，仍然更新 task 表
await execute(
  `UPDATE task SET 
    promised_land = $1, 
    updated_at = CURRENT_TIMESTAMP
  WHERE ware_sku = $2`,
  [promisedLand, wareSku]
)

// 查询时使用视图，会自动包含最新的 count_down
```

---

## 📊 性能对比

| 方案 | 查询速度 | 存储空间 | 实时性 | 复杂度 |
|------|---------|---------|--------|--------|
| **存储 count_down** | ⭐⭐⭐⭐⭐ 最快 | ⭐⭐ 需要存储 | ❌ 需要定时更新 | ⭐⭐⭐ 中等 |
| **查询时计算** | ⭐⭐⭐⭐ 快 | ⭐⭐⭐⭐⭐ 不存储 | ✅ 实时 | ⭐⭐ 简单 |
| **视图** | ⭐⭐⭐⭐ 快 | ⭐⭐⭐⭐⭐ 不存储 | ✅ 实时 | ⭐⭐ 简单 |
| **函数** | ⭐⭐⭐ 中等 | ⭐⭐⭐⭐⭐ 不存储 | ✅ 实时 | ⭐⭐⭐ 中等 |

---

## 🔍 高级用法

### 1. 在生成列上创建索引

对于 STORED 生成列，可以创建索引：

```sql
-- 如果 count_down 是 STORED 生成列
CREATE INDEX idx_task_count_down ON task(count_down);
```

**注意**：对于依赖 `CURRENT_TIMESTAMP` 的列，不能创建有效索引，因为值在不断变化。

### 2. 部分索引

可以创建部分索引来优化特定查询：

```sql
-- 只索引超时任务（count_down < 0）
CREATE INDEX idx_task_timeout ON task(created_at, promised_land)
WHERE (CASE 
  WHEN promised_land = 0 
  THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
  ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
END) < 0;
```

### 3. 表达式索引

```sql
-- 为计算表达式创建索引（提升查询性能）
CREATE INDEX idx_task_count_down_expr ON task(
  (CASE 
    WHEN promised_land = 0 
    THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
    ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
  END)
);
```

**⚠️ 注意**：由于表达式包含 `CURRENT_TIMESTAMP`，索引可能不会按预期工作。

---

## 🧪 测试示例

### 测试生成列

```sql
-- 1. 创建测试表
CREATE TABLE test_task (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  promised_land INTEGER DEFAULT 0
);

-- 2. 添加生成列（示例：计算天数差）
ALTER TABLE test_task
ADD COLUMN days_since_creation INTEGER
GENERATED ALWAYS AS (
  EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
) STORED;

-- 3. 插入测试数据
INSERT INTO test_task (created_at, promised_land) 
VALUES 
  (CURRENT_TIMESTAMP - INTERVAL '5 days', 0),
  (CURRENT_TIMESTAMP - INTERVAL '10 days', 1);

-- 4. 查询
SELECT * FROM test_task;
-- days_since_creation 会自动计算
```

---

## ⚠️ 注意事项

### 1. 版本要求

- ✅ PostgreSQL 12+：支持 STORED 生成列
- ❌ PostgreSQL < 12：不支持生成列，需要使用视图或函数

### 2. 性能考虑

- **STORED 生成列**：计算一次，存储后查询快
- **视图/函数**：每次查询都计算，但通常性能可接受

### 3. 数据一致性

- 生成列的值由表达式保证，不会出现不一致
- 但依赖 `CURRENT_TIMESTAMP` 的列会随时间变化

### 4. 迁移建议

如果要从存储列迁移到生成列：

```sql
-- 1. 备份数据
CREATE TABLE task_backup AS SELECT * FROM task;

-- 2. 删除旧列
ALTER TABLE task DROP COLUMN IF EXISTS count_down;

-- 3. 添加生成列（如果可能）或创建视图
-- 对于你的场景，建议创建视图
CREATE OR REPLACE VIEW task_with_countdown AS ...;

-- 4. 测试查询
SELECT * FROM task_with_countdown LIMIT 10;

-- 5. 如果一切正常，可以删除备份
DROP TABLE task_backup;
```

---

## 📚 相关资源

- [PostgreSQL 官方文档 - 生成列](https://www.postgresql.org/docs/current/ddl-generated-columns.html)
- [PostgreSQL 视图文档](https://www.postgresql.org/docs/current/sql-createview.html)
- [PostgreSQL 函数文档](https://www.postgresql.org/docs/current/sql-createfunction.html)

---

## 🎯 总结

对于你的项目：

1. **最佳方案**：使用**视图**封装计算逻辑
   - ✅ 实时计算，无需定时更新
   - ✅ 代码简洁，查询方便
   - ✅ 完全绕过 Vercel 限制

2. **如果数据量很大**：考虑添加表达式索引优化查询

3. **如果 PostgreSQL < 12**：使用视图或函数，效果相同

**生成列不适合你的场景**，因为 `count_down` 依赖于 `CURRENT_TIMESTAMP`，但**视图方案可以达到相同的效果**！


