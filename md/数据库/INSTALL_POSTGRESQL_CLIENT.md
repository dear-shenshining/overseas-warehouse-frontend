# 安装 PostgreSQL 客户端工具 (psql)

## 📋 方法 1：安装 PostgreSQL（包含 psql）

### Windows 安装步骤

1. **下载 PostgreSQL**
   - 访问：https://www.postgresql.org/download/windows/
   - 或直接下载：https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
   - 选择最新版本（推荐 15 或 16）

2. **安装**
   - 运行安装程序
   - 选择安装路径（默认即可）
   - **重要**：记住你设置的 postgres 用户密码（这是本地 PostgreSQL 的密码，不是 Neon 的密码）
   - 端口保持默认 5432（如果本地没有 PostgreSQL，可以不改）
   - 完成安装

3. **验证安装**
   ```cmd
   psql --version
   ```

4. **使用 psql 连接 Neon**
   ```cmd
   psql "postgresql://neondb_owner:npg_TgJB3fG0UoHn@ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
   ```

---

## 📋 方法 2：只安装客户端工具（推荐，更轻量）

### 使用 PostgreSQL 便携版

1. **下载 PostgreSQL 便携版**
   - 访问：https://www.postgresql.org/download/windows/
   - 选择 "Zip Archive" 版本
   - 或使用第三方便携版

2. **解压并添加到 PATH**
   - 解压到 `C:\PostgreSQL\` 或任意目录
   - 将 `bin` 目录添加到系统 PATH：
     - 右键"此电脑" → "属性" → "高级系统设置" → "环境变量"
     - 在"系统变量"中找到 `Path`，点击"编辑"
     - 添加 PostgreSQL 的 `bin` 目录路径，例如：`C:\PostgreSQL\bin`
     - 确定保存

3. **重启 CMD 或 PowerShell**
   - 关闭当前窗口，重新打开

4. **验证**
   ```cmd
   psql --version
   ```

---

## 📋 方法 3：使用 Docker（如果你有 Docker）

```cmd
# 拉取 PostgreSQL 镜像
docker pull postgres

# 使用 psql 连接 Neon（不需要启动容器）
docker run -it --rm postgres psql "postgresql://neondb_owner:npg_TgJB3fG0UoHn@ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

---

## 📋 方法 4：不使用 psql，直接测试应用连接

如果你不需要命令行工具，可以直接通过应用测试连接：

### 1. 配置 .env 文件

在项目根目录创建 `.env` 文件：

```env
DB_HOST=ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech
DB_PORT=5432
DB_USER=neondb_owner
DB_PASSWORD=npg_TgJB3fG0UoHn
DB_NAME=neondb
DB_SSL=true
```

### 2. 启动应用

```cmd
npm run dev
```

### 3. 检查连接

- 如果连接成功，应用会正常启动
- 如果连接失败，控制台会显示错误信息

---

## 🎯 推荐方案

**如果你只需要连接 Neon，不需要本地 PostgreSQL：**

1. **最简单**：使用方法 4（直接测试应用连接）
2. **需要命令行工具**：使用方法 1（安装完整 PostgreSQL）

---

## ✅ 验证安装

安装完成后，在 CMD 中执行：

```cmd
psql --version
```

应该看到版本信息，例如：
```
psql (PostgreSQL) 16.1
```

然后可以连接 Neon：
```cmd
psql "postgresql://neondb_owner:npg_TgJB3fG0UoHn@ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

---

## 🚀 快速开始（推荐）

**如果你只是想测试连接，不需要安装 psql：**

1. 创建 `.env` 文件（见方法 4）
2. 启动应用：`npm run dev`
3. 如果应用正常启动，说明连接成功

**如果需要命令行工具：**

1. 下载并安装 PostgreSQL（方法 1）
2. 使用 psql 连接测试

