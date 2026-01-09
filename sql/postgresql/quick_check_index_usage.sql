-- ============================================================
-- 快速查看 post_searchs 表的索引使用情况
-- 显示：索引名称、大小、使用次数、使用状态
-- ============================================================

SELECT 
    i.relname AS 索引名称,
    pg_size_pretty(pg_relation_size(i.oid)) AS 索引大小,
    s.idx_scan AS 使用次数,
    s.idx_tup_read AS 读取元组数,
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

