-- ============================================================
-- 检查索引创建状态和进度
-- 在创建索引时，可以在另一个查询窗口中执行这些查询
-- ============================================================

-- ============================================================
-- 方法一：查看索引是否已创建成功
-- ============================================================

-- 查看 inventory 表的所有索引
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'inventory'
  AND indexname LIKE 'idx_inventory%'
ORDER BY indexname;

-- 如果看到以下 3 个索引，说明创建成功：
-- - idx_inventory_label_gin
-- - idx_inventory_updated_at_id
-- - idx_inventory_ware_sku

-- ============================================================
-- 方法二：查看正在创建的索引（如果使用 CONCURRENTLY）
-- ============================================================

-- 查看当前正在执行的索引创建操作
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    state,
    query
FROM pg_stat_activity
WHERE query LIKE '%CREATE INDEX%'
  AND state = 'active'
ORDER BY query_start;

-- 说明：
-- - 如果有结果，说明索引还在创建中
-- - duration 列显示已执行的时间
-- - 如果没有结果，说明索引创建已完成或未开始

-- ============================================================
-- 方法三：查看索引创建进度（PostgreSQL 12+）
-- ============================================================

-- 查看索引创建进度（百分比）
SELECT 
    pid,
    datname,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    query,
    pg_size_pretty(pg_relation_size('inventory')) as table_size
FROM pg_stat_progress_create_index
JOIN pg_stat_activity USING (pid);

-- 说明：
-- - 这个查询只在 PostgreSQL 12+ 版本有效
-- - 可以显示索引创建的详细进度

-- ============================================================
-- 方法四：检查索引是否可用
-- ============================================================

-- 查看索引的详细信息，包括大小
SELECT 
    i.relname AS index_name,
    pg_size_pretty(pg_relation_size(i.oid)) AS index_size,
    idx_scan AS times_used,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes s
JOIN pg_class i ON s.indexrelid = i.oid
WHERE s.relname = 'inventory'
  AND i.relname LIKE 'idx_inventory%'
ORDER BY i.relname;

-- 说明：
-- - index_size：索引占用的空间大小
-- - times_used：索引被使用的次数（创建后为 0，使用后会增加）
-- - 如果能看到索引且 index_size > 0，说明索引创建成功

-- ============================================================
-- 方法五：测试索引是否生效
-- ============================================================

-- 使用 EXPLAIN 查看查询计划，确认使用了索引
EXPLAIN ANALYZE
SELECT COUNT(*) FROM inventory WHERE label::jsonb @> '[4]'::jsonb;

-- 说明：
-- - 如果看到 "Index Scan using idx_inventory_label_gin"，说明索引已生效
-- - 如果看到 "Seq Scan"（顺序扫描），说明索引未创建或未生效

-- ============================================================
-- 快速检查脚本（推荐）
-- ============================================================

-- 一键检查所有索引状态（inventory 表）
SELECT 
    'inventory' AS 表名,
    CASE 
        WHEN indexname = 'idx_inventory_label_gin' THEN '✅ GIN 索引（最重要）'
        WHEN indexname = 'idx_inventory_updated_at_id' THEN '✅ 排序索引'
        WHEN indexname = 'idx_inventory_ware_sku' THEN '✅ SKU 索引'
        ELSE '其他索引'
    END AS 索引说明,
    indexname AS 索引名称,
    CASE 
        WHEN indexdef IS NOT NULL THEN '✅ 已创建'
        ELSE '❌ 未创建'
    END AS 状态
FROM pg_indexes
WHERE tablename = 'inventory'
  AND indexname IN (
    'idx_inventory_label_gin',
    'idx_inventory_updated_at_id',
    'idx_inventory_ware_sku'
  )
ORDER BY 
    CASE indexname
        WHEN 'idx_inventory_label_gin' THEN 1
        WHEN 'idx_inventory_updated_at_id' THEN 2
        WHEN 'idx_inventory_ware_sku' THEN 3
    END

UNION ALL

-- 一键检查所有索引状态（task 表）
SELECT 
    'task' AS 表名,
    CASE 
        WHEN indexname = 'idx_task_label_gin' THEN '✅ GIN 索引（最重要）'
        WHEN indexname = 'idx_task_ware_sku' THEN '✅ SKU 索引'
        WHEN indexname = 'idx_task_promised_land' THEN '✅ 状态索引'
        WHEN indexname = 'idx_task_charge' THEN '✅ 负责人索引'
        WHEN indexname = 'idx_task_created_at' THEN '✅ 创建时间索引'
        WHEN indexname = 'idx_task_updated_at_id' THEN '✅ 排序索引'
        WHEN indexname = 'idx_task_promised_land_charge' THEN '✅ 复合索引'
        ELSE '其他索引'
    END AS 索引说明,
    indexname AS 索引名称,
    CASE 
        WHEN indexdef IS NOT NULL THEN '✅ 已创建'
        ELSE '❌ 未创建'
    END AS 状态
FROM pg_indexes
WHERE tablename = 'task'
  AND indexname IN (
    'idx_task_label_gin',
    'idx_task_ware_sku',
    'idx_task_promised_land',
    'idx_task_charge',
    'idx_task_created_at',
    'idx_task_updated_at_id',
    'idx_task_promised_land_charge'
  )
