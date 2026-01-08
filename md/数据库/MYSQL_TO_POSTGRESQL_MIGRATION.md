# MySQL 到 PostgreSQL 数据迁移指南

## 📋 概述

你的 `seas_ware` 数据库在 MySQL 中，现在需要迁移到 PostgreSQL。数据可以复用，但需要转换格式。

---

## 🔍 表结构对比

### 主要差异

| MySQL | PostgreSQL | 说明 |
|-------|------------|------|
| `INT AUTO_INCREMENT` | `SERIAL` | 自增主键 |
| `DATETIME` | `TIMESTAMP` | 日期时间 |
| `DATE` | `TIMESTAMP` | 日期（post_searchs.Ship_date） |
| `JSON` | `JSONB` | JSON 数据 |
| `ON UPDATE CURRENT_TIMESTAMP` | 触发器 | 自动更新时间 |

### 字段兼容性

✅ **完全兼容的字段：**
- `VARCHAR` → `VARCHAR`
- `INT` → `INTEGER`
- 数据内容无需转换

⚠️ **需要转换的字段：**
- `JSON` → `JSONB`（格式相同，但类型不同）
- `DATE` → `TIMESTAMP`（post_searchs.Ship_date）

---

## 🚀 迁移方法

### 方法 1：使用 pgLoader（推荐）

`pgLoader` 是专门用于从 MySQL 迁移到 PostgreSQL 的工具。

#### 1. 安装 pgLoader

**Windows:**
```cmd
# 使用 Chocolatey
choco install pgloader

# 或下载安装包
# https://github.com/dimitri/pgloader/releases
```

**或使用 Docker:**
```cmd
docker pull dimitri/pgloader
```

#### 2. 创建迁移脚本

创建文件 `migrate.load`：

```sql
LOAD DATABASE
    FROM mysql://root:你的MySQL密码@localhost/seas_ware
    INTO postgresql://postgres:你的PostgreSQL密码@localhost/seas_ware

WITH
    include drop, create tables, create indexes, reset sequences

SET
    maintenance_work_mem to '512MB',
    work_mem to '512MB'

CAST
    type datetime to timestamp,
    type date to timestamp,
    type json to jsonb

ALTER TABLE NAMES MATCHING ~/.*/,
    EXCLUDING TABLE NAMES MATCHING '~^pg_', '~^sql_'
;
```

#### 3. 执行迁移

```cmd
# 使用 pgLoader
pgloader migrate.load

# 或使用 Docker
docker run --rm -v %cd%:/data dimitri/pgloader pgloader /data/migrate.load
```

---

### 方法 2：手动导出导入（适合小数据量）

#### 步骤 1：从 MySQL 导出数据

```cmd
# 导出 inventory 表
mysqldump -u root -p seas_ware inventory --no-create-info --skip-triggers > inventory_data.sql

# 导出 post_searchs 表
mysqldump -u root -p seas_ware post_searchs --no-create-info --skip-triggers > post_searchs_data.sql

# 导出 task 表（如果存在）
mysqldump -u root -p seas_ware task --no-create-info --skip-triggers > task_data.sql

# 导出 task_history 表（如果存在）
mysqldump -u root -p seas_ware task_history --no-create-info --skip-triggers > task_history_data.sql
```

#### 步骤 2：转换 SQL 格式

需要将 MySQL 的 SQL 格式转换为 PostgreSQL 格式：

**主要转换：**
- 移除反引号 `` ` ``
- `NULL` 值处理
- 日期格式转换

#### 步骤 3：在 PostgreSQL 中创建表

```cmd
# 执行 PostgreSQL 建表脚本
psql -U postgres -d seas_ware -f sql/postgresql/create_inventory_table.sql
psql -U postgres -d seas_ware -f sql/postgresql/create_post_searchs_table.sql
psql -U postgres -d seas_ware -f sql/postgresql/create_task_table.sql
psql -U postgres -d seas_ware -f sql/postgresql/create_task_history_table.sql
```

#### 步骤 4：导入数据

使用 `COPY` 命令或 `INSERT` 语句导入数据。

---

### 方法 3：使用 CSV 导出导入（最简单）

#### 步骤 1：从 MySQL 导出为 CSV

```sql
-- 在 MySQL 中执行
USE seas_ware;

