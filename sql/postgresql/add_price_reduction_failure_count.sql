-- 为 task 表添加降价清仓失败次数字段
-- 用于记录选择降价清仓方案失败的次数（最多3次）

ALTER TABLE task 
ADD COLUMN IF NOT EXISTS price_reduction_failure_count INTEGER DEFAULT 0;

COMMENT ON COLUMN task.price_reduction_failure_count IS '降价清仓失败次数：0=未失败，1=失败1次（可再选10%），2=失败2次（可再选0%），3=失败3次（不能再选降价清仓）';

-- 创建索引（可选，用于查询）
CREATE INDEX IF NOT EXISTS idx_task_price_reduction_failure_count ON task(price_reduction_failure_count) WHERE price_reduction_failure_count > 0;

