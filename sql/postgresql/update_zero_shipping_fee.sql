-- ============================================================
-- 更新运费为0的订单，根据物流渠道自动填充运费
-- ============================================================
-- 
-- 说明：
-- 此脚本会更新 orders 表中 actual_shipping_fee 为 0 或 NULL 的订单，
-- 根据 logistics_channel（物流渠道）自动匹配对应的运费值。
-- 
-- 运费匹配规则：
-- - 金焱焱海外仓日邮小包: 23
-- - 大阪海外仓HW105黑猫小包: 23
-- - 大阪海外仓HW105佐川: 23
-- - 大阪海外仓HW105日邮: 23
-- - 大阪海外仓HW105黑猫投函: 12
-- - 金焱焱海外仓: 12
-- 
-- 执行前建议：
-- 1. 备份 orders 表
-- 2. 在测试环境先执行验证
-- 3. 查看将要更新的记录数量
-- 
-- ============================================================

-- 第一步：查看将要更新的记录数量
SELECT 
    logistics_channel,
    COUNT(*) as count,
    CASE 
        WHEN logistics_channel = '金焱焱海外仓日邮小包' THEN 23
        WHEN logistics_channel = '大阪海外仓HW105黑猫小包' THEN 23
        WHEN logistics_channel = '大阪海外仓HW105佐川' THEN 23
        WHEN logistics_channel = '大阪海外仓HW105日邮' THEN 23
        WHEN logistics_channel = '大阪海外仓HW105黑猫投函' THEN 12
        WHEN logistics_channel = '金焱焱海外仓' THEN 12
        ELSE 0
    END as new_shipping_fee
FROM orders
WHERE (actual_shipping_fee IS NULL OR actual_shipping_fee = 0)
  AND logistics_channel IS NOT NULL
  AND logistics_channel != ''
GROUP BY logistics_channel
ORDER BY count DESC;

-- 第二步：查看总更新数量
SELECT COUNT(*) as total_records_to_update
FROM orders
WHERE (actual_shipping_fee IS NULL OR actual_shipping_fee = 0)
  AND logistics_channel IS NOT NULL
  AND logistics_channel != ''
  AND logistics_channel IN (
    '金焱焱海外仓日邮小包',
    '大阪海外仓HW105黑猫小包',
    '大阪海外仓HW105佐川',
    '大阪海外仓HW105日邮',
    '大阪海外仓HW105黑猫投函',
    '金焱焱海外仓'
  );

-- ============================================================
-- 第三步：执行更新（取消注释下面的 UPDATE 语句来执行）
-- ============================================================

-- 更新运费为0或NULL的订单，根据物流渠道匹配运费
UPDATE orders
SET 
    actual_shipping_fee = CASE 
        WHEN logistics_channel = '金焱焱海外仓日邮小包' THEN 23
        WHEN logistics_channel = '大阪海外仓HW105黑猫小包' THEN 23
        WHEN logistics_channel = '大阪海外仓HW105佐川' THEN 23
        WHEN logistics_channel = '大阪海外仓HW105日邮' THEN 23
        WHEN logistics_channel = '大阪海外仓HW105黑猫投函' THEN 12
        WHEN logistics_channel = '金焱焱海外仓' THEN 12
        ELSE actual_shipping_fee  -- 不匹配的保持原值
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE (actual_shipping_fee IS NULL OR actual_shipping_fee = 0)
  AND logistics_channel IS NOT NULL
  AND logistics_channel != ''
  AND logistics_channel IN (
    '金焱焱海外仓日邮小包',
    '大阪海外仓HW105黑猫小包',
    '大阪海外仓HW105佐川',
    '大阪海外仓HW105日邮',
    '大阪海外仓HW105黑猫投函',
    '金焱焱海外仓'
  );

-- ============================================================
-- 第四步：更新后重新计算相关字段
-- ============================================================
-- 
-- 注意：更新运费后，需要重新计算以下字段：
-- - product_and_shipping_cost = total_product_cost + actual_shipping_fee
-- - profit = total_amount - product_and_shipping_cost
-- - profit_rate = (profit / product_and_shipping_cost) * 100
-- 
-- 执行下面的 SQL 来重新计算这些字段：

UPDATE orders
SET 
    product_and_shipping_cost = COALESCE(total_product_cost, 0) + COALESCE(actual_shipping_fee, 0),
    profit = COALESCE(total_amount, 0) - (COALESCE(total_product_cost, 0) + COALESCE(actual_shipping_fee, 0)),
    profit_rate = CASE 
        WHEN (COALESCE(total_product_cost, 0) + COALESCE(actual_shipping_fee, 0)) > 0 
        THEN ROUND(
            ((COALESCE(total_amount, 0) - (COALESCE(total_product_cost, 0) + COALESCE(actual_shipping_fee, 0))) 
             / (COALESCE(total_product_cost, 0) + COALESCE(actual_shipping_fee, 0))) * 100, 
            2
        )
        ELSE 0
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE (actual_shipping_fee IS NULL OR actual_shipping_fee = 0)
  AND logistics_channel IS NOT NULL
  AND logistics_channel != ''
  AND logistics_channel IN (
    '金焱焱海外仓日邮小包',
    '大阪海外仓HW105黑猫小包',
    '大阪海外仓HW105佐川',
    '大阪海外仓HW105日邮',
    '大阪海外仓HW105黑猫投函',
    '金焱焱海外仓'
  );

-- ============================================================
-- 第五步：验证更新结果
-- ============================================================

-- 查看更新后的运费分布
SELECT 
    logistics_channel,
    actual_shipping_fee,
    COUNT(*) as count
FROM orders
WHERE logistics_channel IN (
    '金焱焱海外仓日邮小包',
    '大阪海外仓HW105黑猫小包',
    '大阪海外仓HW105佐川',
    '大阪海外仓HW105日邮',
    '大阪海外仓HW105黑猫投函',
    '金焱焱海外仓'
)
GROUP BY logistics_channel, actual_shipping_fee
ORDER BY logistics_channel, actual_shipping_fee;

-- 查看是否还有运费为0的记录（应该为0或很少）
SELECT COUNT(*) as remaining_zero_fee_count
FROM orders
WHERE (actual_shipping_fee IS NULL OR actual_shipping_fee = 0)
  AND logistics_channel IS NOT NULL
  AND logistics_channel != ''
  AND logistics_channel IN (
    '金焱焱海外仓日邮小包',
    '大阪海外仓HW105黑猫小包',
    '大阪海外仓HW105佐川',
    '大阪海外仓HW105日邮',
    '大阪海外仓HW105黑猫投函',
    '金焱焱海外仓'
  );

-- ============================================================
-- 执行说明
-- ============================================================
-- 
-- 1. 先执行第一步和第二步，查看将要更新的记录数量
-- 2. 确认无误后，取消注释第三步的 UPDATE 语句并执行
-- 3. 执行第四步，重新计算相关字段
-- 4. 执行第五步，验证更新结果
-- 
-- 注意事项：
-- - 建议在低峰期执行
-- - 如果数据量很大，可以考虑分批更新
-- - 执行前务必备份数据
-- 
-- ============================================================

