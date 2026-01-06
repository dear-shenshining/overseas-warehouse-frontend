# PostgreSQL SQL 文件

本目录包含 PostgreSQL 版本的 SQL 建表脚本。

## 使用说明

### 1. 执行顺序

按照以下顺序执行 SQL 文件：

1. `create_inventory_table.sql` - 创建库存表
2. `create_task_table.sql` - 创建任务表
3. `create_task_history_table.sql` - 创建历史任务表
4. `create_post_searchs_table.sql` - 创建物流查询表

### 2. 执行方法

#### 使用 psql 命令行工具：

```bash
psql -h your-host -U your-username -d your-database -f create_inventory_table.sql
psql -h your-host -U your-username -d your-database -f create_task_table.sql
psql -h your-host -U your-username -d your-database -f create_task_history_table.sql
psql -h your-host -U your-username -d your-database -f create_post_searchs_table.sql
```

#### 使用 Neon 控制台：

1. 登录 Neon 控制台
2. 进入 SQL Editor
3. 依次执行每个 SQL 文件的内容

### 3. 注意事项

- 所有表使用 `SERIAL` 作为自增主键（PostgreSQL 标准）
- JSON 字段使用 `JSONB` 类型（性能更好）
- 日期时间字段使用 `TIMESTAMP` 类型
- 自动更新时间戳通过触发器实现（`update_updated_at_column` 函数）

### 4. 触发器说明

`update_updated_at_column` 函数会在 `create_inventory_table.sql` 中创建，其他表会复用这个函数。

如果单独执行某个 SQL 文件，请确保先执行 `create_inventory_table.sql` 以创建触发器函数。

