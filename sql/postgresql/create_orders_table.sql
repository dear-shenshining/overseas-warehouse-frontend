-- 创建订单表（orders）
-- PostgreSQL 版本
-- 用于存储订单相关信息

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(255) NOT NULL UNIQUE,
  store_name VARCHAR(255) DEFAULT NULL,
  payment_time TIMESTAMP DEFAULT NULL,
  platform_sku VARCHAR(255) DEFAULT NULL,
  logistics_channel VARCHAR(255) DEFAULT NULL,
  order_status VARCHAR(255) DEFAULT NULL,
  total_product_cost NUMERIC(10, 2) DEFAULT 0,
  actual_shipping_fee NUMERIC(10, 2) DEFAULT 0,
  product_and_shipping_cost NUMERIC(10, 2) DEFAULT 0,
  profit NUMERIC(10, 2) DEFAULT 0,
  profit_rate NUMERIC(10, 2) DEFAULT 0,
  sales_refund NUMERIC(10, 2) DEFAULT 0,
  shipping_refund NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_store_name ON orders(store_name);
CREATE INDEX IF NOT EXISTS idx_payment_time ON orders(payment_time);
CREATE INDEX IF NOT EXISTS idx_platform_sku ON orders(platform_sku);
CREATE INDEX IF NOT EXISTS idx_order_status ON orders(order_status);

-- 添加注释
COMMENT ON TABLE orders IS '订单表';
COMMENT ON COLUMN orders.id IS '主键ID';
COMMENT ON COLUMN orders.order_number IS '订单编号（唯一标识）';
COMMENT ON COLUMN orders.store_name IS '店铺名';
COMMENT ON COLUMN orders.payment_time IS '付款时间';
COMMENT ON COLUMN orders.platform_sku IS '平台SKU';
COMMENT ON COLUMN orders.logistics_channel IS '物流渠道';
COMMENT ON COLUMN orders.order_status IS '订单状态';
COMMENT ON COLUMN orders.total_product_cost IS '商品总成本';
COMMENT ON COLUMN orders.actual_shipping_fee IS '实际运费';
COMMENT ON COLUMN orders.product_and_shipping_cost IS '商品及运费成本（商品总成本 + 实际运费）';
COMMENT ON COLUMN orders.profit IS '毛利（总计金额 - 商品及运费成本）';
COMMENT ON COLUMN orders.profit_rate IS '利润率（毛利 / 商品及运费成本 * 100%）';
COMMENT ON COLUMN orders.sales_refund IS '销售回款';
COMMENT ON COLUMN orders.shipping_refund IS '运费回款';
COMMENT ON COLUMN orders.total_amount IS '总计金额';
COMMENT ON COLUMN orders.created_at IS '创建时间';
COMMENT ON COLUMN orders.updated_at IS '更新时间';

-- 创建触发器：自动更新 updated_at
-- 如果触发器函数不存在，先创建它
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

