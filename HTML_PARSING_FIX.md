# HTML 解析修复说明

## 问题描述

之前的 HTML 解析逻辑使用简单的正则表达式，导致提取到了错误的位置（如电话号码、邮编等），而不是正确的追踪状态信息。

**错误示例：**
- 状态被错误提取为：`0570-046-666`（电话号码或邮编）

## 解决方案

按照原 Python 代码的精确解析逻辑，使用 `cheerio` 库来解析 HTML 表格。

### 原 Python 逻辑

```python
# 1. 查找 summary='履歴情報' 的表格
history_table = soup.find('table', {'summary': '履歴情報'})

# 2. 找到所有 tr 行，从第 2 行开始（跳过表头）
rows = history_table.find_all('tr')
i = 2  # 跳过表头行

# 3. 检查 rowspan 属性
rowspan = int(date_cell.get('rowspan', 1))

# 4. 如果 rowspan == 2，说明这一行和下一行是一组数据
if rowspan == 2:
    # 第一行：date, track_record, details, office, prefecture
    # 下一行：zip_code
    i += 2  # 跳过两行
```

### 新的 TypeScript 逻辑

已实现相同的解析逻辑，使用 `cheerio` 库：

```typescript
// 1. 查找 summary='履歴情報' 的表格
const historyTable = $('table[summary="履歴情報"]')

// 2. 找到所有 tr 行，从第 2 行开始（跳过表头）
const rows = historyTable.find('tr').toArray()
let i = 2  // 跳过表头行

// 3. 检查 rowspan 属性
const rowspan = parseInt(dateCell.attr('rowspan') || '1', 10)

// 4. 如果 rowspan == 2，说明这一行和下一行是一组数据
if (rowspan === 2) {
    // 第一行：date, track_record, details, office, prefecture
    // 下一行：zip_code
    i += 2  // 跳过两行
}
```

## 安装依赖

需要安装 `cheerio` 和类型定义：

```bash
npm install cheerio @types/cheerio
```

或者如果使用 `package.json` 已更新，直接运行：

```bash
npm install
```

## 字段提取说明

### 正确的字段位置

| 字段 | 位置 | 说明 |
|------|------|------|
| `date` | `cells[0]` | 日期（有 rowspan=2） |
| `shipping_track_record` | `cells[1]` | **追踪状态**（这是我们要的状态字段） |
| `details` | `cells[2]` | 详情 |
| `office` | `cells[3]` | 邮局 |
| `prefecture` | `cells[4]` | 都道府县 |
| `zip_code` | 下一行的 `cells[0]` | 邮编 |

### 之前错误的原因

使用正则表达式匹配所有 `<tr>` 和 `<td>`，没有：
1. 定位到正确的表格（`summary='履歴情報'`）
2. 处理 `rowspan` 属性
3. 正确跳过表头
4. 区分数据行和邮编行

这导致提取到了页面其他位置的电话号码、邮编等信息。

## 验证

修复后，`shipping_track_record` 字段应该包含正确的追踪状态，例如：
- `"Posting/Collection"` - 收寄
- `"In transit"` - 运输中
- `"Arrival at Post Office"` - 到达邮局
- `"Out for delivery"` - 派送中
- `"Final delivery"` - 最终配送
- `"Returned to sender"` - 退货给寄件人

而不是电话号码或邮编。

## 代码位置

- **文件：** `lib/logistics-crawler.ts`
- **函数：** `parseTrackingHTML()`
- **行数：** 第 136-210 行

