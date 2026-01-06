# Python vs TypeScript 导入功能对比分析

## 🔍 关键差异

### 1. 表名大小写问题 ⚠️

**Python 脚本（MySQL）：**
```python
INSERT INTO Post_searchs (search_num, Ship_date, channel)
```

**TypeScript 代码（PostgreSQL）：**
```typescript
INSERT INTO post_searchs (search_num, Ship_date, channel)
```

**问题：**
- MySQL 不区分表名大小写（默认）
- PostgreSQL **区分大小写**（如果表名用双引号创建）
- 如果原来的表是 `Post_searchs`，迁移后可能还是 `Post_searchs`

### 2. 字段名大小写问题 ⚠️

**字段名：`Ship_date`（大写 S）**
- PostgreSQL 中，如果字段名包含大写字母，需要用双引号：`"Ship_date"`
- 或者确保表结构中的字段名是小写

### 3. 数据库语法差异

**MySQL：**
```sql
INSERT INTO Post_searchs (search_num, Ship_date, channel)
VALUES (%s, %s, %s)
ON DUPLICATE KEY UPDATE
    Ship_date = VALUES(Ship_date),
    channel = VALUES(channel)
```

**PostgreSQL：**
```sql
INSERT INTO post_searchs (search_num, Ship_date, channel)
VALUES ($1, $2, $3)
ON CONFLICT (search_num) 
DO UPDATE SET
    Ship_date = EXCLUDED.Ship_date,
    channel = EXCLUDED.channel
```

### 4. 逐条 vs 批量处理

**Python 脚本：**
- 逐条处理（每条记录一次数据库查询）
- 使用事务（`conn.commit()`）
- 简单直接，但性能较慢

**TypeScript 代码：**
- 尝试批量处理（每批 500-1000 条）
- 使用事务
- 性能更好，但可能因为参数绑定问题失败

## 🐛 可能的问题

### 问题 1：表名不存在
- 如果数据库中的表名是 `Post_searchs`（大写），但代码中使用 `post_searchs`（小写）
- PostgreSQL 会报错：`relation "post_searchs" does not exist`

### 问题 2：字段名大小写
- 如果字段名是 `Ship_date`（大写 S），需要用双引号：`"Ship_date"`
- 或者确保表结构中的字段名是小写：`ship_date`

### 问题 3：批量插入参数绑定
- 批量插入时，参数索引可能计算错误
- 导致 SQL 语法错误

## ✅ 解决方案

### 方案 1：检查实际表名和字段名

在 PostgreSQL 中执行：
```sql
-- 查看所有表名
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- 查看 post_searchs 表的字段名
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'post_searchs' OR table_name = 'Post_searchs';
```

### 方案 2：统一使用小写（推荐）

1. 确保表名是小写：`post_searchs`
2. 确保字段名是小写：`ship_date`（或使用双引号 `"Ship_date"`）
3. 更新所有 SQL 语句使用小写

### 方案 3：使用双引号（如果必须保持大小写）

```sql
INSERT INTO "Post_searchs" ("search_num", "Ship_date", "channel")
VALUES ($1, $2, $3)
ON CONFLICT ("search_num") 
DO UPDATE SET
    "Ship_date" = EXCLUDED."Ship_date",
    "channel" = EXCLUDED."channel"
```

## 📝 建议

1. **先检查数据库中的实际表名和字段名**
2. **统一使用小写**（PostgreSQL 最佳实践）
3. **如果必须保持大小写，使用双引号**
4. **简化批量插入逻辑**，先确保逐条插入能工作

