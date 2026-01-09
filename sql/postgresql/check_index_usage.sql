-- ============================================================
-- 查看 post_searchs 表的索引创建情况和使用统计
-- 包括：索引名称、大小、使用次数、读取的元组数等
-- ============================================================

-- 方法一：详细索引信息和使用统计（推荐）
SELECT 
    i.relname AS 索引名称,
    pg_size_pretty(pg_relation_size(i.oid)) AS 索引大小,
    s.idx_scan AS 使用次数,
    s.idx_tup_read AS 读取元组数,
    s.idx_tup_fetch AS 获取元组数,
    CASE 
        WHEN s.idx_scan = 0 THEN '⚠️ 未使用'
        WHEN s.idx_scan < 10 THEN '🔶 使用较少'
        WHEN s.idx_scan < 100 THEN '🔸 使用一般'
        ELSE '✅ 使用频繁'
    END AS 使用状态,
    idx.indexdef AS 索引定义
FROM pg_stat_user_indexes s
JOIN pg_class i ON s.indexrelid = i.oid
JOIN pg_indexes idx ON idx.indexname = i.relname
WHERE s.relname = 'post_searchs'
  AND idx.tablename = 'post_searchs'
ORDER BY 
    CASE 
        WHEN i.relname LIKE 'idx_post_searchs%' THEN 1
        WHEN i.relname LIKE 'idx_ship_date%' THEN 2
        WHEN i.relname LIKE 'idx_%' THEN 3
        ELSE 4
    END,
    s.idx_scan DESC,
    i.relname;

-- ============================================================
-- 方法二：简洁版本（只显示关键信息）
-- ============================================================

SELECT 
    i.relname AS 索引名称,
    pg_size_pretty(pg_relation_size(i.oid)) AS 索引大小,
    s.idx_scan AS 使用次数,
    CASE 
        WHEN s.idx_scan = 0 THEN '⚠️ 未使用'
        WHEN s.idx_scan < 10 THEN '🔶 使用较少'
        WHEN s.idx_scan < 100 THEN '🔸 使用一般'
        ELSE '✅ 使用频繁'
    END AS 使用状态
FROM pg_stat_user_indexes s
JOIN pg_class i ON s.indexrelid = i.oid
WHERE s.relname = 'post_searchs'
ORDER BY s.idx_scan DESC, i.relname;

-- ============================================================
-- 方法三：检查特定索引是否存在
-- ============================================================

SELECT 
    indexname AS 索引名称,
    CASE 
        WHEN indexdef IS NOT NULL THEN '✅ 已创建'
        ELSE '❌ 未创建'
    END AS 状态,
    indexdef AS 索引定义
FROM pg_indexes
WHERE tablename = 'post_searchs'
  AND indexname IN (
    'idx_ship_date',
    'idx_post_searchs_ship_date_id',
    'idx_post_searchs_states_ship_date',
    'idx_post_searchs_ship_date_states',
    'idx_post_searchs_states_ship_date_id',
    'idx_post_searchs_updated_at',
    'idx_search_num',
    'idx_states',
    'idx_transfer_num',
    'idx_order_num'
  )
ORDER BY 
    CASE indexname
        WHEN 'idx_post_searchs_ship_date_id' THEN 1
        WHEN 'idx_ship_date' THEN 2
        WHEN 'idx_post_searchs_states_ship_date' THEN 3
        WHEN 'idx_post_searchs_ship_date_states' THEN 4
        WHEN 'idx_post_searchs_states_ship_date_id' THEN 5
        ELSE 6
    END;

-- ============================================================
-- 方法四：索引使用率统计（按使用次数排序）
-- ============================================================

SELECT 
    'post_searchs' AS 表名,
    i.relname AS 索引名称,
    pg_size_pretty(pg_relation_size(i.oid)) AS 索引大小,
    s.idx_scan AS 使用次数,
    s.idx_tup_read AS 读取元组数,
    s.idx_tup_fetch AS 获取元组数,
    ROUND(
        CASE 
            WHEN pg_stat_get_numscans(s.indexrelid) > 0 
            THEN (s.idx_scan::numeric / NULLIF(pg_stat_get_numscans(s.indexrelid), 0)) * 100
            ELSE 0
        END, 
        2
    ) AS 使用率百分比
FROM pg_stat_user_indexes s
JOIN pg_class i ON s.indexrelid = i.oid
WHERE s.relname = 'post_searchs'
ORDER BY s.idx_scan DESC NULLS LAST;

-- ============================================================
-- 说明
-- ============================================================
-- 1. idx_scan: 索引被扫描的次数（使用次数）
-- 2. idx_tup_read: 通过索引读取的元组数
-- 3. idx_tup_fetch: 通过索引获取的元组数
-- 4. 如果索引刚创建，使用次数可能为 0，这是正常的
-- 5. 使用次数会随着查询的执行而增加
-- 6. 如果索引长期未使用（使用次数为 0），可以考虑删除以节省空间
-- ============================================================

-- ============================================================
-- 重置索引统计信息（可选，用于重新开始统计）
-- ============================================================
-- SELECT pg_stat_reset_single_table_counters('post_searchs'::regclass);
-- 注意：执行此命令会重置该表的所有统计信息，包括索引使用次数

