-- 修复所有表的唯一约束
-- 确保所有使用 ON CONFLICT 的表都有正确的唯一约束

-- ============================================
-- 1. 修复 post_searchs 表
-- ============================================
DO $$
BEGIN
    -- 检查是否有重复数据
    IF EXISTS (
        SELECT 1 FROM post_searchs 
        GROUP BY search_num 
        HAVING COUNT(*) > 1
    ) THEN
        RAISE NOTICE '警告：post_searchs 表中有重复的 search_num，需要先清理';
        -- 删除重复数据（保留最新的）
        DELETE FROM post_searchs 
        WHERE id NOT IN (
            SELECT MAX(id) 
            FROM post_searchs 
            GROUP BY search_num
        );
        RAISE NOTICE '已清理重复数据';
    END IF;

    -- 添加唯一约束
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conrelid = 'post_searchs'::regclass 
        AND conname LIKE '%search_num%'
        AND contype = 'u'
    ) THEN
        ALTER TABLE post_searchs 
        ADD CONSTRAINT post_searchs_search_num_key UNIQUE (search_num);
        RAISE NOTICE '✓ 已添加 post_searchs.search_num 唯一约束';
    ELSE
        RAISE NOTICE '✓ post_searchs.search_num 唯一约束已存在';
    END IF;
END $$;

-- ============================================
-- 2. 修复 inventory 表
-- ============================================
DO $$
BEGIN
    -- 检查是否有重复数据
    IF EXISTS (
        SELECT 1 FROM inventory 
        GROUP BY ware_sku 
        HAVING COUNT(*) > 1
    ) THEN
        RAISE NOTICE '警告：inventory 表中有重复的 ware_sku，需要先清理';
        -- 删除重复数据（保留最新的）
        DELETE FROM inventory 
        WHERE id NOT IN (
            SELECT MAX(id) 
            FROM inventory 
            GROUP BY ware_sku
        );
        RAISE NOTICE '已清理重复数据';
    END IF;

    -- 添加唯一约束
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conrelid = 'inventory'::regclass 
        AND conname LIKE '%ware_sku%'
        AND contype = 'u'
    ) THEN
        ALTER TABLE inventory 
        ADD CONSTRAINT inventory_ware_sku_key UNIQUE (ware_sku);
        RAISE NOTICE '✓ 已添加 inventory.ware_sku 唯一约束';
    ELSE
        RAISE NOTICE '✓ inventory.ware_sku 唯一约束已存在';
    END IF;
END $$;

-- ============================================
-- 3. 修复 task 表
-- ============================================
DO $$
BEGIN
    -- 检查是否有重复数据
    IF EXISTS (
        SELECT 1 FROM task 
        GROUP BY ware_sku 
        HAVING COUNT(*) > 1
    ) THEN
        RAISE NOTICE '警告：task 表中有重复的 ware_sku，需要先清理';
        -- 删除重复数据（保留最新的）
        DELETE FROM task 
        WHERE id NOT IN (
            SELECT MAX(id) 
            FROM task 
            GROUP BY ware_sku
        );
        RAISE NOTICE '已清理重复数据';
    END IF;

    -- 添加唯一约束
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conrelid = 'task'::regclass 
        AND conname LIKE '%ware_sku%'
        AND contype = 'u'
    ) THEN
        ALTER TABLE task 
        ADD CONSTRAINT task_ware_sku_key UNIQUE (ware_sku);
        RAISE NOTICE '✓ 已添加 task.ware_sku 唯一约束';
    ELSE
        RAISE NOTICE '✓ task.ware_sku 唯一约束已存在';
    END IF;
END $$;

-- ============================================
-- 4. task_history 表不需要唯一约束
-- ============================================
-- task_history 表允许 ware_sku 重复（一个SKU可以多次完成任务）

-- ============================================
-- 5. per_charge 表（如果存在）
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'per_charge') THEN
        -- 检查是否有重复数据
        IF EXISTS (
            SELECT 1 FROM per_charge 
            GROUP BY sku 
            HAVING COUNT(*) > 1
        ) THEN
            RAISE NOTICE '警告：per_charge 表中有重复的 sku，需要先清理';
            -- 删除重复数据（保留最新的）
            DELETE FROM per_charge 
            WHERE id NOT IN (
                SELECT MAX(id) 
                FROM per_charge 
                GROUP BY sku
            );
            RAISE NOTICE '已清理重复数据';
        END IF;

        -- 添加唯一约束（如果需要）
        -- 注意：per_charge 表可能不需要唯一约束，取决于业务逻辑
        -- IF NOT EXISTS (
        --     SELECT 1 
        --     FROM pg_constraint 
        --     WHERE conrelid = 'per_charge'::regclass 
        --     AND conname LIKE '%sku%'
        --     AND contype = 'u'
        -- ) THEN
        --     ALTER TABLE per_charge 
        --     ADD CONSTRAINT per_charge_sku_key UNIQUE (sku);
        --     RAISE NOTICE '✓ 已添加 per_charge.sku 唯一约束';
        -- END IF;
    ELSE
        RAISE NOTICE 'per_charge 表不存在，跳过';
    END IF;
END $$;

-- ============================================
-- 验证所有约束
-- ============================================
SELECT 
    tc.table_name,
    tc.constraint_name,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
AND tc.constraint_type = 'UNIQUE'
AND tc.table_name IN ('post_searchs', 'inventory', 'task')
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name, tc.constraint_name;

