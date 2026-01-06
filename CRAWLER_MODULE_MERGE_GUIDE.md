# 爬虫模块合并指南

## 📋 概述

已将独立的"海外仓"爬虫模块合并到主项目中，并保持模块独立性。所有功能已从 Python 转换为 TypeScript/Next.js，并适配 PostgreSQL 数据库。

---

## ✅ 已完成的工作

### 1. 数据库表结构

- ✅ 创建 `tracking_history` 表的 PostgreSQL 版本
  - 文件：`sql/postgresql/create_tracking_history_table.sql`
  - 用于存储日本邮政追踪历史记录

- ✅ 更新 `post_searchs` 表
  - 添加 `search_num` 的唯一约束（用于导入时的 ON CONFLICT）
  - 文件：`sql/postgresql/create_post_searchs_table.sql`

### 2. 导入功能

- ✅ 创建物流数据导入功能
  - 文件：`lib/logistics-import.ts`
  - 功能：将 Excel 文件中的发货单号、发货日期、发货渠道导入到 `post_searchs` 表
  - 支持：`.xlsx` 和 `.xls` 格式
  - 自动处理：重复单号更新、日期格式转换

- ✅ 创建导入 Server Action
  - 文件：`app/actions/logistics.ts` - `importLogisticsFile`
  - 功能：处理文件上传和导入

### 3. 爬虫功能

- ✅ 创建日本邮政爬虫功能
  - 文件：`lib/logistics-crawler.ts`
  - 功能：
    - 从 `post_searchs` 表读取待查询单号
    - 爬取日本邮政官网的追踪信息
    - 更新 `post_searchs` 表的状态
    - 保存历史记录到 `tracking_history` 表

- ✅ 创建爬虫 Server Action
  - 文件：`app/actions/logistics.ts` - `updateLogisticsStatus`
  - 功能：执行爬虫任务

### 4. 前端界面

- ✅ 在"海外物流管理"页面添加导入按钮
  - 位置：搜索栏右侧，与"导出数据"按钮并列
  - 功能：选择 Excel 文件并导入
  - 显示：导入进度和结果提示

- ✅ 在"海外物流管理"页面添加更新按钮
  - 位置：导入按钮右侧
  - 功能：执行爬虫任务，更新物流状态
  - 显示：更新进度和结果提示

---

## 📁 文件结构

### 新增文件

```
lib/
  ├── logistics-import.ts          # 物流数据导入功能
  └── logistics-crawler.ts        # 日本邮政爬虫功能

sql/postgresql/
  └── create_tracking_history_table.sql  # 追踪历史表

app/actions/
  └── logistics.ts                # 新增导入和爬虫 Server Actions

components/
  └── overseas-logistics.tsx      # 更新：添加导入和更新按钮
```

### 修改文件

- `app/actions/logistics.ts` - 添加 `importLogisticsFile` 和 `updateLogisticsStatus`
- `components/overseas-logistics.tsx` - 添加导入和更新功能
- `sql/postgresql/create_post_searchs_table.sql` - 添加 `search_num` 唯一约束

---

## 🚀 使用说明

### 1. 创建数据库表

在 Neon SQL Editor 中执行：

```sql
-- 1. 确保 post_searchs 表有唯一约束
-- 如果还没有，执行：
ALTER TABLE post_searchs ADD CONSTRAINT post_searchs_search_num_key UNIQUE (search_num);

-- 2. 创建 tracking_history 表
-- 执行 sql/postgresql/create_tracking_history_table.sql
```

### 2. 导入数据

1. 准备 Excel 文件，包含以下列：
   - **发货单号**（必需）
   - **发货日期**（可选）
   - **发货渠道**（可选）

2. 在"海外物流管理"页面：
   - 点击"导入数据"按钮
   - 选择 Excel 文件
   - 等待导入完成
   - 查看导入结果提示

### 3. 更新物流状态（爬虫）

1. 在"海外物流管理"页面：
   - 点击"更新"按钮
   - 等待爬虫执行完成
   - 查看更新结果提示

