-- ============================================================
-- 滞销库存管理表索引优化
-- 根据代码中的查询逻辑创建索引，提升查询性能
-- ============================================================

-- ============================================================
-- 1. inventory 表索引
-- ============================================================

-- 1.1 ware_sku 索引（用于精确匹配和模糊搜索）
-- 查询场景：WHERE ware_sku = ? 和 WHERE ware_sku LIKE '%...%'
CREATE INDEX IF NOT EXISTS idx_inventory_ware_sku ON inventory(ware_sku);

-- 1.2 label JSONB GIN 索引（用于 JSONB 查询，最重要！）
-- 查询场景：WHERE label::jsonb @> '[4]'::jsonb 等大量 JSONB 查询
-- GIN 索引专门用于 JSONB 的 @> 操作符，大幅提升性能
CREATE INDEX IF NOT EXISTS idx_inventory_label_gin ON inventory USING GIN(label);

-- 1.3 updated_at 索引（用于排序）
-- 查询场景：ORDER BY updated_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_inventory_updated_at ON inventory(updated_at DESC);

-- 1.4 charge 索引（用于负责人筛选）
-- 查询场景：WHERE charge = ?（虽然当前代码中 inventory 表没有 charge 筛选，但为未来扩展预留）
CREATE INDEX IF NOT EXISTS idx_inventory_charge ON inventory(charge) WHERE charge IS NOT NULL;

-- 1.5 复合索引：updated_at + id（优化排序查询）
-- 查询场景：ORDER BY updated_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_inventory_updated_at_id ON inventory(updated_at DESC, id DESC);

-- ============================================================
-- 2. task 表索引
-- ============================================================

-- 2.1 ware_sku 索引（用于精确匹配和模糊搜索）
-- 查询场景：WHERE ware_sku = ? 和 WHERE ware_sku LIKE '%...%'
CREATE INDEX IF NOT EXISTS idx_task_ware_sku ON task(ware_sku);

-- 2.2 label JSONB GIN 索引（用于 JSONB 查询，最重要！）
-- 查询场景：WHERE label::jsonb @> '[4]'::jsonb 等大量 JSONB 查询
CREATE INDEX IF NOT EXISTS idx_task_label_gin ON task USING GIN(label);

-- 2.3 promised_land 索引（用于状态筛选）
-- 查询场景：WHERE promised_land = 0 和 WHERE promised_land IN (1, 2, 3)
CREATE INDEX IF NOT EXISTS idx_task_promised_land ON task(promised_land);

-- 2.4 charge 索引（用于负责人筛选）
-- 查询场景：WHERE charge = ?
CREATE INDEX IF NOT EXISTS idx_task_charge ON task(charge) WHERE charge IS NOT NULL;

-- 2.5 created_at 索引（用于倒计时计算和超时任务筛选）
-- 查询场景：计算 count_down 和 WHERE count_down < 0（基于 created_at 计算）
CREATE INDEX IF NOT EXISTS idx_task_created_at ON task(created_at);

-- 2.6 updated_at 索引（用于排序）
-- 查询场景：ORDER BY updated_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_task_updated_at ON task(updated_at DESC);

-- 2.7 复合索引：promised_land + charge（优化统计查询）
-- 查询场景：WHERE promised_land = 0 AND charge = ? 等组合查询
CREATE INDEX IF NOT EXISTS idx_task_promised_land_charge ON task(promised_land, charge) WHERE charge IS NOT NULL;

-- 2.8 复合索引：updated_at + id（优化排序查询）
-- 查询场景：ORDER BY updated_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_task_updated_at_id ON task(updated_at DESC, id DESC);

-- 2.9 复合索引：label + promised_land（优化标签和状态组合查询）
-- 查询场景：WHERE label::jsonb @> '[4]'::jsonb AND promised_land = 0
-- 注意：由于 label 是 JSONB，这个复合索引可能不如单独索引有效，但可以尝试
-- CREATE INDEX IF NOT EXISTS idx_task_label_promised_land ON task USING GIN(label, promised_land);

-- ============================================================
-- 3. task_history 表索引
-- ============================================================

-- 3.1 ware_sku 索引（用于模糊搜索）
-- 查询场景：WHERE ware_sku LIKE '%...%'
CREATE INDEX IF NOT EXISTS idx_task_history_ware_sku ON task_history(ware_sku);

-- 3.2 charge 索引（用于负责人筛选）
-- 查询场景：WHERE charge = ?
CREATE INDEX IF NOT EXISTS idx_task_history_charge ON task_history(charge) WHERE charge IS NOT NULL;

-- 3.3 promised_land 索引（用于方案筛选）
-- 查询场景：WHERE promised_land = ?
CREATE INDEX IF NOT EXISTS idx_task_history_promised_land ON task_history(promised_land);

-- 3.4 completed_at 索引（用于日期筛选和排序，最重要！）
-- 查询场景：WHERE completed_at >= ? AND completed_at <= ? 和 ORDER BY completed_at DESC
CREATE INDEX IF NOT EXISTS idx_task_history_completed_at ON task_history(completed_at DESC);

-- 3.5 label JSONB GIN 索引（用于 JSONB 查询）
-- 查询场景：WHERE label::jsonb @> '[4]'::jsonb（统计失败任务）
CREATE INDEX IF NOT EXISTS idx_task_history_label_gin ON task_history USING GIN(label);

-- 3.6 复合索引：completed_at + promised_land（优化日期和方案组合查询）
-- 查询场景：WHERE completed_at >= ? AND promised_land = ?
CREATE INDEX IF NOT EXISTS idx_task_history_completed_at_promised_land ON task_history(completed_at DESC, promised_land);

-- 3.7 复合索引：charge + completed_at（优化负责人和日期组合查询）
-- 查询场景：WHERE charge = ? AND completed_at >= ?
CREATE INDEX IF NOT EXISTS idx_task_history_charge_completed_at ON task_history(charge, completed_at DESC) WHERE charge IS NOT NULL;

-- ============================================================
-- 索引说明
-- ============================================================

-- 1. GIN 索引（Generalized Inverted Index）
--    - 专门用于 JSONB、数组、全文搜索等数据类型
--    - 对于 label::jsonb @> '[4]'::jsonb 这类查询非常高效
--    - 创建时间较长，但查询性能提升显著

-- 2. 部分索引（WHERE 条件）
--    - 只对满足条件的行创建索引，节省空间
--    - 例如：charge IS NOT NULL，只索引非空值

-- 3. 复合索引
--    - 用于多字段组合查询
--    - 字段顺序很重要：最常用的字段放在前面

-- 4. 排序索引（DESC）
--    - 专门优化 ORDER BY DESC 查询
--    - 如果经常按降序排序，使用 DESC 索引更高效

-- ============================================================
-- 执行建议
-- ============================================================

-- 1. 在数据量较大时，建议分批创建索引，避免长时间锁表
-- 2. 可以先创建最重要的索引（GIN 索引），观察性能提升
-- 3. 使用 EXPLAIN ANALYZE 分析查询计划，确认索引被使用
-- 4. 定期使用 VACUUM ANALYZE 更新统计信息

-- 查看索引使用情况：
-- SELECT schemaname, tablename, indexname, idx_scan 
-- FROM pg_stat_user_indexes 
-- WHERE tablename IN ('inventory', 'task', 'task_history')
-- ORDER BY idx_scan DESC;

