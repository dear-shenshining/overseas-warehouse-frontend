-- PostgreSQL 数据导入脚本
-- 在 PostgreSQL 中执行，从 CSV 文件导入数据

-- 注意：先执行建表脚本创建表结构
-- psql -U postgres -d seas_ware -f sql/postgresql/create_*.sql

-- 设置客户端编码
SET client_encoding = 'UTF8';

-- 导入 inventory 表
\copy inventory(id, ware_sku, inventory_num, sales_num, sale_day, charge, label, created_at, updated_at) 
FROM 'C:/temp/inventory.csv' 
WITH (FORMAT csv, HEADER false, DELIMITER ',', NULL '');

-- 导入 post_searchs 表
\copy post_searchs(id, search_num, states, Ship_date, channel, created_at, updated_at) 
FROM 'C:/temp/post_searchs.csv' 
WITH (FORMAT csv, HEADER false, DELIMITER ',', NULL '');

-- 导入 task 表（如果存在）
\copy task(id, ware_sku, inventory_num, sales_num, sale_day, charge, label, promised_land, count_down, created_at, updated_at) 
FROM 'C:/temp/task.csv' 
WITH (FORMAT csv, HEADER false, DELIMITER ',', NULL '');

-- 导入 task_history 表（如果存在）
\copy task_history(id, ware_sku, completed_sale_day, charge, promised_land, completed_at, inventory_num, sales_num, label) 
FROM 'C:/temp/task_history.csv' 
WITH (FORMAT csv, HEADER false, DELIMITER ',', NULL '');

-- 重置序列（确保自增 ID 正确）
SELECT setval('inventory_id_seq', COALESCE((SELECT MAX(id) FROM inventory), 1), true);
SELECT setval('post_searchs_id_seq', COALESCE((SELECT MAX(id) FROM post_searchs), 1), true);
SELECT setval('task_id_seq', COALESCE((SELECT MAX(id) FROM task), 1), true);
SELECT setval('task_history_id_seq', COALESCE((SELECT MAX(id) FROM task_history), 1), true);

-- 验证数据
SELECT 'inventory' as table_name, COUNT(*) as row_count FROM inventory
UNION ALL
SELECT 'post_searchs', COUNT(*) FROM post_searchs
UNION ALL
SELECT 'task', COUNT(*) FROM task
UNION ALL
SELECT 'task_history', COUNT(*) FROM task_history;

