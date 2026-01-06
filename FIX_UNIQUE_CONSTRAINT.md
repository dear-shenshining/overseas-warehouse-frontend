# 修复 post_searchs 表唯一约束问题

## 🔍 错误信息

```
error: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

## ⚠️ 问题原因

`post_searchs` 表的 `search_num` 字段**没有唯一约束**，导致 `ON CONFLICT` 无法使用。

## ✅ 解决方案

### 方法 1：在 Neon SQL Editor 中执行（推荐）

1. 登录 Neon 控制台
2. 打开 SQL Editor
3. 执行以下 SQL：

```sql
-- 检查当前约束
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'post_searchs' 
AND constraint_type = 'UNIQUE';

-- 如果没有唯一约束，添加唯一约束
ALTER TABLE post_searchs 
ADD CONSTRAINT post_searchs_search_num_key UNIQUE (search_num);
```

### 方法 2：使用提供的 SQL 脚本

执行文件：`sql/postgresql/fix_post_searchs_unique_constraint.sql`

### 方法 3：如果表中有重复数据

如果 `search_num` 字段有重复值，需要先清理：

```sql
-- 1. 查看重复数据
SELECT search_num, COUNT(*) 
FROM post_searchs 
GROUP BY search_num 
HAVING COUNT(*) > 1;

-- 2. 删除重复数据（保留最新的）
DELETE FROM post_searchs 
WHERE id NOT IN (
    SELECT MAX(id) 
    FROM post_searchs 
    GROUP BY search_num
);

-- 3. 然后添加唯一约束
ALTER TABLE post_searchs 
ADD CONSTRAINT post_searchs_search_num_key UNIQUE (search_num);
```

## 🔍 验证

执行后，验证约束是否添加成功：

```sql
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'post_searchs' 
AND constraint_type = 'UNIQUE';
```

应该看到：
- `constraint_name`: `post_searchs_search_num_key`
- `constraint_type`: `UNIQUE`
- `table_name`: `post_searchs`

## 📝 说明

- 唯一约束确保 `search_num` 字段的值不重复
- `ON CONFLICT` 需要唯一约束才能工作
- 添加约束后，导入功能应该可以正常工作

