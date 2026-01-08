-- 为 post_searchs 表添加新字段
-- 转单号、订单号、备注

-- 添加转单号字段
ALTER TABLE post_searchs 
ADD COLUMN IF NOT EXISTS transfer_num VARCHAR(255) DEFAULT NULL;

-- 添加订单号字段
ALTER TABLE post_searchs 
ADD COLUMN IF NOT EXISTS order_num VARCHAR(255) DEFAULT NULL;

-- 添加备注字段
ALTER TABLE post_searchs 
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- 添加注释
COMMENT ON COLUMN post_searchs.transfer_num IS '转单号';
COMMENT ON COLUMN post_searchs.order_num IS '订单号';
COMMENT ON COLUMN post_searchs.notes IS '备注';

-- 创建索引（如果需要）
CREATE INDEX IF NOT EXISTS idx_transfer_num ON post_searchs(transfer_num);
CREATE INDEX IF NOT EXISTS idx_order_num ON post_searchs(order_num);

