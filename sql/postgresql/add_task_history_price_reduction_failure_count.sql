-- 为 task_history 表添加降价清仓失败次数字段
-- 用于记录历史任务中选择降价清仓方案时的失败次数

ALTER TABLE task_history 
ADD COLUMN IF NOT EXISTS price_reduction_failure_count INTEGER DEFAULT 0;

COMMENT ON COLUMN task_history.price_reduction_failure_count IS '降价清仓失败次数快照：0=未失败，1=失败1次（20%），2=失败2次（10%），3=失败3次（0%）';

