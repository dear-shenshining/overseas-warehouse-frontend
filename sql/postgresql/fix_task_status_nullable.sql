-- 快速修复：移除 task_status 和 promised_land 的 NOT NULL 约束
-- 执行此脚本以修复 "null value in column "task_status" violates not-null constraint" 错误

-- 移除 task_status 的 NOT NULL 约束
ALTER TABLE task ALTER COLUMN task_status DROP NOT NULL;
ALTER TABLE task ALTER COLUMN task_status SET DEFAULT NULL;

-- 移除 promised_land 的 NOT NULL 约束
ALTER TABLE task ALTER COLUMN promised_land DROP NOT NULL;
ALTER TABLE task ALTER COLUMN promised_land SET DEFAULT NULL;

-- 验证修改
SELECT 
    column_name, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'task' 
AND column_name IN ('task_status', 'promised_land');

