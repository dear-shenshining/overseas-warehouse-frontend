-- 在orders表中添加operator字段（运营）
-- 用于存储店铺对应的运营人员

-- 添加operator字段
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS operator VARCHAR(50);

-- 添加注释
COMMENT ON COLUMN orders.operator IS '店铺运营人员';

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_orders_operator ON orders(operator);

-- 注意：导入数据后，需要根据店铺名称更新operator字段
-- 可以使用以下SQL语句批量更新（需要根据运营对照表来更新）：
-- UPDATE orders SET operator = '运营人员姓名' WHERE store_name = '店铺名称';

