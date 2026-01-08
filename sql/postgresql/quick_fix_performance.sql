-- ============================================================
-- 滞销库存管理性能优化 - 快速修复
-- 立即执行，大幅提升查询性能
-- ============================================================

-- 1. GIN 索引（JSONB 查询，最重要！）
-- 创建时间：根据数据量，可能需要几分钟到几十分钟
-- 使用 CONCURRENTLY 不阻塞表操作
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_label_gin 
ON inventory USING GIN(label);

-- 2. 排序索引（ORDER BY 查询）
-- 创建时间：通常几秒到几分钟
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_updated_at_id 
ON inventory(updated_at DESC, id DESC);

-- 3. SKU 索引（如果经常搜索）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_ware_sku 
ON inventory(ware_sku);

-- 查看创建进度（在另一个会话中执行）
-- SELECT 
--     schemaname,
--     tablename,
--     indexname,
--     indexdef
-- FROM pg_indexes
-- WHERE tablename = 'inventory'
--   AND indexname LIKE 'idx_inventory%'
-- ORDER BY indexname;