-- 导出 inventory
SELECT * FROM inventory 
INTO OUTFILE 'C:/temp/inventory.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n';

-- 导出 post_searchs
SELECT * FROM post_searchs 
INTO OUTFILE 'C:/temp/post_searchs.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n';
```

#### 步骤 2：在 PostgreSQL 中创建表

```cmd
psql -U postgres -d seas_ware -f sql/postgresql/create_inventory_table.sql
psql -U postgres -d seas_ware -f sql/postgresql/create_post_searchs_table.sql
```

#### 步骤 3：导入 CSV 到 PostgreSQL

```sql
-- 在 PostgreSQL 中执行
\copy inventory FROM 'C:/temp/inventory.csv' WITH (FORMAT csv, HEADER true, DELIMITER ',');

\copy post_searchs FROM 'C:/temp/post_searchs.csv' WITH (FORMAT csv, HEADER true, DELIMITER ',');
```

---

## ⚠️ 注意事项

### 1. ID 自增问题

迁移后，PostgreSQL 的 `SERIAL` 序列可能不会从正确的值开始。

**解决方法：**
```sql
-- 在 PostgreSQL 中执行
SELECT setval('inventory_id_seq', (SELECT MAX(id) FROM inventory));
SELECT setval('post_searchs_id_seq', (SELECT MAX(id) FROM post_searchs));
```

### 2. JSON 字段

MySQL 的 `JSON` 和 PostgreSQL 的 `JSONB` 格式相同，但需要确保：
- JSON 格式有效
- 空值处理正确

### 3. 日期字段

`post_searchs.Ship_date` 在 MySQL 中是 `DATE`，在 PostgreSQL 中是 `TIMESTAMP`。

迁移时会自动转换，但需要注意：
- `NULL` 值保持不变
- 日期格式：`YYYY-MM-DD` → `YYYY-MM-DD 00:00:00`

### 4. 字符编码

确保使用 UTF-8 编码，避免中文乱码。

---

## ✅ 迁移后验证

### 1. 检查数据量

```sql
-- 在 PostgreSQL 中执行
SELECT COUNT(*) FROM inventory;
SELECT COUNT(*) FROM post_searchs;
SELECT COUNT(*) FROM task;
SELECT COUNT(*) FROM task_history;
```

### 2. 检查数据完整性

```sql
-- 检查是否有 NULL 值问题
SELECT COUNT(*) FROM inventory WHERE ware_sku IS NULL;

-- 检查 JSON 字段
SELECT COUNT(*) FROM inventory WHERE label IS NOT NULL;

-- 检查日期字段
SELECT COUNT(*) FROM post_searchs WHERE Ship_date IS NOT NULL;
```

### 3. 测试应用功能

- 启动应用
- 测试数据查询
- 测试数据导入
- 测试数据更新

---

## 🆘 如果遇到问题

### 问题 1：字符编码错误

**解决：**
```sql
-- 在 PostgreSQL 中设置编码
SET client_encoding = 'UTF8';
```

### 问题 2：日期格式错误

**解决：**
```sql
-- 转换日期格式
UPDATE post_searchs 
SET Ship_date = Ship_date::timestamp 
WHERE Ship_date IS NOT NULL;
```

### 问题 3：JSON 解析错误

**解决：**
```sql
-- 清理无效的 JSON
UPDATE inventory 
SET label = NULL 
WHERE label IS NOT NULL 
AND label::text NOT LIKE '[%' 
AND label::text NOT LIKE '{%';
```

---

## 📝 快速迁移脚本

我为你准备了一个简化的迁移脚本，你可以根据实际情况调整。

**建议：**
1. 先备份 MySQL 数据
2. 在 PostgreSQL 中创建新数据库
3. 执行建表脚本
4. 使用 pgLoader 或 CSV 方法迁移数据
5. 验证数据完整性

---

## 🎯 推荐方案

**对于你的情况，我推荐：**

1. **如果数据量不大（< 10万条）**：使用方法 3（CSV 导出导入）
2. **如果数据量较大**：使用方法 1（pgLoader）
3. **如果需要精确控制**：使用方法 2（手动导出导入）

需要我帮你准备具体的迁移脚本吗？

