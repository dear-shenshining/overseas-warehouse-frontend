# 无铭图床获取Token指南

## 获取Token的步骤

### 方法一：从个人中心获取（推荐）

1. **访问无铭图床网站**
   - 打开浏览器，访问：https://wmimg.com

2. **登录账号**
   - 点击右上角的"登录"按钮
   - 输入您的账号和密码
   - 账号：`jinyanyan`
   - 密码：`520520325`

3. **进入个人中心**
   - 登录成功后，点击右上角的头像或用户名
   - 或者直接访问：https://wmimg.com/user

4. **查找Token**
   - 在个人中心页面中，找到"API Token"或"接口Token"相关选项
   - Token通常显示在"设置"、"API设置"或"接口配置"等页面
   - Token格式类似：`1|1bJbwlqBfnggmOMEZqXT5XusaIwqiZjCDs7r1Ob5`

5. **复制Token**
   - 点击复制按钮或手动复制Token
   - 注意：Token是敏感信息，请妥善保管，不要泄露

### 方法二：通过浏览器开发者工具获取

如果个人中心没有直接显示Token，可以通过以下方式获取：

1. **登录无铭图床**
   - 使用账号密码登录

2. **打开浏览器开发者工具**
   - 按 `F12` 或右键点击页面选择"检查"
   - 切换到"Network"（网络）标签

3. **访问个人资料页面**
   - 在浏览器中访问：https://wmimg.com/api/v1/profile
   - 查看请求头中的 `Authorization` 字段
   - Token就在 `Bearer` 后面的部分

4. **从Cookie中获取**
   - 在开发者工具的"Application"（应用）标签中
   - 找到"Cookies" → "https://wmimg.com"
   - 查找包含token的cookie值

## 使用Token

### 在项目中使用

1. **通过登录组件设置**
   - 访问 `/image-upload` 页面
   - 点击"登录无铭图床"按钮
   - 选择"手动输入Token"选项卡
   - 粘贴您的Token
   - 点击"设置Token"

2. **通过环境变量设置**
   - 在项目根目录创建 `.env.local` 文件
   - 添加以下内容：
     ```env
     WMIMG_TOKEN=您的Token
     ```
   - 重启开发服务器

3. **通过测试页面验证**
   - 访问 `/test-token` 页面
   - 输入Token并点击"测试Token"
   - 如果显示用户信息，说明Token有效

## Token格式说明

- Token通常是一个长字符串，格式类似：`1|1bJbwlqBfnggmOMEZqXT5XusaIwqiZjCDs7r1Ob5`
- 或者可能是MD5格式：`9b71a65ff526e684a41c10d80d7a2fa5`
- Token用于API请求的身份验证

## API请求示例

使用Token时，需要在请求头中设置：

```http
Authorization: Bearer 您的Token
Accept: application/json
```

例如：

```javascript
fetch('https://wmimg.com/api/v1/profile', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer 您的Token',
    'Accept': 'application/json',
  },
})
```

## 注意事项

1. **Token安全性**
   - Token相当于您的账号密码，请妥善保管
   - 不要将Token提交到公开的代码仓库
   - 如果Token泄露，建议立即在个人中心重新生成

2. **Token有效期**
   - Token通常长期有效，除非您主动删除或重新生成
   - 如果Token失效，需要重新获取

3. **游客上传**
   - 如果不设置Token，上传接口将视为游客上传
   - 游客上传可能受到功能限制

## 常见问题

### Q: 找不到Token在哪里？
A: 如果个人中心没有显示Token，可能是：
- 需要先登录账号
- Token可能在"设置"或"API设置"页面
- 可以尝试通过浏览器开发者工具查看网络请求

### Q: Token格式不对？
A: 确保复制完整的Token，包括所有字符，不要有多余的空格

### Q: Token无效？
A: 检查：
- Token是否完整复制
- Token是否已过期或被删除
- 是否在请求头中正确设置了 `Bearer` 前缀

## 相关链接

- 无铭图床官网：https://wmimg.com
- API文档：https://wmimg.com/page/api-docs.html
- 个人中心：https://wmimg.com/user（需要登录）








