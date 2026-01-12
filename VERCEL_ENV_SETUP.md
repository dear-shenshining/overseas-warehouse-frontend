# Vercel 环境变量配置指南

## 在 Vercel 中配置密码环境变量

### 方法一：通过 Vercel Dashboard（推荐）

1. **登录 Vercel**
   - 访问 [https://vercel.com](https://vercel.com)
   - 登录你的账户

2. **进入项目设置**
   - 在 Dashboard 中选择你的项目
   - 点击项目名称进入项目详情页
   - 点击顶部菜单栏的 **Settings**（设置）

3. **打开环境变量设置**
   - 在左侧菜单中找到 **Environment Variables**（环境变量）
   - 点击进入环境变量管理页面

4. **添加环境变量**
   
   需要添加以下三个环境变量：
   
   | 变量名 | 说明 | 示例值 |
   |--------|------|--------|
   | `ADMIN_USERNAME` | 用户名 | `admin` |
   | `FULL_ACCESS_PASSWORD` | 完整权限密码 | `your_full_access_password` |
   | `LIMITED_ACCESS_PASSWORD` | 受限权限密码 | `your_limited_access_password` |
   
   **添加步骤**：
   - 点击 **Add New**（添加新变量）按钮
   - 在 **Key**（键）输入框中输入变量名（如 `ADMIN_USERNAME`）
   - 在 **Value**（值）输入框中输入对应的值（如 `admin`）
   - 选择环境（Environment）：
     - ✅ **Production**（生产环境）
     - ✅ **Preview**（预览环境，可选）
     - ✅ **Development**（开发环境，可选）
   - 点击 **Save**（保存）

5. **重复步骤 4**，添加其他两个环境变量

6. **重新部署**
   - 环境变量添加后，需要重新部署才能生效
   - 方法一：在项目页面点击 **Deployments**（部署），找到最新的部署，点击右侧的 **...** 菜单，选择 **Redeploy**（重新部署）
   - 方法二：推送代码到 Git 仓库，Vercel 会自动触发部署

### 方法二：通过 Vercel CLI

1. **安装 Vercel CLI**（如果还没有安装）
   ```bash
   npm i -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **链接项目**（如果还没有链接）
   ```bash
   vercel link
   ```

4. **添加环境变量**
   ```bash
   # 添加用户名
   vercel env add ADMIN_USERNAME production
   # 输入值：admin（或你想要的用户名）
   
   # 添加完整权限密码
   vercel env add FULL_ACCESS_PASSWORD production
   # 输入值：你的完整权限密码
   
   # 添加受限权限密码
   vercel env add LIMITED_ACCESS_PASSWORD production
   # 输入值：你的受限权限密码
   ```

5. **重新部署**
   ```bash
   vercel --prod
   ```

### 方法三：通过 Vercel API

如果你需要批量管理或自动化配置，可以使用 Vercel API：

```bash
# 设置环境变量
curl -X POST "https://api.vercel.com/v10/projects/{project_id}/env" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "ADMIN_USERNAME",
    "value": "admin",
    "type": "encrypted",
    "target": ["production", "preview", "development"]
  }'
```

## 更新现有环境变量

### 通过 Dashboard

1. 进入 **Settings** > **Environment Variables**
2. 找到要更新的环境变量
3. 点击右侧的 **Edit**（编辑）按钮
4. 修改 **Value**（值）
5. 点击 **Save**（保存）
6. **重新部署**项目使更改生效

### 通过 CLI

```bash
# 删除旧的环境变量
vercel env rm ADMIN_USERNAME production

# 添加新的环境变量
vercel env add ADMIN_USERNAME production
```

## 验证环境变量是否生效

1. **检查部署日志**
   - 在 Vercel Dashboard 中查看部署日志
   - 确认没有环境变量相关的错误

2. **测试登录**
   - 使用完整权限密码登录，应该能看到"每日发货毛利分析"菜单
   - 使用受限权限密码登录，应该看不到"每日发货毛利分析"菜单

3. **查看浏览器控制台**
   - 打开浏览器开发者工具
   - 查看 Application > Cookies
   - 确认 `can_view_profit_analysis` Cookie 的值是否正确

## 安全建议

### 1. 使用强密码

- **完整权限密码**：建议使用至少 16 位字符，包含大小写字母、数字和特殊字符
- **受限权限密码**：建议使用至少 12 位字符

### 2. 定期更换密码

- 建议每 3-6 个月更换一次密码
- 更换后立即更新 Vercel 环境变量并重新部署

### 3. 限制环境变量访问

- 在 Vercel 中，只有项目成员才能查看和修改环境变量
- 确保只有必要的人员有项目访问权限

### 4. 使用 Vercel 的加密存储

- Vercel 会自动加密存储环境变量
- 在生产环境中，环境变量不会暴露在前端代码中

## 常见问题

### Q: 更新环境变量后，为什么没有生效？

**A**: 环境变量更新后需要重新部署才能生效。请执行以下操作：
1. 在 Vercel Dashboard 中触发重新部署
2. 或者推送一个空提交到 Git 仓库触发自动部署

### Q: 如何查看当前的环境变量值？

**A**: 出于安全考虑，Vercel 不会显示已加密的环境变量值。你只能看到变量名，无法查看实际值。

### Q: 可以在代码中直接使用环境变量吗？

**A**: 可以，但需要注意：
- 服务端代码（Server Actions、API Routes）可以直接使用 `process.env.VARIABLE_NAME`
- 客户端代码需要使用 `NEXT_PUBLIC_` 前缀，但**不建议**将密码暴露给客户端

### Q: 如何为不同环境设置不同的密码？

**A**: 在添加环境变量时，可以选择不同的环境（Production、Preview、Development），为每个环境设置不同的值。

## 示例配置

### 生产环境（Production）

```
ADMIN_USERNAME=admin
FULL_ACCESS_PASSWORD=ProdAdmin2024!@#$%^&*
LIMITED_ACCESS_PASSWORD=ProdViewer2024!@#$%^&*
```

### 预览环境（Preview）

```
ADMIN_USERNAME=admin
FULL_ACCESS_PASSWORD=PreviewAdmin2024!@#
LIMITED_ACCESS_PASSWORD=PreviewViewer2024!@#
```

### 开发环境（Development）

```
ADMIN_USERNAME=admin
FULL_ACCESS_PASSWORD=DevAdmin2024!
LIMITED_ACCESS_PASSWORD=DevViewer2024!
```

## 快速检查清单

- [ ] 在 Vercel Dashboard 中添加了 `ADMIN_USERNAME`
- [ ] 在 Vercel Dashboard 中添加了 `FULL_ACCESS_PASSWORD`
- [ ] 在 Vercel Dashboard 中添加了 `LIMITED_ACCESS_PASSWORD`
- [ ] 所有环境变量都选择了正确的环境（Production/Preview/Development）
- [ ] 重新部署了项目
- [ ] 测试了完整权限密码登录
- [ ] 测试了受限权限密码登录
- [ ] 确认菜单显示正确

## 相关文档

- [Vercel 环境变量文档](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js 环境变量文档](https://nextjs.org/docs/basic-features/environment-variables)

