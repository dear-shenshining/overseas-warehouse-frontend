-- 创建库存表（inventory）
-- PostgreSQL 版本
-- 用于存储滞销库存管理的数据

CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  ware_sku VARCHAR(255) NOT NULL UNIQUE,
  inventory_num INTEGER DEFAULT 0,
  sales_num INTEGER DEFAULT 0,
  sale_day INTEGER DEFAULT NULL,
  charge VARCHAR(255) DEFAULT NULL,
  label JSONB DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ware_sku ON inventory(ware_sku);

-- 添加注释
COMMENT ON TABLE inventory IS '库存表';
COMMENT ON COLUMN inventory.id IS '主键ID';
COMMENT ON COLUMN inventory.ware_sku IS '马帮SKU（唯一标识，不重复不遗漏）';
COMMENT ON COLUMN inventory.inventory_num IS '库存数量（计算值：库存数量 - 待发货量 + 在途量）';
COMMENT ON COLUMN inventory.sales_num IS '最近7天销量';
COMMENT ON COLUMN inventory.sale_day IS '销售天数';
COMMENT ON COLUMN inventory.charge IS '费用/负责人';
COMMENT ON COLUMN inventory.label IS '标签列表（JSONB格式数组，如[1,2]）';
COMMENT ON COLUMN inventory.created_at IS '创建时间';
COMMENT ON COLUMN inventory.updated_at IS '更新时间';

-- 创建触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

