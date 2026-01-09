-- 为 post_searchs 表添加转运日期字段
-- 用于记录转单号更新的日期

-- 添加转运日期字段
ALTER TABLE post_searchs 
ADD COLUMN IF NOT EXISTS transfer_date TIMESTAMP DEFAULT NULL;

-- 添加注释
COMMENT ON COLUMN post_searchs.transfer_date IS '转运日期（转单号更新时的日期）';

-- 创建索引（如果需要）
CREATE INDEX IF NOT EXISTS idx_transfer_date ON post_searchs(transfer_date);

