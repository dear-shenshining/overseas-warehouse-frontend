-- 修复 post_searchs 表的唯一约束
-- 如果表已存在但没有唯一约束，执行此脚本

-- 方法1：如果 search_num 字段还没有唯一约束，添加唯一约束
DO $$
BEGIN
    -- 检查唯一约束是否存在
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conrelid = 'post_searchs'::regclass 
        AND conname LIKE '%search_num%'
        AND contype = 'u'
    ) THEN
        -- 添加唯一约束
        ALTER TABLE post_searchs 
        ADD CONSTRAINT post_searchs_search_num_key UNIQUE (search_num);
        
        RAISE NOTICE '已添加唯一约束: post_searchs_search_num_key';
    ELSE
        RAISE NOTICE '唯一约束已存在';
    END IF;
END $$;

-- 或者直接执行（如果上面的方法不行）：
-- ALTER TABLE post_searchs ADD CONSTRAINT post_searchs_search_num_key UNIQUE (search_num);

-- 验证约束
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'post_searchs' 
AND constraint_type = 'UNIQUE';

