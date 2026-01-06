# Vercel 环境变量配置指南

## 📋 问题说明

Vercel 部署时显示 `.env` 文件配置不正确，这是因为：
1. `.env` 文件不应该提交到 Git（已在 `.gitignore` 中）
2. Vercel 需要在控制台中手动配置环境变量
3. 环境变量不会自动从 `.env` 文件读取

---

## 🔧 解决方案：在 Vercel 控制台配置环境变量

### 步骤 1：登录 Vercel 控制台

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 登录你的账号
3. 找到你的项目：`overseas-warehouse-frontend`

### 步骤 2：进入项目设置

1. 点击项目名称进入项目详情页
2. 点击顶部菜单的 **Settings**（设置）
3. 在左侧菜单中找到 **Environment Variables**（环境变量）

### 步骤 3：添加环境变量

需要添加以下环境变量（根据你的 Neon 数据库配置填写）：

#### 必需的环境变量

| 变量名 | 说明 | 示例值 | 备注 |
|--------|------|--------|------|
| `DB_HOST` | 数据库主机地址 | `ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech` | 从 Neon 控制台获取 |
| `DB_PORT` | 数据库端口 | `5432` | PostgreSQL 默认端口 |
| `DB_USER` | 数据库用户名 | `neondb_owner` | 从 Neon 控制台获取 |
| `DB_PASSWORD` | 数据库密码 | `npg_TgJB3fG0UoHn` | 从 Neon 控制台获取（敏感信息） |
| `DB_NAME` | 数据库名称 | `seas_ware` | 你的数据库名 |
| `DB_SSL` | 是否使用 SSL | `true` | Neon 必须使用 SSL |

### 步骤 4：填写环境变量值

1. 点击 **Add New**（添加新变量）按钮
2. 在 **Key** 字段输入变量名（如 `DB_HOST`）
3. 在 **Value** 字段输入变量值
4. 选择环境：
   - ✅ **Production**（生产环境）- 必须勾选
   - ✅ **Preview**（预览环境）- 建议勾选
   - ✅ **Development**（开发环境）- 可选
5. 点击 **Save**（保存）

**重复步骤 4，添加所有必需的环境变量。**

### 步骤 5：重新部署

配置完环境变量后，需要重新部署：

1. 在项目页面，点击 **Deployments**（部署）
2. 找到最新的部署记录
3. 点击右侧的 **⋯**（三个点）菜单
4. 选择 **Redeploy**（重新部署）
5. 确认重新部署

或者：

1. 推送一个新的提交到 GitHub（即使只是修改注释）
2. Vercel 会自动触发新的部署

---

## 📝 环境变量配置示例

### 从 Neon 控制台获取连接信息

1. 登录 [Neon Console](https://console.neon.tech)
2. 选择你的项目
3. 在 **Connection Details** 中可以看到连接信息

### 连接字符串示例

```
postgresql://neondb_owner:npg_TgJB3fG0UoHn@ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### 解析连接字符串

从连接字符串中提取各个部分：

- **DB_HOST**: `ep-young-wildflower-a4yjlgha-pooler.us-east-1.aws.neon.tech`
- **DB_PORT**: `5432`（默认）
- **DB_USER**: `neondb_owner`
- **DB_PASSWORD**: `npg_TgJB3fG0UoHn`
- **DB_NAME**: `neondb` 或 `seas_ware`（根据你创建的数据库）
- **DB_SSL**: `true`

---

## 🔍 验证配置

### 方法 1：查看部署日志

1. 在 Vercel 项目页面，点击 **Deployments**
2. 点击最新的部署记录
3. 查看 **Build Logs**（构建日志）
4. 如果看到数据库连接错误，说明环境变量配置有问题

### 方法 2：在代码中验证

可以在代码中临时添加日志（仅用于调试，不要提交）：

```typescript
// 在 lib/db.ts 中临时添加
console.log('DB Config:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL,
  // 不要打印密码！
})
```

**注意：** 调试完成后记得删除这些日志代码。

---

## ⚠️ 常见问题

### 问题 1：环境变量不生效

**原因：** 环境变量配置后没有重新部署。

**解决：** 重新部署项目（见步骤 5）。

### 问题 2：数据库连接失败

**可能原因：**
1. 环境变量值填写错误
2. 数据库名称不对（应该是 `seas_ware` 而不是 `neondb`）
3. SSL 配置错误（应该是 `true`）

**解决：**
1. 检查环境变量值是否正确
2. 确认数据库名称
3. 确认 `DB_SSL` 设置为 `true`

### 问题 3：找不到 Environment Variables 选项

**解决：**
1. 确保你有项目的管理员权限
2. 在项目设置页面，左侧菜单中查找
3. 如果还是没有，可能是 Vercel 界面更新，查找类似的选项

### 问题 4：环境变量在本地正常，但在 Vercel 不工作

**原因：** 本地使用 `.env` 文件，Vercel 需要手动配置。

**解决：** 按照本指南在 Vercel 控制台配置环境变量。

---

## 📋 完整配置清单

在 Vercel 控制台配置以下环境变量：

- [ ] `DB_HOST` - 数据库主机地址
- [ ] `DB_PORT` - 数据库端口（通常是 `5432`）
- [ ] `DB_USER` - 数据库用户名
- [ ] `DB_PASSWORD` - 数据库密码
- [ ] `DB_NAME` - 数据库名称（`seas_ware`）
- [ ] `DB_SSL` - SSL 连接（`true`）

**环境选择：**
- [ ] Production（生产环境）
- [ ] Preview（预览环境）
- [ ] Development（开发环境，可选）

---

## 🚀 快速配置步骤总结

1. ✅ 登录 Vercel Dashboard
2. ✅ 进入项目 Settings → Environment Variables
3. ✅ 添加 6 个环境变量（DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL）
4. ✅ 选择环境（至少选择 Production）
5. ✅ 保存并重新部署

---

## 📚 参考文档

- [Vercel 环境变量文档](https://vercel.com/docs/concepts/projects/environment-variables)
- [Neon 连接指南](https://neon.tech/docs/connect/connect-from-any-app)

---

**配置完成后，重新部署项目，`.env` 配置错误应该就会解决了！** 🎉

