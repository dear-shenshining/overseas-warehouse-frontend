# PostgreSQL 建表完整指南

## 📋 概述

本指南将帮助你在 PostgreSQL（Neon）中创建所有数据库表，基于你原来的 MySQL 数据库结构。

---

## 🗂️ 需要创建的表

根据你的 MySQL 数据库，需要创建以下表：

1. **inventory** - 库存表
2. **task** - 任务表（包含 promised_land 和 count_down 字段）
3. **task_history** - 历史任务表
4. **post_searchs** - 物流查询表
5. **per_charge** - SKU负责人映射表（可选）

---

## 🚀 方法 1：使用 Neon SQL Editor（推荐）

### 步骤 1：登录 Neon 控制台

1. 访问：https://console.neon.tech
2. 登录你的账号
3. 选择你的项目

### 步骤 2：打开 SQL Editor

1. 在项目页面，点击 **"SQL Editor"** 或 **"SQL 编辑器"**
2. 会打开一个 SQL 编辑窗口

### 步骤 3：执行建表脚本

1. 打开项目中的文件：`sql/postgresql/create_all_tables.sql`
2. **复制整个文件的内容**
3. 粘贴到 Neon SQL Editor 中
4. 点击 **"Run"** 或 **"执行"** 按钮

### 步骤 4：验证建表成功

在 SQL Editor 中执行：

```sql
-- 查看所有表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 应该看到：
-- inventory
-- per_charge
-- post_searchs
-- task
-- task_history
```

---

## 🚀 方法 2：使用命令行（如果有 psql）

### 步骤 1：连接到 Neon

```cmd
psql "postgresql://neondb_owner:npg_TgJB3fG0UoHn@ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

### 步骤 2：执行建表脚本

```sql
-- 在 psql 中执行
\i sql/postgresql/create_all_tables.sql

-- 或者直接复制粘贴脚本内容
```

### 步骤 3：验证

```sql
\dt
-- 应该看到所有表
```

---

## 📝 表结构说明

### 1. inventory（库存表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 自增主键 |
| ware_sku | VARCHAR(255) | 马帮SKU（唯一） |
| inventory_num | INTEGER | 库存数量 |
| sales_num | INTEGER | 最近7天销量 |
| sale_day | INTEGER | 销售天数 |
| charge | VARCHAR(255) | 负责人 |
| label | JSONB | 标签列表（JSON数组） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 2. task（任务表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 自增主键 |
| ware_sku | VARCHAR(255) | 马帮SKU（唯一） |
| inventory_num | INTEGER | 库存数量 |
| sales_num | INTEGER | 最近7天销量 |
| sale_day | INTEGER | 销售天数 |
| charge | VARCHAR(255) | 负责人 |
| label | JSONB | 标签列表 |
| **promised_land** | INTEGER | 方案选择（0=未选择，1=退回厂家，2=降价清仓，3=打处理） |
| **count_down** | INTEGER | 倒计时数字 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 3. task_history（历史任务表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 自增主键 |
| ware_sku | VARCHAR(255) | 马帮SKU |
| completed_sale_day | INTEGER | 完成时可售天数 |
| charge | VARCHAR(255) | 完成时负责人 |
| promised_land | INTEGER | 完成时选择的方案 |
| completed_at | TIMESTAMP | 完成时间 |
| inventory_num | INTEGER | 完成时库存数量（快照） |
| sales_num | INTEGER | 完成时最近7天销量（快照） |
| label | JSONB | 完成时的标签（快照） |

### 4. post_searchs（物流查询表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 自增主键 |
| search_num | VARCHAR(255) | 货运单号 |
| states | VARCHAR(255) | 状态 |
| Ship_date | TIMESTAMP | 发货日期 |
| channel | VARCHAR(255) | 发货渠道 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 5. per_charge（负责人映射表）- 可选

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 自增主键 |
| sku | VARCHAR(255) | SKU关键字 |
| charge | VARCHAR(255) | 负责人名称 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

---

## 🔄 MySQL 到 PostgreSQL 转换说明

### 主要转换

| MySQL | PostgreSQL | 说明 |
|-------|------------|------|
| `INT AUTO_INCREMENT` | `SERIAL` | 自增主键 |
| `DATETIME` | `TIMESTAMP` | 日期时间 |
| `DATE` | `TIMESTAMP` | 日期（post_searchs.Ship_date） |
| `JSON` | `JSONB` | JSON 数据（性能更好） |
| `ON UPDATE CURRENT_TIMESTAMP` | 触发器 | 自动更新时间 |
| `` `字段名` `` | `字段名` | 移除反引号 |
| `ENGINE=InnoDB` | 移除 | PostgreSQL 不需要 |
| `CHARSET` | 移除 | PostgreSQL 默认 UTF-8 |

---

## ✅ 验证清单

建表完成后，验证以下内容：

### 1. 检查表是否存在

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

应该看到 5 个表（如果创建了 per_charge）。

### 2. 检查表结构

```sql
-- 检查 inventory 表
\d inventory

