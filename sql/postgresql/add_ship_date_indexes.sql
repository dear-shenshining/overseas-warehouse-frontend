-- ============================================================
-- 为 post_searchs 表添加日期相关索引
-- 由于日期范围选择器现在有默认值（当月至今），每次查询都会使用日期筛选
-- 这些索引可以显著提升查询性能
-- ============================================================

-- 1. 基础发货日期索引（如果不存在）
-- 优化：WHERE ship_date >= ? AND ship_date <= ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ship_date 
ON post_searchs(ship_date);

-- 2. 排序索引（最重要！性能提升 5-20 倍）
-- 优化：ORDER BY ship_date DESC, id DESC
-- 查询场景：主列表查询，按发货日期倒序排列
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_searchs_ship_date_id 
ON post_searchs(ship_date DESC, id DESC);

-- 3. 复合索引（状态 + 日期，优化状态筛选+日期范围查询）
-- 优化：WHERE states IN (...) AND ship_date >= ? AND ship_date <= ?
-- 查询场景：按状态筛选 + 日期范围
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_searchs_states_ship_date 
ON post_searchs(states, ship_date) WHERE states IS NOT NULL;

-- 4. 复合索引（日期 + 状态，优化日期范围+状态筛选查询）
-- 优化：WHERE ship_date >= ? AND ship_date <= ? AND states IN (...)
-- 查询场景：日期范围 + 状态筛选
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_searchs_ship_date_states 
ON post_searchs(ship_date, states) WHERE states IS NOT NULL;

-- 5. 复合索引（状态 + 日期 + ID，优化复杂查询）
-- 优化：WHERE states IN (...) AND ship_date >= ? ORDER BY id DESC
-- 查询场景：状态筛选 + 日期范围 + ID排序
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_searchs_states_ship_date_id 
ON post_searchs(states, ship_date DESC, id DESC) WHERE states IS NOT NULL;

-- ============================================================
-- 说明
-- ============================================================
-- 1. 使用 CONCURRENTLY 创建索引，不会锁表，但创建时间较长
-- 2. 如果索引已存在，不会重复创建（使用了 IF NOT EXISTS）
-- 3. 建议在低峰期执行，特别是数据量较大的情况下
-- 4. 创建索引后，执行 VACUUM ANALYZE post_searchs 更新统计信息
-- ============================================================

-- 创建索引后，执行以下命令更新统计信息（可选）
-- VACUUM ANALYZE post_searchs;

