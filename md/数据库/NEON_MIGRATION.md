# Neon (PostgreSQL) 迁移指南

## 📋 概述

本指南说明如何将项目从 MySQL/TiDB 迁移到 Neon (PostgreSQL)。

---

## 🔄 主要变更

### 1. 数据库驱动

**MySQL → PostgreSQL**
- `mysql2` → `pg`
- 连接方式：从 MySQL 协议改为 PostgreSQL 协议

### 2. SQL 语法转换

#### 占位符
- **MySQL**: `?`
- **PostgreSQL**: `$1, $2, $3...`

#### 日期函数
- **MySQL**: `DATEDIFF(date1, date2)`
- **PostgreSQL**: `EXTRACT(DAY FROM (date1 - date2))::INTEGER`

- **MySQL**: `CURDATE()`
- **PostgreSQL**: `CURRENT_DATE`

- **MySQL**: `NOW()`
- **PostgreSQL**: `CURRENT_TIMESTAMP` (或 `NOW()` 也支持)

#### JSON 操作
- **MySQL**: `JSON_CONTAINS(json_doc, val)`
- **PostgreSQL**: `json_doc::jsonb @> val::jsonb`

- **MySQL**: `JSON_SEARCH(json_doc, 'one', 'val') IS NOT NULL`
- **PostgreSQL**: `json_doc::jsonb @> '["val"]'::jsonb`

#### 唯一键冲突处理
- **MySQL**: `ON DUPLICATE KEY UPDATE ...`
- **PostgreSQL**: `ON CONFLICT (key) DO UPDATE SET ...`

#### 自增主键
- **MySQL**: `AUTO_INCREMENT`
- **PostgreSQL**: `SERIAL` 或 `GENERATED ALWAYS AS IDENTITY`

#### 数据类型
- **MySQL**: `DATETIME`
- **PostgreSQL**: `TIMESTAMP`

- **MySQL**: `JSON`
- **PostgreSQL**: `JSONB` (推荐，性能更好)

#### 自动更新时间戳
- **MySQL**: `ON UPDATE CURRENT_TIMESTAMP`
- **PostgreSQL**: 需要触发器或应用层处理

---

## 📝 已完成的修改

### ✅ 1. 数据库连接 (`lib/db.ts`)
- [x] 替换 `mysql2` 为 `pg`
- [x] 修改连接配置
- [x] 添加占位符转换函数
- [x] 修改事务处理方式

### ✅ 2. 库存数据服务 (`lib/inventory-data.ts`)
- [x] 修改 `importInventoryData` 函数
- [x] 修改 `updateTaskCountDown` 函数
- [x] 修改 `syncInventoryToTask` 函数
- [ ] 修改 `getInventoryData` 函数
- [ ] 修改 `getTaskData` 函数
- [ ] 修改 `getInventoryStatistics` 函数
- [ ] 修改 `getTaskStatistics` 函数
- [ ] 修改其他查询函数

### ✅ 3. 物流数据服务 (`lib/logistics-data.ts`)
- [ ] 修改 `getLogisticsData` 函数
- [ ] 修改 `getLogisticsStatistics` 函数

### ✅ 4. SQL 文件
- [x] 创建 PostgreSQL 版本的 SQL 文件
  - [x] `sql/postgresql/create_inventory_table.sql`
  - [x] `sql/postgresql/create_task_table.sql`
  - [x] `sql/postgresql/create_task_history_table.sql`
  - [x] `sql/postgresql/create_post_searchs_table.sql`

---

## 🚀 迁移步骤

### 步骤 1: 安装依赖

```bash
npm install pg @types/pg
npm uninstall mysql2
```

### 步骤 2: 更新环境变量

在 `.env` 文件中更新数据库配置：

```env
# PostgreSQL (Neon) 配置
DB_HOST=your-neon-host.neon.tech
DB_PORT=5432
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=your-database
DB_SSL=true
```

### 步骤 3: 创建数据库表

执行 PostgreSQL 版本的 SQL 文件（见 `sql/postgresql/` 目录）

### 步骤 4: 迁移数据

如果需要从 MySQL 迁移数据到 PostgreSQL，可以使用：
- pgLoader
- 自定义迁移脚本
- 导出 CSV 后导入

### 步骤 5: 测试

1. 测试数据库连接
2. 测试数据查询
3. 测试数据写入
4. 测试事务
5. 测试 JSON 操作

---

## ⚠️ 注意事项

### 1. JSON 字段处理

PostgreSQL 的 JSONB 类型更严格，需要确保：
- 空值使用 `NULL` 而不是空字符串
- JSON 格式必须有效
- 数组查询使用 `@>` 操作符

### 2. 日期时间处理

PostgreSQL 的日期时间函数略有不同：
- 使用 `CURRENT_TIMESTAMP` 而不是 `NOW()`（虽然 `NOW()` 也支持）
- 日期差计算使用 `EXTRACT(DAY FROM ...)`

### 3. 事务处理

PostgreSQL 使用标准 SQL 事务：
- `BEGIN` 而不是 `beginTransaction()`
- `COMMIT` 而不是 `commit()`
- `ROLLBACK` 而不是 `rollback()`

### 4. 连接池

PostgreSQL 的连接池配置略有不同：
- 使用 `max` 而不是 `connectionLimit`
- SSL 配置需要单独设置

---

## 📚 参考资源

- [Neon 文档](https://neon.tech/docs)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
- [pg 驱动文档](https://node-postgres.com/)

---

## 🔍 测试清单

- [ ] 数据库连接成功
- [ ] 查询操作正常
- [ ] 插入操作正常
- [ ] 更新操作正常
- [ ] 删除操作正常
- [ ] 事务处理正常
- [ ] JSON 查询正常
- [ ] 日期计算正常
- [ ] 唯一键冲突处理正常

---

## 🆘 常见问题

### Q: JSON 查询失败
**A**: 确保使用 `::jsonb` 类型转换，并使用 `@>` 操作符

### Q: 日期差计算错误
**A**: 使用 `EXTRACT(DAY FROM (date1 - date2))::INTEGER` 而不是 `DATEDIFF`

### Q: 唯一键冲突处理失败
**A**: 使用 `ON CONFLICT (key) DO UPDATE SET ...` 而不是 `ON DUPLICATE KEY UPDATE`

---

## 📞 支持

如果遇到问题，请检查：
1. 数据库连接配置
2. SQL 语法是否正确
3. 数据类型是否匹配
4. 日志中的错误信息

