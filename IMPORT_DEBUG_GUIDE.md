# 导入功能调试指南

## 🔍 问题诊断

如果导入显示"跳过所有记录"，请按以下步骤检查：

### 1. 查看服务器日志

在运行 `npm run dev` 的终端中，查看错误信息：

- 批量导入失败的错误
- 逐条插入时的错误详情
- 每条记录的具体错误消息

### 2. 检查数据库表结构

确保 `post_searchs` 表有正确的唯一约束：

```sql
-- 检查唯一约束是否存在
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'post_searchs' 
AND constraint_type = 'UNIQUE';

-- 如果没有，添加唯一约束
ALTER TABLE post_searchs ADD CONSTRAINT post_searchs_search_num_key UNIQUE (search_num);
```

### 3. 检查数据格式

确保 Excel 文件中的：
- **发货单号**列存在且不为空
- 发货单号格式正确（字符串或数字）
- 发货日期格式正确（如果存在）
- 发货渠道格式正确（如果存在）

### 4. 常见错误

#### 错误：duplicate key value violates unique constraint
- **原因**：`search_num` 唯一约束冲突
- **解决**：确保 `ON CONFLICT` 语法正确

#### 错误：syntax error at or near "$"
- **原因**：参数绑定问题
- **解决**：检查参数数量和占位符是否匹配

#### 错误：column "xxx" does not exist
- **原因**：表结构不匹配
- **解决**：检查表结构是否正确

### 5. 测试单个记录

可以手动测试单个记录的插入：

```sql
INSERT INTO post_searchs (search_num, Ship_date, channel)
VALUES ('TEST001', '2024-01-01', '渠道A')
ON CONFLICT (search_num) 
DO UPDATE SET
  Ship_date = EXCLUDED.Ship_date,
  channel = EXCLUDED.channel,
  updated_at = CURRENT_TIMESTAMP;
```

### 6. 检查连接

确保数据库连接正常：

```typescript
// 在 lib/logistics-import.ts 中添加测试
console.log('数据库连接测试...')
const test = await query('SELECT 1')
console.log('连接成功:', test)
```

## 📝 下一步

如果问题仍然存在，请提供：
1. 服务器终端的完整错误日志
2. 浏览器控制台的错误信息
3. Excel 文件的列名和数据示例（脱敏后）