2. 爬虫会自动：
   - 读取所有待查询的单号（状态不是 "Final delivery" 或 "Returned to sender"）
   - 爬取日本邮政官网的追踪信息
   - 更新单号状态
   - 保存历史记录

---

## 🔄 功能对比

### Python 版本 → TypeScript 版本

| 功能 | Python 文件 | TypeScript 文件 | 说明 |
|------|------------|----------------|------|
| Excel 导入 | `import_orders_auto.py` | `lib/logistics-import.ts` | 功能相同，适配 PostgreSQL |
| 爬虫功能 | `japan_post_crawler.py` | `lib/logistics-crawler.ts` | 功能相同，使用 Next.js Server Actions |
| 数据库操作 | `pymysql` | `pg` (PostgreSQL) | 从 MySQL 转换为 PostgreSQL |

---

## ⚙️ 技术细节

### 导入功能

- **Excel 解析**：使用 `xlsx` 库
- **数据库操作**：使用 PostgreSQL 的 `ON CONFLICT` 语法
- **日期处理**：自动处理 Excel 日期序列号和字符串日期

### 爬虫功能

- **HTTP 请求**：使用 Next.js 的 `fetch` API
- **HTML 解析**：简化版正则表达式解析（可升级为 cheerio）
- **状态更新**：根据最后一条记录判断最终状态
- **错误处理**：自动跳过失败的单号，继续处理其他单号

---

## 📊 数据库表结构

### post_searchs 表

```sql
CREATE TABLE post_searchs (
  id SERIAL PRIMARY KEY,
  search_num VARCHAR(255) NOT NULL UNIQUE,  -- 唯一约束
  states VARCHAR(255) DEFAULT NULL,
  Ship_date TIMESTAMP DEFAULT NULL,
  channel VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### tracking_history 表

```sql
CREATE TABLE tracking_history (
  id SERIAL PRIMARY KEY,
  item_number VARCHAR(50) NOT NULL,          -- 追踪号
  date VARCHAR(50) DEFAULT NULL,
  shipping_track_record VARCHAR(200) DEFAULT NULL,
  details TEXT DEFAULT NULL,
  office VARCHAR(100) DEFAULT NULL,
  zip_code VARCHAR(20) DEFAULT NULL,
  prefecture VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🐛 已知限制

### 爬虫 HTML 解析

当前使用简化版正则表达式解析 HTML，可能不够准确。建议：

1. **升级方案**：安装 `cheerio` 库进行更准确的 HTML 解析
   ```bash
   npm install cheerio
   npm install --save-dev @types/cheerio
   ```

2. **改进解析逻辑**：参考原 Python 代码的 BeautifulSoup 解析逻辑

### 性能考虑

- 爬虫会逐个处理单号，每个单号之间有 1 秒延迟
- 如果单号很多，可能需要较长时间
- 建议：可以添加批量处理或后台任务功能

---

## 🔧 后续优化建议

1. **HTML 解析改进**
   - 使用 `cheerio` 库替代正则表达式
   - 更准确地提取追踪信息

2. **错误处理增强**
   - 添加重试机制
   - 记录失败原因

3. **性能优化**
   - 添加批量处理
   - 使用队列系统

4. **功能扩展**
   - 添加定时任务
   - 添加爬虫日志
   - 添加统计功能

---

## ✅ 验证清单

- [ ] 在 Neon 中创建 `tracking_history` 表
- [ ] 确保 `post_searchs` 表有 `search_num` 唯一约束
- [ ] 测试导入功能（上传 Excel 文件）
- [ ] 测试更新功能（运行爬虫）
- [ ] 验证数据是否正确保存到数据库
- [ ] 检查前端界面是否正常显示

---

## 📝 总结

爬虫模块已成功合并到主项目：

- ✅ 所有功能已从 Python 转换为 TypeScript
- ✅ 数据库操作已从 MySQL 转换为 PostgreSQL
- ✅ 前端界面已集成导入和更新功能
- ✅ 保持模块独立性，代码结构清晰

现在可以在"海外物流管理"页面直接使用导入和更新功能，无需运行独立的 Python 脚本。

