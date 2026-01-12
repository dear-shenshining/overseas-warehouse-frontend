# 权限系统说明

## 概述

系统支持两套密码，用于控制"每日发货毛利分析"页面的访问权限：

1. **完整权限密码**：可以查看"每日发货毛利分析"和"每日发货毛利异常"
2. **受限权限密码**：只能查看"每日发货毛利异常"，不能查看"每日发货毛利分析"

## 环境变量配置

### 本地开发环境

在 `.env.local` 或 `.env` 文件中配置以下环境变量：

```env
# 用户名（两套密码使用相同的用户名）
ADMIN_USERNAME=admin

# 完整权限密码（可以查看"每日发货毛利分析"和"每日发货毛利异常"）
FULL_ACCESS_PASSWORD=admin123

# 受限权限密码（只能查看"每日发货毛利异常"）
LIMITED_ACCESS_PASSWORD=viewer123
```

### Vercel 部署环境

如果使用 Vercel 部署，需要在 Vercel Dashboard 中配置环境变量。详细步骤请参考 [VERCEL_ENV_SETUP.md](./VERCEL_ENV_SETUP.md)。

**快速步骤**：
1. 登录 Vercel Dashboard
2. 选择项目 > Settings > Environment Variables
3. 添加以下三个环境变量：
   - `ADMIN_USERNAME`
   - `FULL_ACCESS_PASSWORD`
   - `LIMITED_ACCESS_PASSWORD`
4. 重新部署项目

## 默认密码

如果不配置环境变量，系统将使用以下默认值：

- **用户名**：`admin`
- **完整权限密码**：`admin123`
- **受限权限密码**：`viewer123`

## 权限说明

### 完整权限（FULL_ACCESS_PASSWORD）

使用完整权限密码登录后，用户可以：
- ✅ 查看"每日发货毛利分析"
- ✅ 查看"每日发货毛利异常"
- ✅ 访问所有其他功能模块

### 受限权限（LIMITED_ACCESS_PASSWORD）

使用受限权限密码登录后，用户可以：
- ❌ 不能查看"每日发货毛利分析"（菜单项不显示）
- ✅ 可以查看"每日发货毛利异常"
- ✅ 访问所有其他功能模块

## 安全建议

1. **生产环境**：务必修改默认密码，使用强密码
2. **环境变量**：不要将 `.env` 文件提交到版本控制系统
3. **密码强度**：建议使用至少 12 位字符，包含大小写字母、数字和特殊字符
4. **定期更换**：建议定期更换密码

## 示例配置

### 开发环境（.env.local）

```env
ADMIN_USERNAME=admin
FULL_ACCESS_PASSWORD=DevAdmin2024!
LIMITED_ACCESS_PASSWORD=DevViewer2024!
```

### 生产环境（.env.production）

```env
ADMIN_USERNAME=admin
FULL_ACCESS_PASSWORD=ProdAdmin2024!@#
LIMITED_ACCESS_PASSWORD=ProdViewer2024!@#
```

## 功能说明

### 登录流程

1. 用户输入用户名和密码
2. 系统验证用户名和密码
3. 根据密码类型设置权限
4. 权限信息存储在 Cookie 中（30 天有效期）

### 权限控制

- 权限信息存储在 `can_view_profit_analysis` Cookie 中
- 前端根据此 Cookie 控制菜单显示和页面访问
- 如果用户没有权限但尝试访问分析页面，系统会自动重定向到异常页面

### 登出

登出时会清除所有 Cookie，包括：
- `session_token`
- `username`
- `can_view_profit_analysis`

## 故障排查

### 问题：登录后看不到"每日发货毛利分析"菜单

**可能原因**：
1. 使用了受限权限密码
2. Cookie 未正确设置
3. 浏览器 Cookie 被清除

**解决方法**：
1. 确认使用的是完整权限密码
2. 清除浏览器 Cookie 后重新登录
3. 检查浏览器控制台是否有错误

### 问题：登录后仍然可以看到"每日发货毛利分析"

**可能原因**：
1. 之前使用完整权限密码登录，Cookie 未过期
2. 浏览器缓存了旧的 Cookie

**解决方法**：
1. 清除浏览器 Cookie
2. 重新登录
3. 确认使用的是受限权限密码

## 技术实现

### 后端（app/actions/auth.ts）

- `login()` 函数：验证密码并设置权限
- `checkAuth()` 函数：检查认证状态和权限
- `logout()` 函数：清除所有 Cookie

### 前端（app/page.tsx）

- 从 Cookie 读取权限信息
- 根据权限控制菜单显示
- 根据权限控制页面内容显示
- 自动重定向到有权限的页面

## 更新日志

- **2024-12-XX**：初始版本，支持两套密码权限系统

