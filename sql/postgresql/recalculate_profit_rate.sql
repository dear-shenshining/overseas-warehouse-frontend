-- ============================================================
-- 重新计算 orders 表的利润率
-- PostgreSQL 版本
-- 用于批量更新所有订单的 profit_rate 字段
-- ============================================================

-- ============================================================
-- 计算公式说明
-- ============================================================
-- 
-- 1. product_and_shipping_cost = total_product_cost + actual_shipping_fee
--    （商品及运费成本 = 商品总成本 + 实际运费）
-- 
-- 2. profit = total_amount - product_and_shipping_cost
--    （毛利 = 总结算金额 - 商品及运费成本）
-- 
-- 3. profit_rate = (profit / total_amount) * 100%
--    （利润率 = 毛利 / 总结算金额 * 100%）
-- 
-- 重要：每一条订单的利润率都是用 毛利 除以 总结算金额 计算得出
-- 
-- ============================================================

-- ============================================================
-- 执行前检查
-- ============================================================

-- 1. 查看需要更新的订单数量
-- SELECT COUNT(*) as total_orders FROM orders;

-- 2. 查看当前利润率分布情况
-- SELECT 
--   CASE 
--     WHEN profit_rate IS NULL THEN 'NULL'
--     WHEN profit_rate < 0 THEN '< 0%'
--     WHEN profit_rate < 10 THEN '0-10%'
--     WHEN profit_rate < 20 THEN '10-20%'
--     WHEN profit_rate < 30 THEN '20-30%'
--     ELSE '>= 30%'
--   END as profit_rate_range,
--   COUNT(*) as count
-- FROM orders
-- GROUP BY profit_rate_range
-- ORDER BY profit_rate_range;

-- 3. 查看有问题的订单（成本或金额为 NULL 或 0）
-- SELECT 
--   COUNT(*) as problematic_orders
-- FROM orders
-- WHERE total_product_cost IS NULL 
--   OR actual_shipping_fee IS NULL 
--   OR total_amount IS NULL
--   OR total_amount = 0;

-- ============================================================
-- 重新计算利润率（推荐方法）
-- ============================================================

-- 方法1：使用 UPDATE 语句批量更新（推荐，支持事务回滚）
-- 只更新 profit_rate 字段
-- 计算公式：profit_rate = (profit / total_amount) * 100%
-- 如果 profit 字段已存在，直接使用；否则计算 profit = total_amount - (total_product_cost + actual_shipping_fee)
UPDATE orders
SET 
  profit_rate = CASE 
    WHEN COALESCE(total_amount, 0) > 0 THEN
      -- 利润率 = (毛利 / 总结算金额) * 100%
      -- 优先使用已存在的 profit 字段，如果没有则计算
      ROUND(
        ((COALESCE(profit, COALESCE(total_amount, 0) - (COALESCE(total_product_cost, 0) + COALESCE(actual_shipping_fee, 0)))) 
         / COALESCE(total_amount, 1)) * 100, 
        2
      )
    ELSE 0
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE 
  -- 只更新有 total_amount 的订单
  total_amount IS NOT NULL;

-- ============================================================
-- 执行后验证
-- ============================================================

-- 1. 验证更新后的数据量
-- SELECT COUNT(*) as updated_orders 
-- FROM orders 
-- WHERE profit_rate IS NOT NULL;

-- 2. 验证计算是否正确（随机抽查几条记录）
-- SELECT 
--   order_number,
--   total_product_cost,
--   actual_shipping_fee,
--   product_and_shipping_cost,
--   total_amount,
--   profit,
--   profit_rate,
--   -- 验证计算：profit_rate 应该等于 (profit / total_amount) * 100
--   -- 如果 profit 为 NULL，则使用计算的 profit = total_amount - (total_product_cost + actual_shipping_fee)
--   CASE 
--     WHEN total_amount > 0 THEN 
--       ROUND(
--         ((COALESCE(profit, total_amount - COALESCE(product_and_shipping_cost, total_product_cost + actual_shipping_fee))) 
--          / total_amount) * 100, 
--         2
--       )
--     ELSE 0
--   END as calculated_profit_rate
-- FROM orders
-- WHERE total_amount IS NOT NULL
-- LIMIT 10;

