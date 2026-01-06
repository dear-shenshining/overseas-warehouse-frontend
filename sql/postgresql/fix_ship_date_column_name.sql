-- 修复 post_searchs 表的 ship_date 字段名
-- PostgreSQL 默认会将字段名转换为小写，所以 Ship_date 会变成 ship_date

-- 方法 1：如果字段名是 Ship_date（大写），重命名为 ship_date（小写）
DO $$
BEGIN
    -- 检查字段是否存在（大写）
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_searchs' 
        AND column_name = 'Ship_date'
    ) THEN
        -- 重命名字段为小写
        ALTER TABLE post_searchs RENAME COLUMN "Ship_date" TO ship_date;
        RAISE NOTICE '已重命名字段: Ship_date -> ship_date';
    ELSE
        RAISE NOTICE '字段名已经是 ship_date 或不存在';
    END IF;
END $$;

-- 方法 2：如果字段名不存在，添加字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_searchs' 
        AND (column_name = 'ship_date' OR column_name = 'Ship_date')
    ) THEN
        ALTER TABLE post_searchs ADD COLUMN ship_date TIMESTAMP DEFAULT NULL;
        RAISE NOTICE '已添加字段: ship_date';
    END IF;
END $$;

-- 验证字段名
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'post_searchs'
AND (column_name LIKE '%date%' OR column_name LIKE '%Date%')
ORDER BY column_name;

