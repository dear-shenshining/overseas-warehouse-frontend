# 🚀 Cron 定时任务快速开始指南

> 5 分钟快速设置倒计时自动更新

---

## ⚡ 快速步骤（5 分钟）

### 1️⃣ 生成密钥（30 秒）

打开浏览器访问：https://www.random.org/strings/
- 长度：32
- 字符集：数字和字母
- 点击生成，复制生成的字符串

**示例**：`aB3xK9mP2qR7vT5wY8zN1cF4hJ6gL0sD`

---

### 2️⃣ 在 Vercel 添加环境变量（2 分钟）

1. 访问：https://vercel.com/dashboard
2. 选择您的项目
3. **Settings** → **Environment Variables**
4. 添加：
   - **Name**: `CRON_SECRET_KEY`
   - **Value**: 刚才生成的密钥 bKxfzfZ6uyJpOXx5XsivSo0ibTSxqRlc
   - **Environment**: ✅ Production
5. 点击 **Save**
6. **重要**：**Deployments** → 最新部署 → **⋯** → **Redeploy**

---

### 3️⃣ 注册 Cron 服务（1 分钟）

1. 访问：https://cron-job.org/
2. 点击 **Sign up** 注册（邮箱 + 密码）
3. 检查邮箱，点击验证链接
4. 登录

---

### 4️⃣ 创建定时任务（1 分钟）

1. 登录后，点击 **Create cronjob**

2. 填写信息：
   ```
   Title: 更新倒计时
   
   Address: https://www.jinyanyan.com/api/update-countdown?secret=bKxfzfZ6uyJpOXx5XsivSo0ibTSxqRlc
   ```
   **替换**：
   - `your-app.vercel.app` → 您的 Vercel 域名
   - `YOUR_SECRET_KEY` → 步骤 1 生成的密钥

3. **Schedule**: 选择 **Every hour**（每小时）

4. **Request method**: **GET**

5. ✅ 勾选 **Activated**

6. 点击 **Create cronjob**

---

### 5️⃣ 测试（30 秒）

在浏览器访问（替换为您的实际地址）：
```
https://your-app.vercel.app/api/update-countdown?secret=YOUR_SECRET_KEY
```

**应该看到**：
```json
{"success":true,"message":"倒计时更新成功","timestamp":"2026-01-07T..."}
```

---

## ✅ 完成！

现在您的倒计时将：
- ✅ 每小时自动更新
- ✅ 24 小时不间断运行
- ✅ 完全免费

---

## 🔍 如何验证是否正常工作？

### 方法 1：查看 Cron 执行日志

1. 在 cron-job.org 中，点击您创建的任务
2. 查看 **Execution log**
3. 应该看到 **Status: Success (200)**

### 方法 2：查看数据库

查询 `task` 表，检查 `updated_at` 是否是最新时间：
```sql
SELECT ware_sku, count_down, updated_at 
FROM task 
ORDER BY updated_at DESC 
LIMIT 5;
```

---

## ❓ 遇到问题？

### 401 错误？
- 检查 Vercel 环境变量 `CRON_SECRET_KEY` 是否正确
- 检查 Cron 任务 URL 中的 `secret=` 参数是否正确
- 确保已重新部署项目

### 500 错误？
- 查看 Vercel 日志：**Deployments** → 部署 → **Functions** → 日志
- 检查数据库连接配置

### 超时错误（Timeout）？
- **Vercel Hobby 计划限制**：函数执行时间限制为 10 秒
- **解决方案**：
  1. 升级到 Vercel Pro 计划（60 秒限制）
  2. 或者优化数据库查询（添加索引、减少数据量）
  3. 检查 `task` 表的数据量，如果数据量过大，考虑分批更新
- 查看 Vercel 日志了解具体超时时间
- 检查数据库连接是否正常（Neon 等 serverless 数据库可能需要更长的连接时间）

### 任务没执行？
- 检查任务是否已激活（Activated）
- 查看 cron-job.org 的执行日志

---

## 📚 详细文档

如需更详细的说明，请查看：`md/CRON_SETUP_GUIDE.md`

---

**设置完成后，倒计时将自动更新，无需手动操作！** 🎉

