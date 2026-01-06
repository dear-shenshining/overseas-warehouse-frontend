-- 修复 label 字段以兼容 TiDB
-- 将空字符串、无效 JSON 等转换为 NULL
-- 在导入 TiDB 之前，在 MySQL 中执行此脚本

-- 1. 修复 inventory 表的 label 字段
UPDATE `inventory` 
SET `label` = NULL 
WHERE `label` = '' 
   OR `label` = 'null' 
   OR TRIM(COALESCE(`label`, '')) = '';

-- 2. 修复 task 表的 label 字段
UPDATE `task` 
SET `label` = NULL 
WHERE `label` = '' 
   OR `label` = 'null' 
   OR TRIM(COALESCE(`label`, '')) = '';

-- 3. 修复 task_history 表的 label 字段（如果表已存在）
UPDATE `task_history` 
SET `label` = NULL 
WHERE `label` = '' 
   OR `label` = 'null' 
   OR TRIM(COALESCE(`label`, '')) = '';

-- 验证修复结果（检查是否还有空字符串）
SELECT 
  'inventory' as table_name,
  COUNT(*) as total_rows,
  SUM(CASE WHEN label IS NULL THEN 1 ELSE 0 END) as null_labels,
  SUM(CASE WHEN label = '' THEN 1 ELSE 0 END) as empty_string_labels
FROM `inventory`
UNION ALL
SELECT 
  'task' as table_name,
  COUNT(*) as total_rows,
  SUM(CASE WHEN label IS NULL THEN 1 ELSE 0 END) as null_labels,
  SUM(CASE WHEN label = '' THEN 1 ELSE 0 END) as empty_string_labels
FROM `task`
UNION ALL
SELECT 
  'task_history' as table_name,
  COUNT(*) as total_rows,
  SUM(CASE WHEN label IS NULL THEN 1 ELSE 0 END) as null_labels,
  SUM(CASE WHEN label = '' THEN 1 ELSE 0 END) as empty_string_labels
FROM `task_history`;

-- 如果 empty_string_labels 都是 0，说明修复成功，可以安全导入 TiDB
