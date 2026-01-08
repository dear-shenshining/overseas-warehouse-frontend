# 爬虫未找到单号处理说明

## 📋 问题说明

当日本邮政网站返回 "Your item was not found" 错误时，爬虫需要正确处理这种情况，将状态设置为 "Not registered"。

## 🔍 错误信息格式

从日本邮政网站返回的错误信息格式：

```html
<td colspan="5" class="txt_l">
  <font color="ff0000">
    ** Your item was not found. Confirm your item number and ask at your local office.
  </font>
</td>
```

这个错误信息出现在 `table[summary="照会結果"]` 表格中，而不是 `table[summary="履歴情報"]` 表格中。

## ✅ 处理逻辑

### 原 Python 代码逻辑

在 `japan_post_crawler.py` 中：

```python
# 获取原始HTML并保存到返回值文件
raw_html = crawler.fetch_raw_html(tracking_number)
if raw_html:
    crawler.save_raw_html(raw_html, return_filepath)
    print(f"原始HTML已保存到: {return_filepath}")

    # 检查是否为未注册的单号
    if 'Your item was not found' in raw_html:
        print("❌ 发现错误：单号未找到")
        if crawler.db_manager:
            crawler.db_manager.update_search_state(tracking_number, 'Not registered')
        print("\n" + "=" * 50)
        print("查询完成！")
        continue
```

### TypeScript 代码逻辑

在 `lib/logistics-crawler.ts` 中，实现了相同的逻辑：

1. **第一层检查**：在获取 HTML 后立即检查是否包含 "Your item was not found"
   ```typescript
   if (html.includes('Your item was not found')) {
     console.log(`❌ 发现错误：单号未找到 ${trackingNumber}`)
     await updateSearchState(trackingNumber, 'Not registered')
     return null
   }
   ```

2. **第二层检查**：如果解析后没有历史记录，使用 cheerio 检查表格中的错误信息
   ```typescript
   if (!result.history || result.history.length === 0) {
     const $ = cheerio.load(html)
     const resultTable = $('table[summary="照会結果"]')
     if (resultTable.length > 0) {
       const errorText = resultTable.text()
       if (errorText.includes('Your item was not found')) {
         await updateSearchState(trackingNumber, 'Not registered')
         return null
       }
     }
   }
   ```

## 📊 处理流程

```
开始查询追踪号
    ↓
获取 HTML 响应
    ↓
检查是否包含 "Your item was not found"
    ↓ (是)
更新状态为 "Not registered"
    ↓
返回 null（跳过后续处理）
    ↓
结束

    ↓ (否)
解析 HTML 获取历史记录
    ↓
检查是否有历史记录
    ↓ (无记录)
使用 cheerio 检查表格中的错误信息
    ↓ (发现错误)
更新状态为 "Not registered"
    ↓
返回 null
    ↓
结束

    ↓ (有记录)
继续处理历史记录
    ↓
更新状态
    ↓
结束
```

## 🎯 关键点

1. **检查时机**：在获取 HTML 后立即检查，避免不必要的解析
2. **检查文本**：使用 `html.includes('Your item was not found')` 匹配错误信息
3. **状态更新**：将状态设置为 `'Not registered'`，与 Python 代码一致
4. **双重检查**：如果第一层检查未捕获，在解析后再次检查

## 📝 数据库状态

当检测到 "未找到" 错误时：
- `post_searchs.states` 字段更新为 `'Not registered'`
- `post_searchs.updated_at` 字段更新为当前时间戳
- 不会保存到 `tracking_history` 表（因为没有历史记录）

## ✅ 执行结果统计

**重要**：`Not registered` 情况会被计入**成功**统计，而不是失败。

**原因**：
- 我们成功获取了 HTTP 响应
- 我们成功识别了错误状态
- 我们成功更新了数据库状态为 `'Not registered'`

从业务逻辑上看，`Not registered` 是一个有效的状态更新，表示该单号确实不存在于系统中，这是一个有用的信息，不应该被视为失败。

**统计逻辑**：
- ✅ `success++`：正常获取到追踪信息并更新状态，或识别为 `Not registered` 并更新状态
- ❌ `failed++`：网络错误、解析错误、或其他真正的异常情况
- ⏭️ `skipped++`：已完成的单号（`Final delivery` 或 `Returned to sender`）

## 🔄 与 Python 代码的一致性

| 功能 | Python 代码 | TypeScript 代码 | 状态 |
|------|------------|----------------|------|
| 检查错误信息 | `'Your item was not found' in raw_html` | `html.includes('Your item was not found')` | ✅ 一致 |
| 更新状态 | `'Not registered'` | `'Not registered'` | ✅ 一致 |
| 跳过后续处理 | `continue` | `return null` | ✅ 一致 |
| 日志输出 | `print("❌ 发现错误：单号未找到")` | `console.log('❌ 发现错误：单号未找到')` | ✅ 一致 |

## ✅ 测试建议

1. 使用一个不存在的追踪号测试
2. 验证状态是否正确更新为 "Not registered"
3. 验证不会保存到 tracking_history 表
4. 验证日志输出是否正确

---

**更新日期**：2025-01-XX  
**相关文件**：
- `lib/logistics-crawler.ts`
- `海外仓/japan_post_crawler.py`

