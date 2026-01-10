-- 为订单表添加"商品及运费成本"列
-- 该字段 = 商品总成本 + 实际运费

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS product_and_shipping_cost NUMERIC(10, 2) DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN orders.product_and_shipping_cost IS '商品及运费成本（商品总成本 + 实际运费）';

-- 更新现有数据：计算商品及运费成本
UPDATE orders 
SET product_and_shipping_cost = COALESCE(total_product_cost, 0) + COALESCE(actual_shipping_fee, 0)
WHERE product_and_shipping_cost = 0 OR product_and_shipping_cost IS NULL;

