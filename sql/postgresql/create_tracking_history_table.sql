-- 创建追踪历史记录表（tracking_history）
-- PostgreSQL 版本
-- 用于存储日本邮政追踪信息的历史记录

CREATE TABLE IF NOT EXISTS tracking_history (
  id SERIAL PRIMARY KEY,
  item_number VARCHAR(50) NOT NULL,
  date VARCHAR(50) DEFAULT NULL,
  shipping_track_record VARCHAR(200) DEFAULT NULL,
  details TEXT DEFAULT NULL,
  office VARCHAR(100) DEFAULT NULL,
  zip_code VARCHAR(20) DEFAULT NULL,
  prefecture VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_item_number ON tracking_history(item_number);
CREATE INDEX IF NOT EXISTS idx_date ON tracking_history(date);

-- 添加注释
COMMENT ON TABLE tracking_history IS '追踪历史记录表';
COMMENT ON COLUMN tracking_history.id IS '主键ID';
COMMENT ON COLUMN tracking_history.item_number IS '物品编号（追踪号）';
COMMENT ON COLUMN tracking_history.date IS '日期';
COMMENT ON COLUMN tracking_history.shipping_track_record IS '配送记录';
COMMENT ON COLUMN tracking_history.details IS '详情';
COMMENT ON COLUMN tracking_history.office IS '办公室';
COMMENT ON COLUMN tracking_history.zip_code IS '邮编';
COMMENT ON COLUMN tracking_history.prefecture IS '都道府县';
COMMENT ON COLUMN tracking_history.created_at IS '创建时间';

