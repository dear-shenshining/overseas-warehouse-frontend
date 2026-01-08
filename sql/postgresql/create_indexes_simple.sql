-- ============================================================
-- 滞销库存管理性能优化 - 索引创建（简化版）
-- 可以在数据库管理工具的新建查询中直接执行
-- ============================================================

-- ⚠️ 重要提示：
-- 1. 如果数据量很大，建议使用 CONCURRENTLY 选项（不阻塞表操作）
-- 2. 如果数据量较小（< 10万条），可以直接执行（不使用 CONCURRENTLY）
-- 3. 执行时间：GIN 索引可能需要几分钟到几十分钟

-- ============================================================
-- 方案一：使用 CONCURRENTLY（推荐，不阻塞表操作）
-- ============================================================

-- 1. GIN 索引（JSONB 查询，最重要！）
-- 创建时间：根据数据量，可能需要几分钟到几十分钟
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_label_gin 
ON inventory USING GIN(label);

-- 2. 排序索引（ORDER BY 查询）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_updated_at_id 
ON inventory(updated_at DESC, id DESC);

-- 3. SKU 索引（如果经常搜索）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_ware_sku 
ON inventory(ware_sku);

-- ============================================================
-- 方案二：不使用 CONCURRENTLY（创建更快，但会短暂锁表）
-- 如果数据量较小或可以在维护窗口执行，可以使用这个方案
-- ============================================================

-- 如果上面的 CONCURRENTLY 执行失败，可以尝试这个（去掉 CONCURRENTLY）
-- CREATE INDEX IF NOT EXISTS idx_inventory_label_gin 
-- ON inventory USING GIN(label);
-- 
-- CREATE INDEX IF NOT EXISTS idx_inventory_updated_at_id 
-- ON inventory(updated_at DESC, id DESC);
-- 
-- CREATE INDEX IF NOT EXISTS idx_inventory_ware_sku 
-- ON inventory(ware_sku);

-- ============================================================
-- 验证索引是否创建成功
-- ============================================================

-- 执行下面的查询，查看已创建的索引
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'inventory'
  AND indexname LIKE 'idx_inventory%'
ORDER BY indexname;

-- ============================================================
-- 查看索引创建进度（如果使用 CONCURRENTLY）
-- ============================================================

-- 在另一个查询窗口中执行，查看索引创建进度
-- SELECT 
--     pid,
--     now() - pg_stat_activity.query_start AS duration,
--     query
-- FROM pg_stat_activity
-- WHERE query LIKE '%CREATE INDEX%'
--   AND state = 'active';

