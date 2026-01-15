-- 为 task 表添加备注字段
-- 用于存储任务备注信息

ALTER TABLE task 
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

COMMENT ON COLUMN task.notes IS '任务备注（可编辑）';