ORDER BY 
    CASE indexname
        WHEN 'idx_task_label_gin' THEN 1
        WHEN 'idx_task_ware_sku' THEN 2
        WHEN 'idx_task_promised_land' THEN 3
        WHEN 'idx_task_charge' THEN 4
        WHEN 'idx_task_created_at' THEN 5
        WHEN 'idx_task_updated_at_id' THEN 6
        WHEN 'idx_task_promised_land_charge' THEN 7
    END

UNION ALL

-- 一键检查所有索引状态（task_history 表）
SELECT 
    'task_history' AS 表名,
    CASE 
        WHEN indexname = 'idx_task_history_ware_sku' THEN '✅ SKU 索引'
        WHEN indexname = 'idx_task_history_charge' THEN '✅ 负责人索引'
        WHEN indexname = 'idx_task_history_promised_land' THEN '✅ 方案索引'
        WHEN indexname = 'idx_task_history_completed_at' THEN '✅ 完成时间索引（最重要）'
        WHEN indexname = 'idx_task_history_label_gin' THEN '✅ GIN 索引'
        WHEN indexname = 'idx_task_history_completed_at_promised_land' THEN '✅ 复合索引1'
        WHEN indexname = 'idx_task_history_charge_completed_at' THEN '✅ 复合索引2'
        ELSE '其他索引'
    END AS 索引说明,
    indexname AS 索引名称,
    CASE 
        WHEN indexdef IS NOT NULL THEN '✅ 已创建'
        ELSE '❌ 未创建'
    END AS 状态
FROM pg_indexes
WHERE tablename = 'task_history'
  AND indexname IN (
    'idx_task_history_ware_sku',
    'idx_task_history_charge',
    'idx_task_history_promised_land',
    'idx_task_history_completed_at',
    'idx_task_history_label_gin',
    'idx_task_history_completed_at_promised_land',
    'idx_task_history_charge_completed_at'
  )
ORDER BY 
    CASE indexname
        WHEN 'idx_task_history_completed_at' THEN 1
        WHEN 'idx_task_history_label_gin' THEN 2
        WHEN 'idx_task_history_ware_sku' THEN 3
        WHEN 'idx_task_history_charge' THEN 4
        WHEN 'idx_task_history_promised_land' THEN 5
        WHEN 'idx_task_history_completed_at_promised_land' THEN 6
        WHEN 'idx_task_history_charge_completed_at' THEN 7
    END

UNION ALL

-- 一键检查所有索引状态（post_searchs 表）
SELECT 
    'post_searchs' AS 表名,
    CASE 
        WHEN indexname = 'idx_post_searchs_ship_date_id' THEN '✅ 排序索引（最重要）'
        WHEN indexname = 'idx_post_searchs_states_ship_date' THEN '✅ 复合索引1（状态+日期）'
        WHEN indexname = 'idx_post_searchs_ship_date_states' THEN '✅ 复合索引2（日期+状态）'
        WHEN indexname = 'idx_post_searchs_updated_at' THEN '✅ 更新时间索引'
        WHEN indexname = 'idx_post_searchs_states_ship_date_id' THEN '✅ 复合索引3（状态+日期+ID）'
        WHEN indexname = 'idx_search_num' THEN '✅ 单号索引（基础）'
        WHEN indexname = 'idx_states' THEN '✅ 状态索引（基础）'
        WHEN indexname = 'idx_ship_date' THEN '✅ 发货日期索引（基础）'
        WHEN indexname = 'idx_transfer_num' THEN '✅ 转单号索引（基础）'
        WHEN indexname = 'idx_order_num' THEN '✅ 订单号索引（基础）'
        ELSE '其他索引'
    END AS 索引说明,
    indexname AS 索引名称,
    CASE 
        WHEN indexdef IS NOT NULL THEN '✅ 已创建'
        ELSE '❌ 未创建'
    END AS 状态
FROM pg_indexes
WHERE tablename = 'post_searchs'
  AND indexname IN (
    'idx_post_searchs_ship_date_id',
    'idx_post_searchs_states_ship_date',
    'idx_post_searchs_ship_date_states',
    'idx_post_searchs_updated_at',
    'idx_post_searchs_states_ship_date_id',
    'idx_search_num',
    'idx_states',
    'idx_ship_date',
    'idx_transfer_num',
    'idx_order_num'
  )
ORDER BY 
    CASE indexname
        WHEN 'idx_post_searchs_ship_date_id' THEN 1
        WHEN 'idx_post_searchs_states_ship_date' THEN 2
        WHEN 'idx_post_searchs_ship_date_states' THEN 3
        WHEN 'idx_post_searchs_states_ship_date_id' THEN 4
        WHEN 'idx_post_searchs_updated_at' THEN 5
        WHEN 'idx_search_num' THEN 6
        WHEN 'idx_states' THEN 7
        WHEN 'idx_ship_date' THEN 8
        WHEN 'idx_transfer_num' THEN 9
        WHEN 'idx_order_num' THEN 10
    END;

