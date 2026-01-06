-- MySQL 数据导出脚本
-- 在 MySQL 中执行，导出数据为 CSV 格式

USE seas_ware;

-- 导出 inventory 表
SELECT 
    id, ware_sku, inventory_num, sales_num, sale_day, 
    charge, label, created_at, updated_at
FROM inventory
INTO OUTFILE 'C:/temp/inventory.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
ESCAPED BY '\\'
LINES TERMINATED BY '\n';

-- 导出 post_searchs 表
SELECT 
    id, search_num, states, Ship_date, channel, 
    created_at, updated_at
FROM post_searchs
INTO OUTFILE 'C:/temp/post_searchs.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
ESCAPED BY '\\'
LINES TERMINATED BY '\n';

-- 导出 task 表（如果存在）
SELECT 
    id, ware_sku, inventory_num, sales_num, sale_day, 
    charge, label, promised_land, count_down, 
    created_at, updated_at
FROM task
INTO OUTFILE 'C:/temp/task.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
ESCAPED BY '\\'
LINES TERMINATED BY '\n';

-- 导出 task_history 表（如果存在）
SELECT 
    id, ware_sku, completed_sale_day, charge, promised_land, 
    completed_at, inventory_num, sales_num, label
FROM task_history
INTO OUTFILE 'C:/temp/task_history.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
ESCAPED BY '\\'
LINES TERMINATED BY '\n';

