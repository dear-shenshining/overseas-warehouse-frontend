# PostgreSQL 连接问题排查指南

## 错误：Connection terminated unexpectedly

### 排查步骤

#### 1. 检查 PostgreSQL 服务状态

**本地 PostgreSQL：**
```cmd
# Windows 服务管理器
services.msc
# 查找 "postgresql" 服务，确保状态为"正在运行"
```

**Neon（云端）：**
- 登录 https://console.neon.tech
- 检查项目状态是否正常
- 查看连接详情

#### 2. 检查数据库配置

确保 `.env` 文件配置正确：

**本地 PostgreSQL：**
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=seas_ware
DB_SSL=false
```

**Neon（云端）：**
```env
DB_HOST=your-neon-host.neon.tech
DB_PORT=5432
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=your-database
DB_SSL=true
```

#### 3. 检查数据库是否存在

**使用 psql 连接：**
```cmd
psql -U postgres -h localhost
```

**检查数据库：**
```sql
\l
-- 查找 seas_ware 数据库
```

**如果不存在，创建数据库：**
```sql
CREATE DATABASE seas_ware;
```

#### 4. 检查表是否存在

**连接到数据库：**
```cmd
psql -U postgres -d seas_ware
```

**检查表：**
```sql
\dt
-- 应该看到以下表：
-- - inventory
-- - task
-- - task_history
-- - post_searchs
```

**如果表不存在，执行建表脚本：**
```cmd
# 在项目目录下执行
psql -U postgres -d seas_ware -f sql/postgresql/create_inventory_table.sql
psql -U postgres -d seas_ware -f sql/postgresql/create_task_table.sql
psql -U postgres -d seas_ware -f sql/postgresql/create_task_history_table.sql
psql -U postgres -d seas_ware -f sql/postgresql/create_post_searchs_table.sql
```

#### 5. 测试连接

**使用 psql 测试：**
```cmd
psql -h localhost -U postgres -d seas_ware
```

如果连接成功，说明配置正确。

#### 6. 重启开发服务器

修改 `.env` 文件后，必须重启开发服务器：

```cmd
# 停止服务器（Ctrl+C）
# 重新启动
npm run dev
```

### 常见问题

#### Q: 连接被拒绝 (Connection refused)
**A:** 
- 检查 PostgreSQL 服务是否启动
- 检查端口是否正确（默认 5432）
- 检查防火墙设置

#### Q: 认证失败 (Authentication failed)
**A:**
- 检查用户名和密码是否正确
- 检查 `pg_hba.conf` 配置（本地 PostgreSQL）

#### Q: 数据库不存在 (Database does not exist)
**A:**
- 创建数据库：`CREATE DATABASE seas_ware;`

#### Q: 表不存在 (Table does not exist)
**A:**
- 执行建表脚本（见步骤 4）

#### Q: SSL 连接错误
**A:**
- 本地：设置 `DB_SSL=false`
- Neon：设置 `DB_SSL=true`

### 快速检查清单

- [ ] PostgreSQL 服务正在运行（本地）或 Neon 项目正常（云端）
- [ ] `.env` 文件配置正确
- [ ] 数据库 `seas_ware` 已创建
- [ ] 所有表已创建（执行了建表脚本）
- [ ] 已重启开发服务器
- [ ] 端口 5432 未被占用（本地）
- [ ] 防火墙允许连接（本地）

### 获取帮助

如果以上步骤都无法解决问题，请检查：
1. 控制台错误日志
2. PostgreSQL 日志文件（本地）
3. Neon 控制台的连接日志（云端）

