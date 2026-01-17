-- ============================================
-- task 表索引优化（最终版本）
-- 整合所有索引，去重，删除不需要的索引
-- ============================================

-- ============================================
-- 1. 基础索引
-- ============================================

-- ware_sku 唯一索引（主键，应该已存在）
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_ware_sku ON task(ware_sku);

-- ============================================
-- 2. 单列索引（用于常见筛选条件）
-- ============================================

-- charge 索引（负责人筛选）
CREATE INDEX IF NOT EXISTS idx_task_charge ON task(charge) WHERE charge IS NOT NULL;

-- task_status 部分索引（只索引有任务状态的记录）
CREATE INDEX IF NOT EXISTS idx_task_task_status ON task(task_status) WHERE task_status IS NOT NULL;

-- promised_land 部分索引（只索引有方案的记录）
CREATE INDEX IF NOT EXISTS idx_task_promised_land ON task(promised_land) WHERE promised_land IS NOT NULL;

-- created_at 索引（用于 count_down 计算和排序）
CREATE INDEX IF NOT EXISTS idx_task_created_at ON task(created_at) WHERE created_at IS NOT NULL;

-- updated_at 索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_task_updated_at ON task(updated_at) WHERE updated_at IS NOT NULL;

-- checked_at 索引（完成检查排序）
CREATE INDEX IF NOT EXISTS idx_task_checked_at ON task(checked_at) WHERE checked_at IS NOT NULL;

-- reviewed_at 索引（审核排序）
CREATE INDEX IF NOT EXISTS idx_task_reviewed_at ON task(reviewed_at) WHERE reviewed_at IS NOT NULL;

-- label GIN 索引（JSONB 查询，用于标签筛选）
CREATE INDEX IF NOT EXISTS idx_task_label_gin ON task USING GIN(label) WHERE label IS NOT NULL;

-- price_reduction_failure_count 索引（用于降价清仓失败次数筛选）
CREATE INDEX IF NOT EXISTS idx_task_price_reduction_failure_count ON task(price_reduction_failure_count) WHERE price_reduction_failure_count > 0;

-- ============================================
-- 3. 复合索引（优化组合查询）
-- ============================================

-- task_status + charge（最常见的组合查询：按状态和负责人筛选，用于统计查询）
CREATE INDEX IF NOT EXISTS idx_task_status_charge ON task(task_status, charge) 
WHERE task_status IS NOT NULL AND charge IS NOT NULL;

-- promised_land + charge（按方案和负责人筛选）
CREATE INDEX IF NOT EXISTS idx_task_promised_land_charge ON task(promised_land, charge) 
WHERE promised_land IS NOT NULL AND charge IS NOT NULL;

-- task_status + promised_land（按状态和方案筛选）
CREATE INDEX IF NOT EXISTS idx_task_status_promised_land ON task(task_status, promised_land) 
WHERE task_status IS NOT NULL AND promised_land IS NOT NULL;

-- task_status + updated_at + charge（用于数据查询和排序，优化后的版本）
CREATE INDEX IF NOT EXISTS idx_task_status_updated_charge ON task(task_status, updated_at DESC NULLS LAST, charge) 
WHERE task_status IS NOT NULL AND updated_at IS NOT NULL;

-- promised_land + updated_at + charge（用于数据查询和排序）
CREATE INDEX IF NOT EXISTS idx_task_promised_land_updated_charge ON task(promised_land, updated_at DESC NULLS LAST, charge) 
WHERE promised_land IS NOT NULL AND updated_at IS NOT NULL;

-- charge + updated_at（负责人筛选和排序）
CREATE INDEX IF NOT EXISTS idx_task_charge_updated_at ON task(charge, updated_at DESC) 
WHERE charge IS NOT NULL;

-- created_at + task_status（用于 count_down 计算和状态筛选）
CREATE INDEX IF NOT EXISTS idx_task_created_at_status ON task(created_at, task_status) 
WHERE created_at IS NOT NULL AND (task_status IS NOT NULL OR promised_land IS NOT NULL);

-- created_at + promised_land（用于超时任务计算）
CREATE INDEX IF NOT EXISTS idx_task_created_promised ON task(created_at, promised_land) 
WHERE created_at IS NOT NULL AND (task_status IS NOT NULL OR promised_land IS NOT NULL);

-- updated_at + task_status（排序和状态筛选）
CREATE INDEX IF NOT EXISTS idx_task_updated_at_status ON task(updated_at DESC, task_status) 
WHERE updated_at IS NOT NULL AND (task_status IS NOT NULL OR promised_land IS NOT NULL);

-- updated_at + id（优化排序查询）
CREATE INDEX IF NOT EXISTS idx_task_updated_at_id ON task(updated_at DESC, id DESC);

-- ============================================
-- 4. 特殊查询优化索引（按状态分类）
-- ============================================

