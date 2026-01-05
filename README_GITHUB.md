# 海外仓前端页面

## 📋 项目简介

这是一个基于 Next.js 的海外仓管理系统前端页面，包含物流管理和滞销库存管理功能。

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- MySQL 5.7+
- Git（用于版本控制）

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd 海外仓前端页面
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   # 复制环境变量模板
   cp .env.example .env
   
   # 编辑 .env 文件，填入你的数据库配置
   ```

4. **创建数据库表**
   - 执行 `sql/` 目录下的 SQL 文件创建所需表结构

5. **启动开发服务器**
   ```bash
   npm run dev
   ```

6. **访问应用**
   打开浏览器访问：http://localhost:3000

## 📁 项目结构

```
├── app/              # Next.js App Router 页面和路由
├── components/       # React 组件
├── lib/             # 工具函数和数据服务
├── sql/             # 数据库 SQL 脚本
├── public/          # 静态资源
└── md/              # 项目文档
```

## 🔧 技术栈

- **框架**: Next.js 16
- **语言**: TypeScript
- **UI组件**: Radix UI + Tailwind CSS
- **数据库**: MySQL
- **Excel处理**: xlsx

## 📝 功能模块

### 1. 海外物流管理
- 物流订单查询和搜索
- 状态筛选和统计
- 数据导出

### 2. 滞销库存管理
- Excel 数据导入
- 库存数据查询和筛选
- 任务管理
- 历史任务记录

## 🔒 安全说明

- 数据库密码等敏感信息请配置在 `.env` 文件中
- `.env` 文件已添加到 `.gitignore`，不会被提交到 Git
- 请勿将包含真实密码的 `.env` 文件提交到代码仓库

## 📄 许可证

[添加你的许可证信息]

