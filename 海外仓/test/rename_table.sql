-- 将 searchs 表重命名为 Post_searchs
-- 执行前请确保数据库已连接

USE seas_ware;

-- 重命名表
RENAME TABLE searchs TO Post_searchs;

-- 验证重命名结果
SHOW TABLES;

-- 显示新表结构
DESCRIBE Post_searchs;

-- 显示记录数
SELECT COUNT(*) as total_records FROM Post_searchs;
