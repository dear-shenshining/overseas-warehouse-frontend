# 修复字段名大小写问题

## 🔍 问题

错误：`column "Ship_date" of relation "post_searchs" does not exist`

## ⚠️ 原因

PostgreSQL **默认会将字段名转换为小写**，除非用双引号创建。

- 建表脚本中使用 `Ship_date`（没有双引号）→ PostgreSQL 转换为 `ship_date`（小写）
- 代码中使用 `"Ship_date"`（带双引号）→ 查找 `Ship_date`（大写）→ **找不到**

## ✅ 解决方案

### 方法 1：在数据库中修复字段名（如果表已存在）

在 Neon SQL Editor 中执行：

```sql
-- 如果字段名是 Ship_date（大写），重命名为 ship_date（小写）
ALTER TABLE post_searchs RENAME COLUMN "Ship_date" TO ship_date;

-- 或者如果字段不存在，添加字段
ALTER TABLE post_searchs ADD COLUMN ship_date TIMESTAMP DEFAULT NULL;
```

### 方法 2：执行修复脚本

执行文件：`sql/postgresql/fix_ship_date_column_name.sql`

### 方法 3：重新创建表（如果数据不重要）

```sql
-- 删除旧表（注意：会丢失数据）
DROP TABLE IF EXISTS post_searchs CASCADE;

-- 重新创建表（使用小写字段名）
-- 执行：sql/postgresql/create_post_searchs_table.sql
```

## 📝 已修复的代码

### 1. 建表脚本
- ✅ `sql/postgresql/create_post_searchs_table.sql` - 使用 `ship_date`（小写）
- ✅ `sql/postgresql/create_all_tables.sql` - 使用 `ship_date`（小写）

### 2. 代码文件
- ✅ `lib/logistics-import.ts` - 使用 `ship_date`（小写）
- ✅ `lib/logistics-data.ts` - 使用 `ship_date as "Ship_date"`（查询时使用别名保持接口兼容）

## 🔍 验证

执行后，验证字段名：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'post_searchs'
ORDER BY column_name;
```

应该看到：
- `ship_date`（小写），而不是 `Ship_date`

## 📋 总结

**问题根源：** PostgreSQL 字段名大小写处理与 MySQL 不同

**解决方案：** 
1. 统一使用小写字段名（PostgreSQL 最佳实践）
2. 在查询时使用别名保持接口兼容性

**下一步：** 
1. 在数据库中修复字段名（执行修复脚本）
2. 重新测试导入功能