-- 3. 查看更新后的利润率分布
-- SELECT 
--   CASE 
--     WHEN profit_rate IS NULL THEN 'NULL'
--     WHEN profit_rate < 0 THEN '< 0%'
--     WHEN profit_rate < 10 THEN '0-10%'
--     WHEN profit_rate < 20 THEN '10-20%'
--     WHEN profit_rate < 30 THEN '20-30%'
--     ELSE '>= 30%'
--   END as profit_rate_range,
--   COUNT(*) as count
-- FROM orders
-- GROUP BY profit_rate_range
-- ORDER BY profit_rate_range;

-- ============================================================
-- 分批更新（如果数据量很大，可以使用此方法）
-- ============================================================

-- 如果订单数量非常大（百万级以上），可以分批更新以避免长时间锁表
-- 示例：每次更新 10000 条记录（使用 CTID 分批）

-- DO $$
-- DECLARE
--   batch_size INTEGER := 10000;
--   updated_count INTEGER;
--   batch_ids INTEGER[];
-- BEGIN
--   LOOP
--     -- 获取一批需要更新的订单 ID
--     SELECT ARRAY_AGG(id) INTO batch_ids
--     FROM (
--       SELECT id
--       FROM orders
--       WHERE total_amount IS NOT NULL
--         AND (profit_rate IS NULL OR updated_at < CURRENT_TIMESTAMP - INTERVAL '1 minute')
--       LIMIT batch_size
--     ) sub;
--     
--     -- 如果没有更多记录，退出循环
--     EXIT WHEN batch_ids IS NULL OR array_length(batch_ids, 1) = 0;
--     
--     -- 更新这一批订单
--     -- 只更新 profit_rate 字段
--     -- 计算公式：profit_rate = (profit / total_amount) * 100%
--     -- 每一条订单的利润率都是用 毛利 除以 总结算金额 计算得出
--     UPDATE orders
--     SET 
--       profit_rate = CASE 
--         WHEN COALESCE(total_amount, 0) > 0 THEN
--           -- 利润率 = (毛利 / 总结算金额) * 100%
--           -- 优先使用已存在的 profit 字段，如果没有则计算
--           ROUND(
--             ((COALESCE(profit, COALESCE(total_amount, 0) - (COALESCE(total_product_cost, 0) + COALESCE(actual_shipping_fee, 0)))) 
--              / COALESCE(total_amount, 1)) * 100, 
--             2
--           )
--         ELSE 0
--       END,
--       updated_at = CURRENT_TIMESTAMP
--     WHERE id = ANY(batch_ids);
--     
--     GET DIAGNOSTICS updated_count = ROW_COUNT;
--     RAISE NOTICE '已更新 % 条记录', updated_count;
--     
--     -- 可以添加延迟以避免过度占用资源
--     PERFORM pg_sleep(0.1);
--   END LOOP;
-- END $$;

-- ============================================================
-- 注意事项
-- ============================================================
-- 
-- 1. 执行前请务必备份数据
-- 2. 此操作只更新 profit_rate 字段，不会修改其他字段
-- 3. 如果数据量很大，建议在低峰期执行
-- 4. 更新操作会自动更新 updated_at 字段
-- 5. 如果 total_amount 为 NULL 或 0，profit_rate 会被设置为 0
-- 6. 使用 COALESCE 处理 NULL 值，确保计算不会出错
-- 7. 利润率保留 2 位小数
-- 8. 如果 profit 字段已存在，直接使用；否则会计算 profit = total_amount - (total_product_cost + actual_shipping_fee)
-- 9. 如果数据量特别大，可以使用分批更新的方法
-- 
-- ============================================================

