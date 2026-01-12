-- 删除 orders 表的所有数据
-- 注意：此操作只删除表中的数据记录，表结构和字段名都会保留
-- 警告：此操作会删除表中的所有记录，且不可恢复，执行前请确保已备份数据

-- 方法1：使用 DELETE 删除所有数据（可以回滚，但速度较慢）
-- 只删除数据，表结构和字段名保持不变
DELETE FROM orders;

-- 方法2：使用 TRUNCATE 删除所有数据（速度快，但无法回滚）
-- 只删除数据，表结构和字段名保持不变
-- TRUNCATE TABLE orders;

-- 执行前可以先查看数据量：
-- SELECT COUNT(*) FROM orders;

-- 执行后可以验证数据是否已清空：
-- SELECT COUNT(*) FROM orders;

