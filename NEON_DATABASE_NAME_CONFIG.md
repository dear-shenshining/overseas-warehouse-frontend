# Neon 数据库名称配置说明

## ✅ 没有影响！

你在 Neon 中创建了 `seas_ware` 数据库，这是完全可以的，只需要在 `.env` 文件中修改数据库名称即可。

---

## ⚙️ 配置步骤

### 1. 修改 `.env` 文件

将 `DB_NAME` 从 `neondb` 改为 `seas_ware`：

```env
DB_HOST=ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech
DB_PORT=5432
DB_USER=neondb_owner
DB_PASSWORD=npg_TgJB3fG0UoHn
DB_NAME=seas_ware
DB_SSL=true
```

**重要：** `DB_NAME=seas_ware`（不是 `neondb`）

### 2. 重启开发服务器

修改 `.env` 后必须重启：

```cmd
# 停止当前服务器（Ctrl+C）
npm run dev
```

---

## 📊 在 Neon SQL Editor 中执行建表脚本

### 步骤 1：切换到 seas_ware 数据库

1. 登录 Neon 控制台
2. 打开 SQL Editor
3. **确保选择的是 `seas_ware` 数据库**（不是 `neondb`）

### 步骤 2：执行建表脚本

在 SQL Editor 中执行：

```sql
-- 方式 1：直接执行完整脚本
-- 复制 sql/postgresql/create_all_tables.sql 的内容并执行

-- 方式 2：或者依次执行单独的文件
-- 1. 先执行 create_inventory_table.sql
-- 2. 再执行 create_task_table.sql
-- 3. 再执行 create_task_history_table.sql
-- 4. 再执行 create_post_searchs_table.sql
```

### 步骤 3：验证

```sql
-- 查看当前数据库
SELECT current_database();

-- 应该显示：seas_ware

-- 查看所有表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

## 🔍 如何确认数据库名称

### 在 Neon 控制台

1. 登录 Neon 控制台
2. 在项目页面，可以看到数据库列表
3. 确认 `seas_ware` 数据库存在

### 在连接字符串中

如果你有连接字符串，数据库名在最后：

```
postgresql://用户名:密码@主机/数据库名?sslmode=require
                                    ↑
                                这里是数据库名
```

---

## ✅ 配置检查清单

- [ ] `.env` 文件中的 `DB_NAME=seas_ware`
- [ ] Neon 中已创建 `seas_ware` 数据库
- [ ] 在 SQL Editor 中选择了 `seas_ware` 数据库
- [ ] 已执行建表脚本
- [ ] 已重启开发服务器
- [ ] 应用可以正常连接

---

## 🚀 快速配置

```env
# .env 文件
DB_HOST=ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech
DB_PORT=5432
DB_USER=neondb_owner
DB_PASSWORD=npg_TgJB3fG0UoHn
DB_NAME=seas_ware
DB_SSL=true
```

然后：
1. 在 Neon SQL Editor 中选择 `seas_ware` 数据库
2. 执行 `sql/postgresql/create_all_tables.sql`
3. 重启应用：`npm run dev`

---

## 📝 总结

**使用 `seas_ware` 数据库完全没有问题！**

- ✅ 只需要修改 `.env` 中的 `DB_NAME`
- ✅ 在 Neon SQL Editor 中选择正确的数据库
- ✅ 执行建表脚本
- ✅ 重启应用即可

这样配置后，应用会连接到 `seas_ware` 数据库，而不是默认的 `neondb`。

