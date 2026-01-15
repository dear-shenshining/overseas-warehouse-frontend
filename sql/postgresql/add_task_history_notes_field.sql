-- 为 task_history 表添加备注字段
-- 用于存储历史任务的备注信息

ALTER TABLE task_history 
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

COMMENT ON COLUMN task_history.notes IS '任务备注（快照）';