-- 检查 task 表
\d task

-- 检查 task_history 表
\d task_history

-- 检查 post_searchs 表
\d post_searchs
```

### 3. 检查索引

```sql
-- 查看所有索引
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### 4. 检查触发器

```sql
-- 查看所有触发器
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

应该看到 4 个触发器（每个表的 updated_at 触发器）。

---

## 🧪 测试表功能

### 测试 1：插入数据

```sql
-- 测试 inventory 表
INSERT INTO inventory (ware_sku, inventory_num, sales_num, label) 
VALUES ('TEST001', 100, 50, '[1,2]'::jsonb);

-- 测试 post_searchs 表
INSERT INTO post_searchs (search_num, states, Ship_date, channel) 
VALUES ('TEST123', '运输中', CURRENT_TIMESTAMP, '渠道A');
```

### 测试 2：查询数据

```sql
SELECT * FROM inventory WHERE ware_sku = 'TEST001';
SELECT * FROM post_searchs WHERE search_num = 'TEST123';
```

### 测试 3：测试自动更新

```sql
-- 更新数据，检查 updated_at 是否自动更新
UPDATE inventory 
SET inventory_num = 200 
WHERE ware_sku = 'TEST001';

-- 查看 updated_at 是否已更新
SELECT ware_sku, inventory_num, updated_at FROM inventory WHERE ware_sku = 'TEST001';
```

---

## 📋 执行顺序

如果使用单独的文件，按以下顺序执行：

1. `sql/postgresql/create_inventory_table.sql`
2. `sql/postgresql/create_task_table.sql`
3. `sql/postgresql/create_task_history_table.sql`
4. `sql/postgresql/create_post_searchs_table.sql`
5. （可选）创建 `per_charge` 表

**或者直接使用：**
- `sql/postgresql/create_all_tables.sql` - 一次性创建所有表

---

## ⚠️ 注意事项

### 1. 如果表已存在

如果表已经存在，`CREATE TABLE IF NOT EXISTS` 不会报错，但也不会修改现有表结构。

如果需要重新创建：
```sql
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS task CASCADE;
DROP TABLE IF EXISTS task_history CASCADE;
DROP TABLE IF EXISTS post_searchs CASCADE;
DROP TABLE IF EXISTS per_charge CASCADE;
```

然后重新执行建表脚本。

### 2. 触发器函数

触发器函数 `update_updated_at_column()` 只需要创建一次，所有表共享。

### 3. 索引

所有必要的索引都已包含在建表脚本中。

---

## 🆘 常见问题

### Q: 执行脚本时出错

**A:** 
- 检查是否已连接到正确的数据库
- 检查 SQL 语法是否正确
- 查看错误信息，通常是语法错误或权限问题

### Q: 表创建成功但触发器没有创建

**A:**
- 触发器函数可能没有创建成功
- 检查 `update_updated_at_column()` 函数是否存在：
  ```sql
  SELECT proname FROM pg_proc WHERE proname = 'update_updated_at_column';
  ```

### Q: updated_at 没有自动更新

**A:**
- 检查触发器是否存在
- 检查触发器函数是否正确
- 确保使用 `UPDATE` 语句（`INSERT` 不会触发）

---

## 📞 下一步

建表完成后：

1. ✅ 验证所有表已创建
2. ✅ 测试插入和查询功能
3. ✅ 配置 `.env` 文件
4. ✅ 启动应用测试连接
5. ✅ （可选）迁移 MySQL 数据到 PostgreSQL

参考文档：
- `MYSQL_TO_POSTGRESQL_MIGRATION.md` - 数据迁移指南
- `NEON_CONNECTION_SETUP.md` - 连接配置指南

