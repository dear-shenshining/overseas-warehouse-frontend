# 数据库部署指南

## 🔍 当前情况

你的数据库目前配置在本地（localhost），Vercel 无法直接连接本地数据库。需要将数据库迁移到云端。

## 🎯 解决方案（3个选项）

### 选项 1：使用 PlanetScale（推荐，免费）

**优点：**
- ✅ 免费额度充足（5GB 存储）
- ✅ MySQL 兼容，无需修改代码
- ✅ 自动备份
- ✅ 全球 CDN 加速

**步骤：**

1. **注册 PlanetScale**
   - 访问：https://planetscale.com
   - 使用 GitHub 账户登录（免费）

2. **创建数据库**
   - 登录后，点击 **"Create database"**
   - 填写信息：
     - **Name**: `seas_ware`
     - **Region**: 选择 `ap-southeast-1`（香港，离中国近）
   - 点击 **"Create database"**

3. **获取连接信息**
   - 在数据库页面，点击 **"Connect"**
   - 选择 **"Node.js"**
   - 复制连接信息，格式如下：
     ```
     host: xxxxx.psdb.cloud
     username: xxxxx
     password: xxxxx
     database: seas_ware
     ```

4. **导入数据**
   - 在 PlanetScale 控制台，点击 **"Branches"** → **"main"** → **"Console"**
   - 或者使用 MySQL 客户端连接后执行 SQL 文件
   - 执行 `sql/` 目录下的所有 SQL 文件

5. **在 Vercel 配置环境变量**
   - 进入 Vercel 项目设置 → **Environment Variables**
   - 添加：
     ```
     DB_HOST=xxxxx.psdb.cloud
     DB_PORT=3306
     DB_USER=xxxxx
     DB_PASSWORD=xxxxx
     DB_NAME=seas_ware
     ```
   - 点击 **"Save"**
   - 重新部署项目

---

### 选项 2：使用阿里云 RDS（国内访问快）

**优点：**
- ✅ 国内访问速度快
- ✅ 稳定可靠
- ✅ 支持 MySQL

**缺点：**
- ❌ 需要付费（最低约 100-200 元/月）

**步骤：**

1. **购买阿里云 RDS**
   - 访问：https://www.aliyun.com/product/rds
   - 选择 MySQL 版本
   - 选择配置（最低配置即可）

2. **配置数据库**
   - 创建数据库实例
   - 设置白名单（允许 Vercel IP 访问，或设置为 0.0.0.0/0 允许所有 IP）
   - 创建数据库：`seas_ware`
   - 创建用户并设置密码

3. **导入数据**
   - 使用 MySQL 客户端连接
   - 执行 `sql/` 目录下的所有 SQL 文件

4. **在 Vercel 配置环境变量**
   - 添加数据库连接信息

---

### 选项 3：使用 Supabase（PostgreSQL，需要修改代码）

**优点：**
- ✅ 免费额度充足
- ✅ 功能强大

**缺点：**
- ❌ 需要将 MySQL 迁移到 PostgreSQL（需要修改代码）

**不推荐**，除非你想完全重构数据库部分。

---

## 📝 推荐方案：PlanetScale

我推荐使用 **PlanetScale**，因为：
1. 完全免费（对于你的项目规模）
2. MySQL 兼容，无需修改代码
3. 设置简单
4. 性能好

---

## 🔧 数据库迁移步骤（PlanetScale）

### 步骤 1：导出本地数据（如果需要）

如果你本地数据库已有数据，需要导出：

```bash
# 导出数据库结构
mysqldump -u root -p --no-data seas_ware > schema.sql

# 导出数据
mysqldump -u root -p --no-create-info seas_ware > data.sql
```

### 步骤 2：在 PlanetScale 创建表

1. 登录 PlanetScale
2. 进入数据库 → **"Branches"** → **"main"** → **"Console"**
3. 执行以下 SQL 文件的内容（按顺序）：
   - `sql/create_inventory_table.sql`
   - `sql/create_task_table.sql`
   - `sql/create_task_history_table.sql`
   - `sql/add_promised_land_to_task.sql`
   - `sql/add_count_down_to_task.sql`
   - 其他 SQL 文件

### 步骤 3：导入数据（如果有）

如果有数据需要导入，在 PlanetScale Console 中执行 `data.sql`

### 步骤 4：更新 Vercel 环境变量

在 Vercel 项目设置中更新环境变量，使用 PlanetScale 的连接信息。

---

## ⚠️ 重要提示

1. **数据库密码安全**
   - 不要在代码中硬编码密码
   - 使用环境变量
   - 定期更换密码

2. **连接限制**
   - PlanetScale 免费版有连接数限制
   - 如果遇到连接问题，检查连接池配置

3. **数据备份**
   - PlanetScale 自动备份
   - 建议定期导出数据作为额外备份

---

## 🆘 遇到问题？

### 问题 1：无法连接到 PlanetScale

**解决方案：**
- 检查防火墙设置
- 确认连接信息正确
- 检查网络连接

### 问题 2：导入 SQL 失败

**解决方案：**
- 检查 SQL 语法
- 确认表是否已存在
- 查看 PlanetScale 的错误日志

### 问题 3：Vercel 仍然连接失败

**解决方案：**
- 确认环境变量已保存
- 重新部署项目
- 检查 Vercel 部署日志

---

## 📚 参考资源

- PlanetScale 文档：https://planetscale.com/docs
- PlanetScale 快速开始：https://planetscale.com/docs/tutorials/planetscale-quick-start-guide

