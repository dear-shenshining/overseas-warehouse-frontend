# Git 网络连接问题解决方案

## 📋 问题描述

```
致命：无法访问'https://github.com/dear-shenshining/overseas-warehouse-frontend.git/'：
在21054毫秒后连接到github.com端口443失败：无法连接到服务器
```

这是一个网络连接问题，通常是因为无法访问 GitHub 服务器。

---

## 🔧 解决方案

### 方案 1：使用 SSH 代替 HTTPS（推荐）

SSH 连接通常比 HTTPS 更稳定，特别是在网络受限的环境中。

#### 步骤 1：检查是否已有 SSH 密钥

```bash
# 检查是否存在 SSH 密钥
ls -al ~/.ssh
```

如果看到 `id_rsa` 和 `id_rsa.pub`（或 `id_ed25519` 和 `id_ed25519.pub`），说明已有密钥。

#### 步骤 2：如果没有 SSH 密钥，生成一个

```bash
# 生成 SSH 密钥（替换为你的邮箱）
ssh-keygen -t ed25519 -C "1426225727@qq.com"

# 按 Enter 使用默认路径
# 可以设置密码，也可以直接按 Enter 跳过
```

#### 步骤 3：复制公钥

**Windows (PowerShell):**
```powershell
Get-Content ~/.ssh/id_ed25519.pub | Set-Clipboard
```

**或者手动复制：**
```bash
cat ~/.ssh/id_ed25519.pub
# 复制输出的内容
```

#### 步骤 4：将公钥添加到 GitHub

1. 登录 GitHub：https://github.com
2. 点击右上角头像 → **Settings**
3. 左侧菜单 → **SSH and GPG keys**
4. 点击 **New SSH key**
5. **Title**：填写一个名称（如：My Windows PC）
6. **Key**：粘贴刚才复制的公钥
7. 点击 **Add SSH key**

#### 步骤 5：测试 SSH 连接

```bash
ssh -T git@github.com
```

如果看到：
```
Hi dear-shenshining! You've successfully authenticated...
```
说明 SSH 配置成功！

#### 步骤 6：修改远程仓库地址为 SSH

```bash
# 查看当前远程地址
git remote -v

# 修改为 SSH 地址
git remote set-url origin git@github.com:dear-shenshining/overseas-warehouse-frontend.git

# 验证修改
git remote -v
```

现在应该显示：
```
origin  git@github.com:dear-shenshining/overseas-warehouse-frontend.git (fetch)
origin  git@github.com:dear-shenshining/overseas-warehouse-frontend.git (push)
```

#### 步骤 7：重新推送

```bash
git push origin main
# 或
git push origin master
```

---

### 方案 2：配置代理（如果使用代理）

如果你使用代理（VPN、科学上网工具等），需要配置 Git 使用代理。

#### 步骤 1：查看代理端口

通常代理工具会显示端口号，常见的有：
- HTTP 代理：`127.0.0.1:7890` 或 `127.0.0.1:1080`
- SOCKS5 代理：`127.0.0.1:1080`

#### 步骤 2：配置 Git 使用代理

**HTTP/HTTPS 代理：**
```bash
# 设置全局代理（所有仓库）
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# 或者只针对 GitHub
git config --global http.https://github.com.proxy http://127.0.0.1:7890
```

**SOCKS5 代理：**
```bash
git config --global http.proxy socks5://127.0.0.1:1080
git config --global https.proxy socks5://127.0.0.1:1080
```

#### 步骤 3：测试连接

```bash
git push origin main
```

#### 步骤 4：如果不需要代理，取消代理设置

```bash
git config --global --unset http.proxy
git config --global --unset https.proxy
```

---

### 方案 3：使用 GitHub 镜像（临时方案）

如果 GitHub 访问受限，可以使用镜像站点。

#### 使用 Gitee 镜像（需要先同步）

1. 在 Gitee 创建同名仓库
2. 添加 Gitee 为远程仓库：
```bash
git remote add gitee https://gitee.com/你的用户名/overseas-warehouse-frontend.git
git push gitee main
```

#### 使用 GitHub 加速镜像

修改 hosts 文件（需要管理员权限）：

**Windows:**
1. 打开 `C:\Windows\System32\drivers\etc\hosts`（用管理员权限）
2. 添加以下内容：
```
140.82.112.3 github.com
140.82.112.4 github.com
```

**然后刷新 DNS：**
```powershell
ipconfig /flushdns
```

---

### 方案 4：检查网络连接

#### 步骤 1：测试 GitHub 连接

```bash
# 测试 GitHub 是否可访问
ping github.com

# 测试 HTTPS 端口
telnet github.com 443
```

#### 步骤 2：检查防火墙

确保防火墙没有阻止 Git 或端口 443。

#### 步骤 3：检查 DNS

尝试使用其他 DNS 服务器（如 8.8.8.8 或 114.114.114.114）。

---

### 方案 5：增加超时时间

如果网络较慢，可以增加 Git 的超时时间：

```bash
git config --global http.postBuffer 524288000
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999
```

---

## 🚀 快速解决方案（推荐顺序）

1. **首选：使用 SSH**（方案 1）
   - 最稳定，不需要代理
   - 一次配置，长期使用

2. **如果有代理：配置代理**（方案 2）
   - 如果已经在使用 VPN/代理工具

3. **临时方案：使用镜像**（方案 3）
   - 如果 GitHub 完全无法访问

---

## 📝 完整操作示例（SSH 方案）

```bash
# 1. 检查 SSH 密钥
ls ~/.ssh

# 2. 如果没有，生成密钥
ssh-keygen -t ed25519 -C "1426225727@qq.com"
# 按 Enter 使用默认路径和空密码

# 3. 复制公钥（Windows PowerShell）
Get-Content ~/.ssh/id_ed25519.pub | Set-Clipboard

# 4. 在 GitHub 添加 SSH 密钥（网页操作）
# https://github.com/settings/keys

# 5. 测试 SSH 连接
ssh -T git@github.com

# 6. 修改远程地址
git remote set-url origin git@github.com:dear-shenshining/overseas-warehouse-frontend.git

# 7. 验证
git remote -v

# 8. 推送
git push origin main
```

---

## ❓ 常见问题

### Q: SSH 连接也失败怎么办？

A: 检查：
1. SSH 密钥是否正确添加到 GitHub
2. 网络是否允许 SSH 连接（端口 22）
3. 尝试使用 HTTPS over SSH（端口 443）

### Q: 如何查看 Git 配置？

```bash
# 查看所有配置
git config --list

# 查看特定配置
git config --global http.proxy
```

### Q: 如何取消所有代理设置？

```bash
git config --global --unset http.proxy
git config --global --unset https.proxy
git config --global --unset http.https://github.com.proxy
```

---

## 🔍 诊断命令

如果问题仍然存在，运行以下命令收集信息：

```bash
# 1. 检查 Git 配置
git config --list

# 2. 检查远程地址
git remote -v

# 3. 测试网络连接
ping github.com
ping 140.82.112.3

# 4. 测试 HTTPS 连接
curl -I https://github.com

# 5. 查看详细错误信息
GIT_CURL_VERBOSE=1 GIT_TRACE=1 git push origin main
```

---

**推荐：优先使用 SSH 方案，这是最稳定和安全的解决方案！** 🎯

