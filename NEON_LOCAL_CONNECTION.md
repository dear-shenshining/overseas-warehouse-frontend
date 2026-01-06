# 本地连接 Neon 数据库指南

## 📋 概述

Neon 是一个云端的 PostgreSQL 服务，可以从本地开发环境直接连接。本指南将帮助你配置本地项目连接到 Neon 数据库。

---

## 🔑 步骤 1：获取 Neon 连接信息

### 1. 登录 Neon 控制台

访问：https://console.neon.tech

### 2. 选择或创建项目

- 如果已有项目，选择你的项目
- 如果没有，创建一个新项目

### 3. 获取连接字符串

在项目页面，找到 **"Connection Details"** 或 **"连接详情"**：

**方式 1：连接字符串（推荐）**
```
postgresql://username:password@host.neon.tech/database?sslmode=require
```

**方式 2：单独的参数**
- **Host（主机）**: `xxx.xxx.neon.tech`
- **Port（端口）**: `5432`
- **Database（数据库）**: `neondb` 或你创建的数据库名
- **User（用户名）**: `xxx`
- **Password（密码）**: `xxx`
- **SSL**: 必须启用

---

## ⚙️ 步骤 2：配置本地环境变量

### 创建或编辑 `.env` 文件

在项目根目录创建 `.env` 文件（如果还没有）：

```env
# Neon 数据库配置
DB_HOST=xxx.xxx.neon.tech
DB_PORT=5432
DB_USER=你的用户名
DB_PASSWORD=你的密码
DB_NAME=你的数据库名
DB_SSL=true
```

### 示例配置

```env
# Neon 数据库配置
DB_HOST=ep-cool-darkness-123456.us-east-2.aws.neon.tech
DB_PORT=5432
DB_USER=neondb_owner
DB_PASSWORD=your_secure_password_here
DB_NAME=neondb
DB_SSL=true
```

---

## 🧪 步骤 3：测试连接

### 方法 1：使用 psql（命令行）

```cmd
psql "postgresql://用户名:密码@主机:5432/数据库名?sslmode=require"
```

**示例：**
```cmd
psql "postgresql://neondb_owner:password@ep-cool-darkness-123456.us-east-2.aws.neon.tech:5432/neondb?sslmode=require"
```

### 方法 2：使用应用测试

启动开发服务器：

```cmd
npm run dev
```

如果连接成功，应用会正常启动。如果失败，会显示连接错误。

### 方法 3：使用 Node.js 测试脚本

创建 `test-connection.js`：

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('连接失败:', err);
  } else {
    console.log('连接成功! 当前时间:', res.rows[0].now);
  }
  pool.end();
});
```

运行：
```cmd
node test-connection.js
```

---

## 📊 步骤 4：创建数据库表

连接成功后，需要在 Neon 数据库中创建表结构。

### 在 Neon SQL Editor 中执行

1. 登录 Neon 控制台
2. 进入你的项目
3. 点击 **"SQL Editor"** 或 **"SQL 编辑器"**
4. 依次执行以下 SQL 文件的内容：

**执行顺序：**
1. `sql/postgresql/create_inventory_table.sql`
2. `sql/postgresql/create_task_table.sql`
3. `sql/postgresql/create_task_history_table.sql`
4. `sql/postgresql/create_post_searchs_table.sql`

### 或使用命令行执行

```cmd
# 使用连接字符串
psql "postgresql://用户名:密码@主机:5432/数据库名?sslmode=require" -f sql/postgresql/create_inventory_table.sql

# 或使用环境变量
set PGPASSWORD=你的密码
psql -h 你的主机 -U 你的用户名 -d 你的数据库名 -f sql/postgresql/create_inventory_table.sql
```

---

## 🔄 步骤 5：迁移数据（可选）

如果你有 MySQL 数据需要迁移到 Neon，参考 `MYSQL_TO_POSTGRESQL_MIGRATION.md` 文档。

---

## ⚠️ 注意事项

### 1. SSL 连接

Neon **必须**使用 SSL 连接，确保 `.env` 中设置：
```env
DB_SSL=true
```

### 2. 防火墙和网络

- 确保本地网络可以访问互联网
- 某些公司网络可能阻止外部数据库连接
- 如果连接失败，检查防火墙设置

### 3. 连接池限制

Neon 免费版有连接数限制，注意：
- 不要创建过多连接
- 使用连接池（代码中已配置）
- 及时释放连接

### 4. 环境变量安全

- **不要**将 `.env` 文件提交到 Git
- `.env` 已在 `.gitignore` 中
- 生产环境使用 Vercel 环境变量

---

## 🐛 常见问题

### Q: 连接超时 (Connection timeout)

**A:** 
- 检查网络连接
- 检查防火墙设置
- 确认 Neon 项目状态正常

### Q: SSL 连接错误

**A:**
- 确保 `DB_SSL=true`
- 检查连接字符串中是否包含 `?sslmode=require`

### Q: 认证失败 (Authentication failed)

**A:**
- 检查用户名和密码是否正确
- 确认数据库名称正确
- 在 Neon 控制台重置密码

### Q: 数据库不存在

**A:**
- 在 Neon 控制台创建数据库
- 或使用默认数据库名（通常是 `neondb`）

---

## ✅ 验证清单

- [ ] 已获取 Neon 连接信息
- [ ] 已创建 `.env` 文件并配置正确
- [ ] 已测试连接成功
- [ ] 已在 Neon 中创建数据库表
- [ ] 应用可以正常连接数据库
- [ ] 可以正常查询数据

---

## 🚀 快速开始命令

```cmd
# 1. 创建 .env 文件（从 .env.example 复制）
copy .env.example .env

# 2. 编辑 .env 文件，填入 Neon 连接信息
notepad .env

# 3. 测试连接
npm run dev

# 4. 如果连接成功，在 Neon SQL Editor 中执行建表脚本
```

---

## 📞 获取帮助

如果遇到问题：
1. 检查 Neon 控制台的项目状态
2. 查看应用控制台的错误信息
3. 参考 `POSTGRESQL_TROUBLESHOOTING.md` 文档
4. 检查网络连接和防火墙设置