-- 任务记录筛选（task_status IS NOT NULL OR promised_land IS NOT NULL）
CREATE INDEX IF NOT EXISTS idx_task_is_task ON task(ware_sku) 
WHERE task_status IS NOT NULL OR promised_land IS NOT NULL;

-- 非任务记录筛选（用于库存大盘）
CREATE INDEX IF NOT EXISTS idx_task_is_not_task ON task(ware_sku) 
WHERE task_status IS NULL AND promised_land IS NULL;

-- 仓库任务（task_status = 1，替代旧的 in_progress）
CREATE INDEX IF NOT EXISTS idx_task_warehouse_tasks ON task(task_status, charge, updated_at DESC) 
WHERE task_status = 1;

-- 运营任务（task_status IN (2, 3)，替代旧的 in_progress）
CREATE INDEX IF NOT EXISTS idx_task_operation_tasks ON task(task_status, charge, updated_at DESC) 
WHERE task_status IN (2, 3);

-- 完成检查（task_status = 4）
CREATE INDEX IF NOT EXISTS idx_task_checking ON task(task_status, charge, checked_at DESC) 
WHERE task_status = 4;

-- 审核中（task_status = 5）
CREATE INDEX IF NOT EXISTS idx_task_reviewing ON task(task_status, charge, reviewed_at DESC) 
WHERE task_status = 5;

-- 未选择方案（task_status = 0）
CREATE INDEX IF NOT EXISTS idx_task_no_solution ON task(task_status, charge, updated_at DESC) 
WHERE task_status = 0;

-- ============================================
-- 5. task_history 表索引优化
-- ============================================

-- review_status 索引（审核状态筛选）
CREATE INDEX IF NOT EXISTS idx_task_history_review_status ON task_history(review_status) 
WHERE review_status IS NOT NULL;

-- completed_at 索引（排序）
CREATE INDEX IF NOT EXISTS idx_task_history_completed_at ON task_history(completed_at DESC);

-- charge 索引（负责人筛选）
CREATE INDEX IF NOT EXISTS idx_task_history_charge ON task_history(charge) 
WHERE charge IS NOT NULL;

-- promised_land 索引（方案筛选）
CREATE INDEX IF NOT EXISTS idx_task_history_promised_land ON task_history(promised_land);

-- ware_sku 索引（用于搜索）
CREATE INDEX IF NOT EXISTS idx_task_history_ware_sku ON task_history(ware_sku);

-- label GIN 索引（JSONB 查询）
CREATE INDEX IF NOT EXISTS idx_task_history_label_gin ON task_history USING GIN(label) WHERE label IS NOT NULL;

-- 复合索引：review_status + charge（按状态和负责人筛选）
CREATE INDEX IF NOT EXISTS idx_task_history_review_status_charge ON task_history(review_status, charge) 
WHERE review_status IS NOT NULL AND charge IS NOT NULL;

-- 复合索引：completed_at + review_status（排序和状态筛选）
CREATE INDEX IF NOT EXISTS idx_task_history_completed_at_review_status ON task_history(completed_at DESC, review_status) 
WHERE completed_at IS NOT NULL;

-- 复合索引：charge + completed_at（负责人筛选和排序）
CREATE INDEX IF NOT EXISTS idx_task_history_charge_completed_at ON task_history(charge, completed_at DESC) 
WHERE charge IS NOT NULL;

-- 复合索引：promised_land + review_status（方案和状态筛选）
CREATE INDEX IF NOT EXISTS idx_task_history_promised_land_review_status ON task_history(promised_land, review_status) 
WHERE review_status IS NOT NULL;

-- 复合索引：charge + promised_land + completed_at（多条件筛选和排序）
CREATE INDEX IF NOT EXISTS idx_task_history_charge_promised_land_completed_at ON task_history(charge, promised_land, completed_at DESC) 
WHERE charge IS NOT NULL;

-- 复合索引：completed_at + promised_land（日期和方案筛选）
CREATE INDEX IF NOT EXISTS idx_task_history_completed_at_promised_land ON task_history(completed_at DESC, promised_land);

-- ============================================
-- 6. 删除不需要的旧索引
-- ============================================

-- 删除旧的 in_progress 索引（已拆分成 warehouse_tasks 和 operation_tasks）
DROP INDEX IF EXISTS idx_task_in_progress;

-- ============================================
-- 7. 分析表以更新统计信息
-- ============================================

ANALYZE task;
ANALYZE task_history;

-- ============================================
-- 执行完成提示
-- ============================================
-- 执行完成后，可以使用以下 SQL 检查索引使用情况：
-- 
-- SELECT 
--   schemaname,
--   relname as tablename,
--   indexrelname as indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched,
--   pg_size_pretty(pg_relation_size(indexrelid)) as index_size
-- FROM pg_stat_user_indexes
-- WHERE relname IN ('task', 'task_history')
-- ORDER BY idx_scan DESC;
--
-- 如果某个索引的 idx_scan 为 0，说明该索引可能未被使用，可以考虑删除

