# Neon 连接配置

## 🔑 从连接字符串提取的信息

你的 Neon 连接字符串：
```
postgresql://neondb_owner:npg_TgJB3fG0UoHn@ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**解析结果：**
- **Host（主机）**: `ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech`
- **Port（端口）**: `5432` (默认)
- **User（用户名）**: `neondb_owner`
- **Password（密码）**: `npg_TgJB3fG0UoHn`
- **Database（数据库）**: `neondb`
- **SSL**: `require` (必须)

---

## ⚙️ 配置 .env 文件

在项目根目录创建或编辑 `.env` 文件：

```env
# Neon 数据库配置
DB_HOST=ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech
DB_PORT=5432
DB_USER=neondb_owner
DB_PASSWORD=npg_TgJB3fG0UoHn
DB_NAME=seas_ware
DB_SSL=true
```

**注意：** 如果你在 Neon 中创建了 `seas_ware` 数据库，使用 `DB_NAME=seas_ware`。如果使用默认的 `neondb`，则使用 `DB_NAME=neondb`。

---

## 🧪 测试连接

### 方法 1：使用 psql（命令行）

```cmd
psql "postgresql://neondb_owner:npg_TgJB3fG0UoHn@ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech:5432/neondb?sslmode=require"
```

如果连接成功，你会看到：
```
neondb=>
```

然后可以执行 SQL 命令：
```sql
SELECT NOW();
\q  -- 退出
```

### 方法 2：使用应用测试

1. 确保 `.env` 文件已配置
2. 重启开发服务器：
   ```cmd
   npm run dev
   ```
3. 如果连接成功，应用会正常启动

---

## 📊 创建数据库表

连接成功后，在 Neon SQL Editor 或使用 psql 执行建表脚本：

### 在 Neon SQL Editor 中：

1. 登录 https://console.neon.tech
2. 进入你的项目
3. 点击 **"SQL Editor"**
4. 依次执行以下文件的内容：
   - `sql/postgresql/create_inventory_table.sql`
   - `sql/postgresql/create_task_table.sql`
   - `sql/postgresql/create_task_history_table.sql`
   - `sql/postgresql/create_post_searchs_table.sql`

### 或使用 psql 命令行：

```cmd
# 连接到数据库
psql "postgresql://neondb_owner:npg_TgJB3fG0UoHn@ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech:5432/neondb?sslmode=require"

# 在 psql 中执行（需要先 cd 到项目目录）
\i sql/postgresql/create_inventory_table.sql
\i sql/postgresql/create_task_table.sql
\i sql/postgresql/create_task_history_table.sql
\i sql/postgresql/create_post_searchs_table.sql
```

---

## ⚠️ 安全提示

1. **不要将 `.env` 文件提交到 Git**
   - `.env` 已在 `.gitignore` 中
   - 密码是敏感信息

2. **如果密码泄露**
   - 在 Neon 控制台重置密码
   - 更新 `.env` 文件中的密码

3. **生产环境**
   - 使用 Vercel 环境变量
   - 不要硬编码密码

---

## ✅ 验证清单

- [ ] `.env` 文件已创建并配置
- [ ] 使用 psql 测试连接成功
- [ ] 应用可以正常启动
- [ ] 数据库表已创建
- [ ] 可以正常查询数据

---

## 🚀 快速开始

```cmd
# 1. 创建 .env 文件（如果还没有）
# 复制上面的配置到 .env 文件

# 2. 测试连接
psql "postgresql://neondb_owner:npg_TgJB3fG0UoHn@ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech:5432/neondb?sslmode=require"

# 3. 如果连接成功，启动应用
npm run dev
```

