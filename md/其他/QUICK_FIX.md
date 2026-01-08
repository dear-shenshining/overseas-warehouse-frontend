# 快速修复指南：TiDB 导入 label 字段错误

## 🚀 快速修复（3步）

### 步骤 1：在 MySQL 中执行修复脚本

在本地 MySQL 中执行：

```sql
-- 修复 inventory 表
UPDATE `inventory` 
SET `label` = NULL 
WHERE `label` = '' OR `label` = 'null' OR TRIM(COALESCE(`label`, '')) = '';

-- 修复 task 表
UPDATE `task` 
SET `label` = NULL 
WHERE `label` = '' OR `label` = 'null' OR TRIM(COALESCE(`label`, '')) = '';

-- 修复 task_history 表（如果存在）
UPDATE `task_history` 
SET `label` = NULL 
WHERE `label` = '' OR `label` = 'null' OR TRIM(COALESCE(`label`, '')) = '';
```

### 步骤 2：验证修复

```sql
-- 检查是否还有空字符串（应该都是 0）
SELECT 
  'inventory' as 表名,
  SUM(CASE WHEN label = '' THEN 1 ELSE 0 END) as 空字符串数量
FROM `inventory`
UNION ALL
SELECT 
  'task' as 表名,
  SUM(CASE WHEN label = '' THEN 1 ELSE 0 END) as 空字符串数量
FROM `task`;
```

如果所有"空字符串数量"都是 0，说明修复成功。

### 步骤 3：重新导入到 TiDB

现在可以安全地导入到 TiDB 了。

---

## 📝 完整 SQL 脚本

也可以直接执行 `sql/fix_label_field_for_tidb.sql` 文件。

---

## ⚠️ 重要提示

- **执行前备份**：建议先备份数据库
- **验证结果**：执行后检查是否还有空字符串
- **重新导入**：修复后需要重新导出并导入到 TiDB

