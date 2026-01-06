# Vercel 自定义域名配置指南

## 🎯 前提条件

在配置自定义域名前，你需要：
1. ✅ 已有一个域名（如：`example.com`）
2. ✅ 域名管理权限（可以修改 DNS 记录）
3. ✅ Vercel 项目已部署成功

---

## 📝 步骤 1：在 Vercel 添加域名

### 1.1 进入项目设置

1. 登录 Vercel：https://vercel.com
2. 进入你的项目：`overseas-warehouse-frontend`
3. 点击顶部菜单 **"Settings"**
4. 左侧菜单选择 **"Domains"**

### 1.2 添加域名

1. 在 **"Domains"** 页面，输入你的域名：
   - **主域名**：`example.com`（例如：`yourdomain.com`）
   - **子域名**：`www.example.com`（可选，推荐同时添加）

2. 点击 **"Add"**

3. Vercel 会显示需要配置的 DNS 记录

---

## 🔧 步骤 2：配置 DNS 记录

Vercel 会显示需要添加的 DNS 记录，通常是：

### 2.1 对于根域名（example.com）

需要添加 **A 记录** 或 **CNAME 记录**：

**选项 A：使用 A 记录（推荐）**
```
类型: A
名称: @ 或 留空
值: 76.76.21.21
TTL: 3600 或 自动
```

**选项 B：使用 CNAME 记录**
```
类型: CNAME
名称: @ 或 留空
值: cname.vercel-dns.com
TTL: 3600 或 自动
```

**注意：** 不是所有域名提供商都支持根域名的 CNAME 记录，如果不支持，使用 A 记录。

### 2.2 对于 www 子域名（www.example.com）

添加 **CNAME 记录**：
```
类型: CNAME
名称: www
值: cname.vercel-dns.com
TTL: 3600 或 自动
```

---

## 🌐 步骤 3：在域名提供商配置 DNS

### 常见域名提供商配置方法

#### 阿里云域名

1. 登录阿里云控制台
2. 进入 **"域名"** → **"域名解析"**
3. 找到你的域名，点击 **"解析设置"**
4. 点击 **"添加记录"**
5. 按照 Vercel 显示的 DNS 记录添加：
   - 类型：A 或 CNAME
   - 主机记录：@（根域名）或 www（子域名）
   - 记录值：Vercel 提供的 IP 或 CNAME
   - TTL：3600
6. 点击 **"确认"**

#### 腾讯云域名

1. 登录腾讯云控制台
2. 进入 **"域名注册"** → **"我的域名"**
3. 找到你的域名，点击 **"解析"**
4. 点击 **"添加记录"**
5. 按照 Vercel 显示的 DNS 记录添加
6. 保存

#### GoDaddy

1. 登录 GoDaddy
2. 进入 **"My Products"** → **"DNS"**
3. 点击 **"Add"** 添加记录
4. 按照 Vercel 显示的 DNS 记录添加
5. 保存

#### Cloudflare

1. 登录 Cloudflare
2. 选择你的域名
3. 进入 **"DNS"** → **"Records"**
4. 点击 **"Add record"**
5. 按照 Vercel 显示的 DNS 记录添加
6. 保存

---

## ⏳ 步骤 4：等待 DNS 生效

DNS 记录生效通常需要：
- **最快**：几分钟
- **一般**：1-24 小时
- **最长**：48 小时

### 检查 DNS 是否生效

在命令行执行：

```bash
# Windows
nslookup yourdomain.com

# 或使用在线工具
# https://dnschecker.org
```

如果返回的 IP 是 Vercel 的 IP（76.76.21.21），说明 DNS 已生效。

---

## ✅ 步骤 5：验证域名

1. 回到 Vercel 的 **"Domains"** 页面
2. 等待 Vercel 自动验证域名（通常几分钟到几小时）
3. 验证成功后，域名状态会显示为 **"Valid Configuration"**

### 如果验证失败

**常见原因：**
- DNS 记录还未生效（等待更长时间）
- DNS 记录配置错误（检查记录值）
- 域名提供商不支持某些记录类型

**解决方案：**
- 检查 DNS 记录是否正确
- 等待更长时间
- 联系域名提供商客服

---

## 🔒 步骤 6：配置 SSL 证书（自动）

Vercel 会自动为你的域名配置 SSL 证书（HTTPS），无需手动操作。

等待几分钟后，你的网站就可以通过 HTTPS 访问了：
- `https://yourdomain.com`
- `https://www.yourdomain.com`

---

## 🌍 步骤 7：配置重定向（可选）

### 7.1 将 www 重定向到根域名

如果你希望 `www.example.com` 自动跳转到 `example.com`：

1. 在 Vercel **"Domains"** 页面
2. 找到 `www.example.com`
3. 点击 **"..."** → **"Remove"**（移除 www 域名）
4. 或者配置重定向规则

### 7.2 将根域名重定向到 www

如果你希望 `example.com` 自动跳转到 `www.example.com`：

在 `next.config.mjs` 中添加重定向配置（如果需要）。

---

## 📋 配置检查清单

- [ ] 域名已在 Vercel 添加
- [ ] DNS 记录已配置
- [ ] DNS 记录已生效（使用 nslookup 检查）
- [ ] Vercel 显示域名验证成功
- [ ] 可以通过域名访问网站
- [ ] HTTPS 证书已自动配置
- [ ] 网站功能正常

---

## 🆘 常见问题

### Q1: DNS 记录添加后，Vercel 仍然显示 "Invalid Configuration"

**解决方案：**
1. 等待更长时间（DNS 传播需要时间）
2. 检查 DNS 记录值是否正确
3. 确认记录类型是否正确（A 或 CNAME）
4. 清除浏览器缓存后重试

### Q2: 域名访问显示 "This site can't be reached"

**解决方案：**
1. 检查 DNS 是否已生效（使用 nslookup）
2. 确认 Vercel 项目已部署成功
3. 检查域名是否正确添加到 Vercel
4. 等待 DNS 完全生效（最多 48 小时）

### Q3: 根域名不支持 CNAME 记录怎么办？

**解决方案：**
- 使用 A 记录，指向 Vercel 的 IP：`76.76.21.21`
- 或者使用域名提供商的别名记录（ALIAS/ANAME）

### Q4: 如何同时支持 www 和根域名？

**解决方案：**
1. 在 Vercel 同时添加两个域名：
   - `example.com`
   - `www.example.com`
2. 分别配置对应的 DNS 记录
3. 两个域名都会指向同一个网站

---

## 📚 参考资源

- Vercel 域名文档：https://vercel.com/docs/concepts/projects/domains
- DNS 检查工具：https://dnschecker.org
- Vercel IP 地址：https://vercel.com/docs/concepts/edge-network/regions

---

## 💡 提示

1. **DNS 传播时间**：通常需要几小时，请耐心等待
2. **SSL 证书**：Vercel 自动配置，无需手动操作
3. **多个域名**：可以添加多个域名指向同一个项目
4. **子域名**：可以添加任意子域名（如：`api.example.com`）

