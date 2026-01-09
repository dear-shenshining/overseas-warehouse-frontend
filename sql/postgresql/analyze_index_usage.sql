-- ============================================================
-- 索引使用情况分析和优化建议
-- ============================================================

-- 1. 查看所有索引的使用情况（按使用次数排序）
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
    CASE 
        -- 日期相关索引
        WHEN i.relname = 'idx_ship_date' THEN '📅 基础日期索引（默认日期范围查询）'
        WHEN i.relname = 'idx_post_searchs_ship_date_id' THEN '📅 日期排序索引（最重要！ORDER BY ship_date DESC）'
        WHEN i.relname = 'idx_post_searchs_states_ship_date' THEN '📅 状态+日期复合索引'
        WHEN i.relname = 'idx_post_searchs_ship_date_states' THEN '📅 日期+状态复合索引'
        WHEN i.relname = 'idx_post_searchs_states_ship_date_id' THEN '📅 状态+日期+ID复合索引'
        
        -- 状态相关索引
        WHEN i.relname = 'idx_states' THEN '📊 状态索引（状态筛选）'
        
        -- 单号相关索引
        WHEN i.relname = 'idx_search_num' THEN '🔍 单号索引（单号查询）'
        WHEN i.relname = 'post_searchs_search_num_key' THEN '🔍 单号唯一约束（最常用）'
        
        -- 转单相关索引
        WHEN i.relname = 'idx_transfer_num' THEN '🔄 转单号索引（转单查询）'
        WHEN i.relname = 'idx_transfer_date' THEN '📅 转单日期索引（未使用）'
        
        -- 其他索引
        WHEN i.relname = 'idx_order_num' THEN '📦 订单号索引'
        WHEN i.relname = 'idx_post_searchs_updated_at' THEN '🕐 更新时间索引（未使用）'
        WHEN i.relname = 'post_searchs_pkey' THEN '🔑 主键索引'
        ELSE '其他索引'
    END AS 索引说明
FROM pg_stat_user_indexes s
JOIN pg_class i ON s.indexrelid = i.oid
WHERE s.relname = 'post_searchs'
ORDER BY s.idx_scan DESC, i.relname;

-- ============================================================
-- 2. 分析：未使用或使用较少的索引
-- ============================================================

SELECT 
    i.relname AS 索引名称,
    pg_size_pretty(pg_relation_size(i.oid)) AS 索引大小,
    s.idx_scan AS 使用次数,
    CASE 
        WHEN s.idx_scan = 0 THEN '❌ 建议删除（未使用）'
        WHEN s.idx_scan < 10 THEN '⚠️ 考虑删除（使用很少）'
        ELSE '✅ 保留'
    END AS 优化建议
FROM pg_stat_user_indexes s
JOIN pg_class i ON s.indexrelid = i.oid
WHERE s.relname = 'post_searchs'
  AND s.idx_scan < 10
ORDER BY pg_relation_size(i.oid) DESC, s.idx_scan;

-- ============================================================
-- 3. 分析：索引效率（读取元组数 / 使用次数）
-- ============================================================

SELECT 
    i.relname AS 索引名称,
    s.idx_scan AS 使用次数,
    s.idx_tup_read AS 读取元组数,
    s.idx_tup_fetch AS 获取元组数,
    CASE 
        WHEN s.idx_scan > 0 
        THEN ROUND(s.idx_tup_read::numeric / s.idx_scan, 2)
        ELSE 0
    END AS 平均每次读取元组数,
    CASE 
        WHEN s.idx_scan > 0 
        THEN ROUND(s.idx_tup_fetch::numeric / s.idx_scan, 2)
        ELSE 0
    END AS 平均每次获取元组数,
    CASE 
        WHEN s.idx_tup_read > 0 
        THEN ROUND((s.idx_tup_fetch::numeric / s.idx_tup_read) * 100, 2)
        ELSE 0
    END AS 获取率百分比
FROM pg_stat_user_indexes s
JOIN pg_class i ON s.indexrelid = i.oid
WHERE s.relname = 'post_searchs'
  AND s.idx_scan > 0
ORDER BY s.idx_scan DESC;

-- ============================================================
-- 4. 索引存储空间统计
-- ============================================================

SELECT 
    'post_searchs' AS 表名,
    COUNT(*) AS 索引总数,
    pg_size_pretty(SUM(pg_relation_size(i.oid))) AS 索引总大小,
    pg_size_pretty(SUM(CASE WHEN s.idx_scan = 0 THEN pg_relation_size(i.oid) ELSE 0 END)) AS 未使用索引大小,
    COUNT(CASE WHEN s.idx_scan = 0 THEN 1 END) AS 未使用索引数量
FROM pg_stat_user_indexes s
JOIN pg_class i ON s.indexrelid = i.oid
WHERE s.relname = 'post_searchs';

-- ============================================================
-- 5. 优化建议总结
-- ============================================================

SELECT 
    '📊 索引使用情况分析' AS 分析项,
    'post_searchs 表' AS 表名,
    COUNT(*) AS 索引总数,
    COUNT(CASE WHEN s.idx_scan > 100 THEN 1 END) AS 使用频繁索引数,
    COUNT(CASE WHEN s.idx_scan BETWEEN 10 AND 100 THEN 1 END) AS 使用一般索引数,
    COUNT(CASE WHEN s.idx_scan < 10 AND s.idx_scan > 0 THEN 1 END) AS 使用较少索引数,
    COUNT(CASE WHEN s.idx_scan = 0 THEN 1 END) AS 未使用索引数,
    pg_size_pretty(SUM(pg_relation_size(i.oid))) AS 索引总大小
FROM pg_stat_user_indexes s
JOIN pg_class i ON s.indexrelid = i.oid
WHERE s.relname = 'post_searchs';

