# 📅 外部 Cron 服务设置指南

> 使用外部免费 Cron 服务定期更新倒计时字段

---

## 📋 目录

1. [准备工作](#准备工作)
2. [步骤一：设置环境变量](#步骤一设置环境变量)
3. [步骤二：部署代码到 Vercel](#步骤二部署代码到-vercel)
4. [步骤三：注册 Cron 服务](#步骤三注册-cron-服务)
5. [步骤四：配置定时任务](#步骤四配置定时任务)
6. [步骤五：测试和验证](#步骤五测试和验证)
7. [常见问题](#常见问题)

---

## 🎯 准备工作

### 需要的信息：
- ✅ Vercel 部署的网站地址（例如：`https://your-app.vercel.app`）
- ✅ 一个邮箱地址（用于注册 Cron 服务）
- ✅ 能够访问 Vercel 项目设置页面

---

## 步骤一：设置环境变量

### 1.1 生成 Secret Key

打开终端，运行以下命令生成一个随机密钥：

```bash
# Windows PowerShell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString()))

# 或者使用在线工具生成：https://www.random.org/strings/
```

**示例生成的密钥**（请使用您自己生成的）：
```
aB3xK9mP2qR7vT5wY8zN1cF4hJ6gL0sD
```

### 1.2 在 Vercel 中添加环境变量

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择您的项目
3. 点击 **Settings** → **Environment Variables**
4. 添加新变量：
   - **Name**: `CRON_SECRET_KEY`
   - **Value**: 您刚才生成的密钥（例如：`aB3xK9mP2qR7vT5wY8zN1cF4hJ6gL0sD`）
   - **Environment**: 选择 `Production`（生产环境）
5. 点击 **Save**
6. **重要**：需要重新部署项目才能生效
   - 点击 **Deployments** 标签
   - 点击最新部署右侧的 **⋯** → **Redeploy**

---

## 步骤二：部署代码到 Vercel

确保您的代码已经推送到 Git 仓库，Vercel 会自动部署。

如果还没有部署：
1. 提交代码到 Git
2. Vercel 会自动检测并部署
3. 等待部署完成

---

## 步骤三：注册 Cron 服务

### 推荐服务：cron-job.org（完全免费）

1. 访问：https://cron-job.org/
2. 点击右上角 **Sign up** 注册账号
3. 填写注册信息：
   - Email（邮箱）
   - Password（密码）
   - 确认密码
4. 点击 **Create account**
5. 检查邮箱，点击验证链接激活账号
6. 登录账号

---

## 步骤四：配置定时任务

### 4.1 创建新的 Cron Job

1. 登录 cron-job.org 后，点击 **Create cronjob** 按钮

2. **Title（标题）**：
   ```
   更新倒计时
   ```

3. **Address（地址）**：
   ```
   https://your-app.vercel.app/api/update-countdown?secret=YOUR_SECRET_KEY
   ```
   
   **重要**：
   - 将 `your-app.vercel.app` 替换为您的实际 Vercel 域名
   - 将 `YOUR_SECRET_KEY` 替换为您在步骤 1.2 中设置的值

   **示例**：
   ```
   https://my-warehouse-app.vercel.app/api/update-countdown?secret=aB3xK9mP2qR7vT5wY8zN1cF4hJ6gL0sD
   ```

4. **Schedule（执行频率）**：
   - 选择 **Every hour**（每小时执行一次）
   - 或者选择 **Custom** 自定义：
     - 每 30 分钟：`*/30 * * * *`
     - 每小时：`0 * * * *`
     - 每 2 小时：`0 */2 * * *`

5. **Request method（请求方法）**：
   - 选择 **GET**（推荐）或 **POST**

6. **其他设置**：
   - ✅ 勾选 **Activated**（激活）
   - ✅ 勾选 **Save response**（保存响应，方便查看日志）

7. 点击 **Create cronjob** 创建任务

---

## 步骤五：测试和验证

### 5.1 手动测试 API

在浏览器中访问（替换为您的实际地址和密钥）：

```
https://your-app.vercel.app/api/update-countdown?secret=YOUR_SECRET_KEY
```

**应该看到**：
```json
{
  "success": true,
  "message": "倒计时更新成功",
  "timestamp": "2026-01-07T14:30:00.000Z"
}
```

**如果看到错误**：
- `401 Unauthorized`：检查 secret 是否正确
- `500 Internal Server Error`：检查 Vercel 日志

### 5.2 查看 Cron 执行日志

1. 在 cron-job.org 中，点击您创建的任务
2. 查看 **Execution log**（执行日志）
3. 应该看到：
   - ✅ **Status**: Success (200)
   - ✅ **Response**: `{"success":true,...}`

### 5.3 验证数据库更新

1. 登录数据库管理工具
2. 查询 `task` 表：
   ```sql
   SELECT ware_sku, count_down, updated_at 
   FROM task 
   ORDER BY updated_at DESC 
   LIMIT 10;
   ```
3. 检查 `updated_at` 是否是最新时间
4. 检查 `count_down` 值是否正确

---

## 🔧 常见问题

### Q1: 收到 401 未授权错误？

**原因**：Secret Key 不匹配

**解决方法**：
1. 检查 Vercel 环境变量 `CRON_SECRET_KEY` 是否正确设置
2. 检查 Cron 任务中的 URL 参数 `secret=` 是否正确
3. 确保已经重新部署项目

### Q2: 收到 500 服务器错误？

**原因**：可能是数据库连接问题

**解决方法**：
1. 查看 Vercel 日志：**Deployments** → 点击部署 → **Functions** → 查看日志
2. 检查数据库连接配置是否正确
3. 检查数据库是否可访问

### Q3: Cron 任务没有执行？

**解决方法**：
1. 检查任务是否已激活（Activated）
2. 检查执行时间设置是否正确
3. 查看 cron-job.org 的执行日志
4. 免费版可能有执行频率限制

### Q4: 如何修改执行频率？

1. 在 cron-job.org 中编辑任务
2. 修改 **Schedule** 设置
3. 保存即可

### Q5: 如何停止定时任务？

1. 在 cron-job.org 中编辑任务
2. 取消勾选 **Activated**
3. 保存即可

---

## 📊 监控和维护

### 定期检查

建议每周检查一次：
1. ✅ Cron 任务是否正常执行
2. ✅ API 响应是否成功
3. ✅ 数据库中的倒计时是否更新

### 查看执行历史

在 cron-job.org 中：
- 点击任务名称
- 查看 **Execution log**
- 可以看到每次执行的：
  - 执行时间
  - 状态（成功/失败）
  - 响应内容
  - 执行耗时

---

## 🎉 完成！

设置完成后，您的倒计时将：
- ✅ 每小时自动更新一次
- ✅ 24 小时不间断运行
- ✅ 完全免费（使用免费 Cron 服务）

---

## 📝 其他免费 Cron 服务推荐

如果 cron-job.org 不适合，可以尝试：

1. **EasyCron**：https://www.easycron.com/
   - 免费版：每天 100 次执行
   - 注册简单

2. **Cronitor**：https://cronitor.io/
   - 免费版：5 个监控任务
   - 有监控和告警功能

3. **GitHub Actions**（如果代码在 GitHub）：
   - 完全免费
   - 需要 GitHub 仓库

---

## 🔒 安全建议

1. **不要将 Secret Key 提交到 Git**
   - 确保 `.env` 在 `.gitignore` 中
   - 只在 Vercel 环境变量中设置

2. **定期更换 Secret Key**
   - 建议每 3-6 个月更换一次
   - 更换后记得更新 Cron 任务中的 URL

3. **监控异常访问**
   - 定期查看 Vercel 日志
   - 如果发现大量未授权请求，考虑更换 Secret Key

---

## 📞 需要帮助？

如果遇到问题：
1. 查看 Vercel 部署日志
2. 查看 cron-job.org 执行日志
3. 检查数据库连接
4. 验证环境变量设置

