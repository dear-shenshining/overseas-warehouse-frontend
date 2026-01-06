-- 检查 post_searchs 表的实际字段名
-- PostgreSQL 默认会将字段名转换为小写，除非用双引号创建

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'post_searchs'
ORDER BY ordinal_position;

-- 检查是否有 Ship_date 或 ship_date
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'post_searchs' AND column_name = 'Ship_date') 
        THEN '字段名是 Ship_date（大写 S）'
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'post_searchs' AND column_name = 'ship_date') 
        THEN '字段名是 ship_date（小写 s）'
        ELSE '字段名不存在'
    END as field_status;

