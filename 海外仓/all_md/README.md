# 海外仓爬虫系统

一个简化的爬虫系统：从数据库读取单号 → 进行爬虫 → 写入数据库结果。

## 📁 文件说明

- `japan_post_crawler.py` - 核心爬虫代码
- `db_config.json` - 数据库配置文件
- `requirements.txt` - Python依赖包
- `run_crawler.py` - 运行爬虫脚本
- `import_orders.py` - Excel导入脚本（带确认）
- `import_orders_auto.py` - Excel自动导入脚本（无需确认）
- `fix_database.py` - 数据库表结构修复脚本

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置数据库

编辑 `db_config.json`：

```json
{
  "host": "localhost",
  "port": 3306,
  "user": "root",
  "password": "你的密码",
  "database": "seas_ware",
  "charset": "utf8mb4"
}
```

### 3. 导入单号数据

将 `待查询订单.xlsx` 文件放在项目目录，然后运行导入：

```bash
# 自动导入（推荐）
python import_orders_auto.py

### 4. 运行爬虫

```bash
python run_crawler.py
```

或者直接运行：

```bash
python japan_post_crawler.py
```

## 🔄 工作流程

1. **导入单号**：将Excel文件中的发货单号和发货日期导入 `Post_searchs` 表的 `search_num` 和 `Ship_date` 字段
2. **读取单号**：从 `Post_searchs` 表的 `search_num` 字段读取待查询的追踪号
3. **过滤状态**：跳过状态为 "Final delivery" 或 "Returned to sender" 的记录（"Not registered" 状态会继续查询）
4. **执行爬虫**：调用日本邮政官网API获取追踪信息
5. **写入结果**：将结果保存到 `tracking_history` 表
6. **更新状态**：根据查询结果更新单号状态
   - HTML包含 "Your item was not found" → 状态设为 "Not registered"
   - 最后一条记录包含 "Final delivery" → 状态设为 "Final delivery"
   - 最后一条记录包含 "Returned to sender" → 状态设为 "Returned to sender"
7. **失败重试**：对查询失败的单号进行自动重试，确保每个失败单号都被重新查询一次

## 📊 数据表结构

### Post_searchs 表（输入）
- `search_num` - 发货单号（用作追踪号）
- `Ship_date` - 发货日期
- `states` - 状态（用于过滤已完成的记录）

### tracking_history 表（输出）
- 追踪历史记录

## ⚙️ 配置说明

- **数据库**：需要MySQL数据库，字符集utf8mb4
- **网络**：需要访问日本邮政官网
- **权限**：数据库用户需要读写权限

## 🐛 故障排除

### 数据库问题
- 检查 `db_config.json` 配置是否正确
- 确认数据库服务正在运行
- 如遇到表结构错误，运行 `python fix_database.py`

### Excel导入问题
- 确保 `待查询订单.xlsx` 文件存在且格式正确
- Excel文件必须包含"发货单号"和"发货日期"两列
- 发货单号列必须包含有效的单号，发货日期列为可选
- 如果导入失败，检查数据库表结构

### 爬虫问题
- 验证网络连接是否正常
- 检查日本邮政官网是否可以访问
- 查看控制台错误信息

### 其他问题
- 确保所有依赖包已正确安装
- 检查Python版本（推荐3.8+）
- 查看错误日志获取详细诊断信息