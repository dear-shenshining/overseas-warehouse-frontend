-- 为订单表添加"毛利"和"利润率"列
-- 毛利 = total_amount - product_and_shipping_cost
-- 利润率 = (毛利 / product_and_shipping_cost) * 100%

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS profit NUMERIC(10, 2) DEFAULT 0;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS profit_rate NUMERIC(10, 2) DEFAULT 0;

-- 如果字段已存在但精度不够，修改字段类型（如果字段不存在会报错，但可以忽略）
DO $$ 
BEGIN
  ALTER TABLE orders ALTER COLUMN profit_rate TYPE NUMERIC(10, 2);
EXCEPTION
  WHEN undefined_column THEN NULL;
END $$;

-- 添加注释
COMMENT ON COLUMN orders.profit IS '毛利（总计金额 - 商品及运费成本）';
COMMENT ON COLUMN orders.profit_rate IS '利润率（毛利 / 商品及运费成本 * 100%）';

-- 更新现有数据：计算毛利和利润率
-- 先确保商品及运费成本已计算
UPDATE orders 
SET product_and_shipping_cost = COALESCE(total_product_cost, 0) + COALESCE(actual_shipping_fee, 0)
WHERE product_and_shipping_cost = 0 OR product_and_shipping_cost IS NULL;

-- 更新所有记录的毛利和利润率
UPDATE orders 
SET 
  profit = COALESCE(total_amount, 0) - COALESCE(product_and_shipping_cost, 0),
  profit_rate = CASE 
    WHEN COALESCE(product_and_shipping_cost, 0) > 0 
    THEN ROUND(((COALESCE(total_amount, 0) - COALESCE(product_and_shipping_cost, 0)) / product_and_shipping_cost * 100)::NUMERIC, 2)
    ELSE 0 
  END;

