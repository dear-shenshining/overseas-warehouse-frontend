# GitHub 上传指南

## 📋 前置检查清单

### ✅ 1. 安装 Git

**Windows 系统：**

1. 访问 Git 官网：https://git-scm.com/download/win
2. 下载 Windows 版本的 Git 安装程序
3. 运行安装程序，一路点击"下一步"（使用默认设置即可）
4. 安装完成后，**重启 PowerShell 或命令提示符**

**验证安装：**
```bash
git --version
```
如果显示版本号（如 `git version 2.xx.x`），说明安装成功。

---

### ✅ 2. 配置 Git 用户信息

首次使用 Git 需要配置你的用户名和邮箱：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"
```

**示例：**
```bash
git config --global user.name "张三"
git config --global user.email "zhangsan@example.com"
```

---

### ✅ 3. 创建 GitHub 账户

1. 访问 https://github.com
2. 点击右上角 "Sign up" 注册账户
3. 完成邮箱验证

---

### ✅ 4. 创建 GitHub 仓库

1. 登录 GitHub
2. 点击右上角 "+" 号，选择 "New repository"
3. 填写仓库信息：
   - **Repository name**: `overseas-warehouse-frontend`（或你喜欢的名字）
   - **Description**: 海外仓前端页面
   - **Visibility**: 选择 Public（公开）或 Private（私有）
   - **不要勾选** "Initialize this repository with a README"（我们已经有了代码）
4. 点击 "Create repository"

---

## 🚀 上传代码到 GitHub

### 步骤 1: 初始化 Git 仓库

在项目根目录（`C:\Users\Administrator\Desktop\海外仓前端页面`）打开 PowerShell，执行：

```bash
# 初始化 Git 仓库
git init

# 添加所有文件到暂存区
git add .

# 提交代码（第一次提交）
git commit -m "Initial commit: 海外仓前端页面"
```

### 步骤 2: 连接到 GitHub 仓库

```bash
# 添加远程仓库地址（将 YOUR_USERNAME 替换为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/overseas-warehouse-frontend.git

# 查看远程仓库配置（确认添加成功）
git remote -v
```

### 步骤 3: 上传代码

```bash
# 推送到 GitHub（第一次推送）
git branch -M main
git push -u origin main
```

**注意：** 如果提示需要登录，GitHub 现在要求使用 Personal Access Token（个人访问令牌）而不是密码。

#### 创建 Personal Access Token：

1. 登录 GitHub
2. 点击右上角头像 → **Settings**
3. 左侧菜单最下方 → **Developer settings**
4. 点击 **Personal access tokens** → **Tokens (classic)**
5. 点击 **Generate new token** → **Generate new token (classic)**
6. 填写信息：
   - **Note**: `本地开发`（描述用途）
   - **Expiration**: 选择过期时间（建议 90 天或 No expiration）
   - **Select scopes**: 勾选 `repo`（完整仓库权限）
7. 点击 **Generate token**
8. **复制生成的 token**（只显示一次，请保存好）

#### 使用 Token 登录：

当执行 `git push` 时：
- **Username**: 输入你的 GitHub 用户名
- **Password**: 输入刚才复制的 Personal Access Token（不是你的 GitHub 密码）

---

## 📝 后续更新代码

以后修改代码后，使用以下命令更新到 GitHub：

```bash
# 1. 查看修改的文件
git status

# 2. 添加修改的文件
git add .

# 3. 提交修改（写清楚修改内容）
git commit -m "描述你的修改内容"

# 4. 推送到 GitHub
git push
```

---

## ⚠️ 重要提示

### 1. 敏感信息保护

✅ **已完成：**
- 数据库配置已改为从环境变量读取
- `.env` 文件已添加到 `.gitignore`
- 创建了 `.env.example` 作为模板

⚠️ **请确认：**
- 检查 `lib/db.ts` 中是否还有硬编码的密码（应该已经改为环境变量）
- 确保 `.env` 文件不会被提交（已在 `.gitignore` 中）

### 2. 检查敏感文件

在上传前，检查以下文件是否包含敏感信息：

```bash
# 检查是否有硬编码的密码
grep -r "password" --include="*.ts" --include="*.tsx" --include="*.js" lib/ app/
```

---

## 🆘 常见问题

### Q1: `git push` 提示 "Authentication failed"

**解决方案：**
- 确认使用的是 Personal Access Token 而不是密码
- Token 需要有 `repo` 权限
- 检查 Token 是否过期

### Q2: `git push` 提示 "remote: Repository not found"

**解决方案：**
- 检查仓库地址是否正确
- 确认仓库名称拼写无误
- 确认你有该仓库的访问权限

### Q3: 如何修改远程仓库地址？

```bash
# 查看当前远程地址
git remote -v

# 修改远程地址
git remote set-url origin https://github.com/YOUR_USERNAME/NEW_REPO_NAME.git
```

### Q4: 忘记提交 `.env` 文件怎么办？

如果已经提交了包含敏感信息的文件：

```bash
# 1. 从 Git 历史中删除文件（但保留本地文件）
git rm --cached .env

# 2. 提交删除操作
git commit -m "Remove .env file from repository"

# 3. 推送到 GitHub
git push
```

---

## 📚 参考资源

- Git 官方文档：https://git-scm.com/doc
- GitHub 帮助文档：https://docs.github.com
- Personal Access Token 创建：https://github.com/settings/tokens

---

## ✅ 完成检查清单

- [ ] Git 已安装并配置
- [ ] GitHub 账户已创建
- [ ] GitHub 仓库已创建
- [ ] 代码已提交到本地 Git
- [ ] 代码已推送到 GitHub
- [ ] 确认 `.env` 文件未被提交
- [ ] 确认敏感信息已移除

完成以上所有步骤后，你的代码就成功上传到 GitHub 了！🎉

