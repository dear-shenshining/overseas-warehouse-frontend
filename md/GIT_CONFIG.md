# Git 配置指南

## 🔍 问题诊断

如果提示 `'git' 不是内部或外部命令`，说明 Git 可能：
1. 还没有完全安装
2. 安装后没有重启终端
3. 没有添加到系统 PATH 环境变量

## ✅ 解决方案

### 方法 1：重启终端（最简单）

1. **完全关闭当前的 PowerShell 或 CMD 窗口**
2. **重新打开一个新的 PowerShell 或 CMD 窗口**
3. **再次尝试运行 `git --version`**

### 方法 2：检查 Git 安装位置

Git 通常安装在以下位置之一：
- `C:\Program Files\Git\cmd\git.exe`
- `C:\Program Files (x86)\Git\cmd\git.exe`

**手动测试：**
```cmd
"C:\Program Files\Git\cmd\git.exe" --version
```

如果这个命令能运行，说明 Git 已安装，只是没有添加到 PATH。

### 方法 3：手动配置 Git（如果已安装但找不到命令）

如果 Git 已安装但找不到命令，你可以直接编辑配置文件：

**配置文件位置：**
- `C:\Users\Administrator\.gitconfig`

**手动创建或编辑该文件，添加以下内容：**

```ini
[user]
    name = Administrator
    email = 1426225727@qq.com
```

## 📝 配置 Git 的命令（当 Git 可用后）

一旦 Git 命令可以正常使用，运行以下命令：

```cmd
git config --global user.name "Administrator"
git config --global user.email "1426225727@qq.com"
git config --global --list
```

## 🚀 验证配置

配置成功后，运行以下命令验证：

```cmd
git config --global user.name
git config --global user.email
```

应该显示：
```
Administrator
1426225727@qq.com
```

## 📌 下一步

配置好 Git 后，继续按照 `GITHUB_SETUP.md` 的步骤：
1. 创建 GitHub 账户（如果还没有）
2. 创建 GitHub 仓库
3. 初始化本地 Git 仓库
4. 上传代码到 GitHub

## ⚠️ 重要提示

**关于 GitHub 密码：**
- GitHub 现在**不再支持使用账户密码**进行 Git 操作
- 需要使用 **Personal Access Token（个人访问令牌）**
- 你的密码 `Qqq200200!` 用于登录 GitHub 网站，但不能用于 `git push`

**创建 Personal Access Token 的步骤：**
1. 登录 GitHub (https://github.com)
2. 点击右上角头像 → **Settings**
3. 左侧菜单最下方 → **Developer settings**
4. **Personal access tokens** → **Tokens (classic)**
5. 点击 **Generate new token** → **Generate new token (classic)**
6. 填写信息：
   - **Note**: `本地开发`
   - **Expiration**: 选择过期时间（建议 90 天）
   - **Select scopes**: 勾选 `repo`（完整仓库权限）
7. 点击 **Generate token**
8. **复制生成的 token**（只显示一次，请保存好）

**使用 Token：**
- 当执行 `git push` 时：
  - **Username**: `1426225727@qq.com`（你的 GitHub 用户名或邮箱）
  - **Password**: 输入刚才复制的 **Personal Access Token**（不是你的账户密码）

---

## 🆘 如果还是找不到 Git 命令

### 重新安装 Git

1. 访问：https://git-scm.com/download/win
2. 下载最新版本的 Git for Windows
3. 安装时：
   - ✅ 勾选 "Add Git to PATH"（添加到 PATH）
   - ✅ 使用默认安装选项
4. 安装完成后，**重启电脑**（确保环境变量生效）
5. 重新打开终端测试

### 手动添加 Git 到 PATH

1. 找到 Git 安装目录（通常是 `C:\Program Files\Git\cmd`）
2. 右键"此电脑" → **属性** → **高级系统设置** → **环境变量**
3. 在"系统变量"中找到 `Path`，点击"编辑"
4. 点击"新建"，添加 Git 的 cmd 目录路径
5. 点击"确定"保存
6. **重启终端**测试

