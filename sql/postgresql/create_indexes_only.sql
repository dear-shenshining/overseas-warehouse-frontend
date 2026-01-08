-- ============================================================
-- 滞销库存管理性能优化 - 只包含索引创建语句
-- 直接执行这个文件即可，不包含任何示例查询
-- ============================================================

-- ============================================================
-- inventory 表索引
-- ============================================================

-- 1. GIN 索引（JSONB 查询，最重要！性能提升 10-100 倍）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_label_gin 
ON inventory USING GIN(label);

-- 2. 排序索引（ORDER BY 查询，性能提升 5-20 倍）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_updated_at_id 
ON inventory(updated_at DESC, id DESC);

-- 3. SKU 索引（搜索性能提升）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_ware_sku 
ON inventory(ware_sku);

-- ============================================================
-- task 表索引
-- ============================================================

-- 4. GIN 索引（JSONB 查询，最重要！）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_label_gin 
ON task USING GIN(label);

-- 5. SKU 索引（搜索性能提升）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_ware_sku 
ON task(ware_sku);

-- 6. promised_land 索引（状态筛选）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_promised_land 
ON task(promised_land);

-- 7. charge 索引（负责人筛选）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_charge 
ON task(charge) WHERE charge IS NOT NULL;

-- 8. created_at 索引（倒计时计算和超时任务筛选）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_created_at 
ON task(created_at);

-- 9. 排序索引（ORDER BY 查询）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_updated_at_id 
ON task(updated_at DESC, id DESC);

-- 10. 复合索引（promised_land + charge，优化组合查询）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_promised_land_charge 
ON task(promised_land, charge) WHERE charge IS NOT NULL;

-- ============================================================
-- task_history 表索引
-- ============================================================

-- 11. SKU 索引（搜索性能提升）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_history_ware_sku 
ON task_history(ware_sku);

-- 12. charge 索引（负责人筛选）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_history_charge 
ON task_history(charge) WHERE charge IS NOT NULL;

-- 13. promised_land 索引（方案筛选）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_history_promised_land 
ON task_history(promised_land);

-- 14. completed_at 索引（日期筛选和排序，最重要！）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_history_completed_at 
ON task_history(completed_at DESC);

-- 15. GIN 索引（JSONB 查询，失败任务统计）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_history_label_gin 
ON task_history USING GIN(label);

-- 16. 复合索引（completed_at + promised_land，优化组合查询）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_history_completed_at_promised_land 
ON task_history(completed_at DESC, promised_land);

-- 17. 复合索引（charge + completed_at，优化组合查询）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_history_charge_completed_at 
ON task_history(charge, completed_at DESC) WHERE charge IS NOT NULL;

-- ============================================================
-- post_searchs 表索引（海外物流模块）
-- ============================================================

-- 18. 排序索引（ORDER BY 查询，最重要！性能提升 5-20 倍）
-- 查询场景：ORDER BY ship_date DESC, id DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_searchs_ship_date_id 
ON post_searchs(ship_date DESC, id DESC);

-- 19. 复合索引（states + ship_date，优化状态+日期筛选）
-- 查询场景：WHERE states IN (...) AND ship_date >= ... AND ship_date <= ...
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_searchs_states_ship_date 
ON post_searchs(states, ship_date) WHERE states IS NOT NULL;

-- 20. 复合索引（ship_date + states，优化日期+状态筛选）
-- 查询场景：WHERE ship_date >= ... AND states IN (...)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_searchs_ship_date_states 
ON post_searchs(ship_date, states) WHERE states IS NOT NULL;

-- 21. updated_at 索引（用于排序和筛选）
-- 查询场景：ORDER BY updated_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_searchs_updated_at 
ON post_searchs(updated_at DESC);

-- 22. 复合索引（states + ship_date + id，优化复杂查询）
-- 查询场景：WHERE states IN (...) AND ship_date >= ... ORDER BY id DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_searchs_states_ship_date_id 
ON post_searchs(states, ship_date DESC, id DESC) WHERE states IS NOT NULL;

-- 注意：以下索引如果已存在（在 add_logistics_fields.sql 中创建），可以跳过
-- idx_search_num (search_num) - 已存在
-- idx_states (states) - 已存在
-- idx_ship_date (ship_date) - 已存在
-- idx_transfer_num (transfer_num) - 已存在（如果字段存在）
-- idx_order_num (order_num) - 已存在（如果字段存在）

