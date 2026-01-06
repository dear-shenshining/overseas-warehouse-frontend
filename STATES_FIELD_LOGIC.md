# states 字段存储逻辑说明

## 📋 概述

`states` 字段存储日本邮政追踪信息的状态，用于标识每个单号的当前处理状态。

---

## 🔄 存储逻辑

### 1. 初始状态

**新导入的单号：**
- `states = NULL`（空值）
- 表示尚未进行首次查询

### 2. 查询后的状态更新

#### 情况 1：单号未找到（Not registered）

**触发条件：**
- HTML 响应中包含 `"Your item was not found"`

**存储值：**
```python
states = 'Not registered'
```

**代码位置：**
```python
# japan_post_crawler.py 第 488-491 行
if 'Your item was not found' in raw_html:
    crawler.db_manager.update_search_state(tracking_number, 'Not registered')
```

#### 情况 2：最终配送完成（Final delivery）

**触发条件：**
- 最后一条追踪记录的 `shipping_track_record` 字段包含 `"Final delivery"`

**存储值：**
```python
states = 'Final delivery'
```

**代码位置：**
```python
# japan_post_crawler.py 第 525-526 行
if 'Final delivery' in shipping_record:
    crawler.db_manager.update_search_state(tracking_number, 'Final delivery')
```

#### 情况 3：其他状态（如实存储）

**触发条件：**
- 查询成功，但最后一条记录不是 "Final delivery"

**存储值：**
```python
# 直接存储最后一条记录的 shipping_track_record 值
states = last_record.get('shipping_track_record')
```

**示例值：**
- `"Posting/Collection"` - 收寄
- `"In transit"` - 运输中
- `"Arrival at Post Office"` - 到达邮局
- `"Out for delivery"` - 派送中
- `"Returned to sender"` - 退货给寄件人
- 等等...

**代码位置：**
```python
# japan_post_crawler.py 第 528-529 行
else:
    # 其他情况如实写入该值
    crawler.db_manager.update_search_state(tracking_number, shipping_record)
```

---

## 🎯 状态类型总结

| 状态值 | 含义 | 是否跳过 | 说明 |
|--------|------|---------|------|
| `NULL` | 未查询 | ❌ 不跳过 | 新导入的单号 |
| `Not registered` | 未注册 | ❌ 不跳过 | 单号不存在，但会继续查询 |
| `Final delivery` | 最终配送 | ✅ 跳过 | 已完成，不再查询 |
| `Returned to sender` | 退货 | ✅ 跳过 | 已退货，不再查询 |
| 其他值 | 运输中状态 | ❌ 不跳过 | 如实存储最后一条记录的值 |

---

## 🔍 查询过滤逻辑

### 获取待查询单号

**SQL 查询：**
```sql
SELECT search_num, states
FROM Post_searchs
WHERE states NOT IN ('Final delivery', 'Returned to sender')
   OR states IS NULL
```

**会被跳过的状态：**
- ✅ `Final delivery` - 已完成最终配送
- ✅ `Returned to sender` - 已退货给寄件人

**不会被跳过的状态：**
- 🔄 `NULL` - 空状态（新导入的单号）
- 🔄 `Not registered` - 未注册（会继续查询）
- 🔄 其他状态 - 运输中的各种状态

### 运行时二次检查

即使通过了 SQL 过滤，在处理每个单号时还会再次检查：

```python
# japan_post_crawler.py 第 474-476 行
if states in ('Final delivery', 'Returned to sender'):
    print(f"跳过已完成: {tracking_number} (状态: {states})")
    continue
```

---

## 📊 状态更新流程

```
开始查询单号
    ↓
获取 HTML 响应
    ↓
├── 包含 "Your item was not found" 
│   → states = 'Not registered'
│
├── 解析追踪记录成功
│   ↓
│   获取最后一条记录
│   ↓
│   ├── 包含 "Final delivery"
│   │   → states = 'Final delivery'
│   │
│   └── 其他情况
│       → states = shipping_track_record（最后一条记录的值）
│
└── 查询失败
    → 不更新 states（保持原值）
```

---

## ⚠️ 特殊说明

### Not registered 状态的特殊处理

**与其他跳过状态不同：**
- `Final delivery` 和 `Returned to sender` 一旦设置就会被永久跳过
- `Not registered` **不会被跳过**，系统会继续查询

**原因：**
- 单号可能在导入后的一段时间内被日本邮政系统注册
- 需要持续监控，直到单号被注册或确认为无效

**实际效果：**
- 每次运行爬虫时，`Not registered` 状态的单号都会被重新查询
- 如果单号被注册，状态会更新为实际的追踪状态

---

## 🔧 代码实现位置

### Python 版本（原实现）

**文件：** `海外仓/japan_post_crawler.py`

1. **更新状态方法：** 第 163-180 行
   ```python
   def update_search_state(self, search_num: str, new_state: str)
   ```

2. **状态判断逻辑：** 第 519-529 行
   ```python
   if 'Final delivery' in shipping_record:
       crawler.db_manager.update_search_state(tracking_number, 'Final delivery')
   else:
       crawler.db_manager.update_search_state(tracking_number, shipping_record)
   ```

3. **未注册检测：** 第 488-491 行
   ```python
   if 'Your item was not found' in raw_html:
       crawler.db_manager.update_search_state(tracking_number, 'Not registered')
   ```

### TypeScript 版本（当前实现）

**文件：** `lib/logistics-crawler.ts`

需要确保实现相同的逻辑。

---

## 📝 数据库字段

**表名：** `post_searchs`

**字段：**
- `states VARCHAR(255) DEFAULT NULL`
- 存储状态字符串，可以是：
  - `NULL` - 未查询
  - `'Not registered'` - 未注册
  - `'Final delivery'` - 最终配送
  - `'Returned to sender'` - 退货
  - 其他日本邮政的状态值

---

## 🎯 业务意义

1. **状态跟踪**：清晰了解每个单号的处理状态
2. **效率提升**：避免重复查询已完成的单号
3. **问题识别**：快速识别无效单号和异常情况
4. **数据统计**：为后续分析提供基础数据

---

## 📊 状态统计查询

```sql
-- 查看各状态的分布
SELECT
    states,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM post_searchs), 2) as percentage
FROM post_searchs
GROUP BY states
ORDER BY count DESC;

-- 查看待处理单号数量
SELECT COUNT(*) as pending_count
FROM post_searchs
WHERE states NOT IN ('Final delivery', 'Returned to sender')
   OR states IS NULL;
```

---

## ✅ 总结

**存储逻辑：**
1. 新导入 → `NULL`
2. 查询失败/未找到 → `'Not registered'`
3. 最后一条是 "Final delivery" → `'Final delivery'`
4. 其他情况 → 存储最后一条记录的 `shipping_track_record` 值

**过滤逻辑：**
- 跳过：`Final delivery`、`Returned to sender`
- 不跳过：`NULL`、`Not registered`、其他状态

