-- ============================================================
-- 每日发货毛利模块性能优化 - orders 表索引
-- 用于优化 getOrdersStatistics 和 getAnomalySKUs 查询性能
-- ============================================================

-- ============================================================
-- 基础索引（如果已存在，使用 CONCURRENTLY 不会报错）
-- ============================================================

-- 1. payment_time 索引（日期范围查询，最重要！）
-- 查询场景：WHERE payment_time::date >= ... AND payment_time::date <= ...
-- 用于日期筛选和 GROUP BY payment_time::date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_time_date 
ON orders((payment_time::date));

-- 2. store_name 索引（店铺筛选）
-- 查询场景：WHERE store_name = ...
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_store_name 
ON orders(store_name) WHERE store_name IS NOT NULL;

-- 3. operator 索引（运营人员筛选，如果字段存在）
-- 查询场景：WHERE operator = ...
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_operator 
ON orders(operator) WHERE operator IS NOT NULL;

-- 4. platform_sku 索引（SKU查询，用于异常页面）
-- 查询场景：WHERE platform_sku IS NOT NULL AND platform_sku != ''
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_platform_sku 
ON orders(platform_sku) WHERE platform_sku IS NOT NULL AND platform_sku != '';

-- 5. profit_rate 部分索引（毛利率筛选）
-- 查询场景：WHERE profit_rate IS NOT NULL AND profit_rate < 20
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_profit_rate_low 
ON orders(profit_rate) WHERE profit_rate IS NOT NULL AND profit_rate < 20;

-- 6. shipping_refund 部分索引（运费回款筛选）
-- 查询场景：WHERE shipping_refund IS NULL OR shipping_refund = 0
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_shipping_refund_zero 
ON orders(shipping_refund) WHERE shipping_refund IS NULL OR shipping_refund = 0;

-- ============================================================
-- 复合索引（优化组合查询，大幅提升性能）
-- ============================================================

-- 7. 日期 + 店铺复合索引（最常用的组合查询）
-- 查询场景：WHERE payment_time::date >= ... AND store_name = ...
-- 用于：getOrdersStatistics 和 getAnomalySKUs 的店铺筛选
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_time_store_name 
ON orders((payment_time::date), store_name) 
WHERE payment_time IS NOT NULL AND store_name IS NOT NULL;

-- 8. 日期 + 运营人员复合索引（如果operator字段存在）
-- 查询场景：WHERE payment_time::date >= ... AND operator = ...
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_time_operator 
ON orders((payment_time::date), operator) 
WHERE payment_time IS NOT NULL AND operator IS NOT NULL;

-- 9. 日期 + SKU复合索引（异常页面查询）
-- 查询场景：WHERE payment_time::date >= ... AND platform_sku IS NOT NULL
-- 用于：getAnomalySKUs 的 SKU 分组查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_time_platform_sku 
ON orders((payment_time::date), platform_sku) 
WHERE payment_time IS NOT NULL AND platform_sku IS NOT NULL AND platform_sku != '';

-- 10. 日期 + 店铺 + 毛利率复合索引（优化异常查询）
-- 查询场景：WHERE payment_time::date >= ... AND store_name = ... AND profit_rate < 20
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_time_store_profit_rate 
ON orders((payment_time::date), store_name, profit_rate) 
WHERE payment_time IS NOT NULL AND store_name IS NOT NULL AND profit_rate IS NOT NULL AND profit_rate < 20;

-- 11. 日期 + 店铺 + 运费回款复合索引（优化异常查询）
-- 查询场景：WHERE payment_time::date >= ... AND store_name = ... AND (shipping_refund IS NULL OR shipping_refund = 0)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_time_store_shipping_refund 
ON orders((payment_time::date), store_name, shipping_refund) 
WHERE payment_time IS NOT NULL AND store_name IS NOT NULL AND (shipping_refund IS NULL OR shipping_refund = 0);

-- ============================================================
-- 统计信息更新（帮助查询优化器选择最佳索引）
-- ============================================================

-- 更新表的统计信息，让查询优化器能够更好地选择索引
ANALYZE orders;

-- ============================================================
-- 索引使用说明
-- ============================================================
-- 
-- 1. idx_orders_payment_time_date
--    - 用于所有日期范围查询
--    - 支持 GROUP BY payment_time::date
-- 
-- 2. idx_orders_payment_time_store_name
--    - 用于日期 + 店铺的组合查询（最常用）
--    - 覆盖大部分筛选场景
-- 
-- 3. idx_orders_payment_time_platform_sku
--    - 用于异常页面的 SKU 分组查询
--    - 优化 getAnomalySKUs 性能
-- 
-- 4. 部分索引（profit_rate, shipping_refund）
--    - 只索引满足条件的行，减少索引大小
--    - 提升查询性能，减少维护成本
-- 
-- ============================================================
-- 执行说明
-- ============================================================
-- 
-- 1. 在生产环境执行时，建议在低峰期执行
-- 2. 使用 CONCURRENTLY 可以避免锁表，但创建时间较长
-- 3. 如果数据量很大，可以分批创建索引
-- 4. 创建完成后，建议执行 ANALYZE 更新统计信息
-- 
-- ============================================================

