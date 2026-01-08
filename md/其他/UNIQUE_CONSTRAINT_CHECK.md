# 唯一约束检查报告

## 📋 检查结果

### 使用 ON CONFLICT 的表

| 表名 | 字段 | 唯一约束状态 | 代码中使用 |
|------|------|------------|-----------|
| **post_searchs** | `search_num` | ❌ **缺少** | `lib/logistics-import.ts` |
| **inventory** | `ware_sku` | ✅ 已定义 | `lib/inventory-data.ts` |
| **task** | `ware_sku` | ✅ 已定义 | `lib/inventory-data.ts` |
| **task_history** | - | ✅ 不需要 | 允许重复 |
| **per_charge** | - | ✅ 不需要 | 未使用 ON CONFLICT |

## ⚠️ 问题表

### 1. post_searchs 表 ❌

**问题：** `search_num` 字段缺少唯一约束

**影响：** 
- `lib/logistics-import.ts` 中的 `ON CONFLICT (search_num)` 无法工作
- 导入功能会失败

**修复：** 执行 `sql/postgresql/fix_post_searchs_unique_constraint.sql`

### 2. inventory 表 ✅

**状态：** `ware_sku` 字段有 `UNIQUE` 约束（建表脚本中已定义）

**代码使用：** `lib/inventory-data.ts` 第 329 行
```typescript
ON CONFLICT (ware_sku) DO UPDATE SET
```

**检查：** 如果表已存在但约束未创建，需要添加

### 3. task 表 ✅

**状态：** `ware_sku` 字段有 `UNIQUE` 约束（建表脚本中已定义）

**代码使用：** `lib/inventory-data.ts` 第 390 行
```typescript
ON CONFLICT (ware_sku) DO UPDATE SET
```

**检查：** 如果表已存在但约束未创建，需要添加

## 🔍 检查方法

### 在 Neon SQL Editor 中执行

```sql
-- 检查所有表的唯一约束
SELECT 
    tc.table_name,
    tc.constraint_name,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
AND tc.constraint_type = 'UNIQUE'
AND tc.table_name IN ('post_searchs', 'inventory', 'task')
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name, tc.constraint_name;
```

### 或执行检查脚本

执行文件：`sql/postgresql/check_all_unique_constraints.sql`

## ✅ 修复方法

### 方法 1：执行修复脚本（推荐）

执行文件：`sql/postgresql/fix_all_unique_constraints.sql`

这个脚本会：
1. 检查每个表是否有重复数据
2. 如果有重复数据，先清理（保留最新的）
3. 添加缺失的唯一约束
4. 验证约束是否添加成功

### 方法 2：手动修复

#### 修复 post_searchs 表

```sql
-- 1. 检查重复数据
SELECT search_num, COUNT(*) 
FROM post_searchs 
GROUP BY search_num 
HAVING COUNT(*) > 1;

-- 2. 如果有重复，先清理
DELETE FROM post_searchs 
WHERE id NOT IN (
    SELECT MAX(id) 
    FROM post_searchs 
    GROUP BY search_num
);

-- 3. 添加唯一约束
ALTER TABLE post_searchs 
ADD CONSTRAINT post_searchs_search_num_key UNIQUE (search_num);
```

#### 修复 inventory 表（如果需要）

```sql
-- 检查约束是否存在
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'inventory' 
AND constraint_type = 'UNIQUE'
AND constraint_name LIKE '%ware_sku%';

-- 如果不存在，添加约束
ALTER TABLE inventory 
ADD CONSTRAINT inventory_ware_sku_key UNIQUE (ware_sku);
```

#### 修复 task 表（如果需要）

```sql
-- 检查约束是否存在
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'task' 
AND constraint_type = 'UNIQUE'
AND constraint_name LIKE '%ware_sku%';

-- 如果不存在，添加约束
ALTER TABLE task 
ADD CONSTRAINT task_ware_sku_key UNIQUE (ware_sku);
```

## 📝 总结

**必须修复：**
- ✅ `post_searchs.search_num` - **必须添加唯一约束**

**建议检查：**
- ⚠️ `inventory.ware_sku` - 如果表已存在，检查约束是否存在
- ⚠️ `task.ware_sku` - 如果表已存在，检查约束是否存在

**不需要：**
- ✅ `task_history` - 允许重复，不需要唯一约束

## 🚀 快速修复

执行以下 SQL 一次性修复所有问题：

```sql
-- 执行修复脚本
\i sql/postgresql/fix_all_unique_constraints.sql
```

或直接在 Neon SQL Editor 中执行 `sql/postgresql/fix_all_unique_constraints.sql` 的内容。

