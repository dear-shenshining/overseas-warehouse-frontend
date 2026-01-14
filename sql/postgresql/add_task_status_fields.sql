-- 为 task 和 task_history 表添加任务状态相关字段
-- 用于支持"完成检查"和"审核"功能

-- ============================================
-- 1. task 表新增字段
-- ============================================

-- 添加任务状态字段
-- 0=未选择方案（原有逻辑，与promised_land=0对应）
-- 1=退回厂家（原有逻辑，与promised_land=1对应）
-- 2=降价清仓（原有逻辑，与promised_land=2对应）
-- 3=打处理（原有逻辑，与promised_land=3对应）
-- 4=完成检查（新增）
-- 5=审核中（新增）
ALTER TABLE task 
ADD COLUMN IF NOT EXISTS task_status INTEGER DEFAULT 0 NOT NULL;

-- 添加审核状态字段（仅在审核中状态时使用）
-- NULL=未审核
-- 'rejected'=已打回
-- 'approved'=已通过
ALTER TABLE task 
ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT NULL;

-- 添加打回理由字段（仅在打回时使用）
ALTER TABLE task 
ADD COLUMN IF NOT EXISTS reject_reason TEXT DEFAULT NULL;

-- 添加方案快照字段（从任务正在进行中转入完成检查时保存）
-- 保存转入完成检查时的promised_land值，后续不再允许修改
ALTER TABLE task 
ADD COLUMN IF NOT EXISTS promised_land_snapshot INTEGER DEFAULT NULL;

-- 添加转入完成检查的时间
ALTER TABLE task 
ADD COLUMN IF NOT EXISTS checked_at TIMESTAMP DEFAULT NULL;

-- 添加转入审核的时间
ALTER TABLE task 
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP DEFAULT NULL;

-- 初始化现有数据的 task_status（根据 promised_land 设置）
-- 将已有任务的 task_status 设置为对应的 promised_land 值
UPDATE task 
SET task_status = promised_land 
WHERE task_status = 0 AND promised_land IN (1, 2, 3);

-- 添加字段注释
COMMENT ON COLUMN task.task_status IS '任务状态：0=未选择方案，1=退回厂家，2=降价清仓，3=打处理，4=完成检查，5=审核中';
COMMENT ON COLUMN task.review_status IS '审核状态：NULL=未审核，rejected=已打回，approved=已通过';
COMMENT ON COLUMN task.reject_reason IS '打回理由';
COMMENT ON COLUMN task.promised_land_snapshot IS '方案快照（转入完成检查时的promised_land值）';
COMMENT ON COLUMN task.checked_at IS '转入完成检查的时间';
COMMENT ON COLUMN task.reviewed_at IS '转入审核的时间';

-- ============================================
-- 2. task_history 表新增字段
-- ============================================

-- 添加审核状态（记录完成时的审核状态）
ALTER TABLE task_history 
ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT NULL;

-- 添加打回理由（如果被审核打回过）
ALTER TABLE task_history 
ADD COLUMN IF NOT EXISTS reject_reason TEXT DEFAULT NULL;

-- 添加任务状态快照（记录完成时的任务状态）
ALTER TABLE task_history 
ADD COLUMN IF NOT EXISTS task_status_snapshot INTEGER DEFAULT NULL;

-- 添加字段注释
COMMENT ON COLUMN task_history.review_status IS '审核状态快照：NULL=未审核，rejected=已打回，approved=已通过，timeout=超时';
COMMENT ON COLUMN task_history.reject_reason IS '打回理由快照';
COMMENT ON COLUMN task_history.task_status_snapshot IS '任务状态快照（完成时的task_status值）';

-- ============================================
-- 3. 创建索引（可选，用于提高查询性能）
-- ============================================

-- 为 task_status 创建索引（用于筛选不同状态的任务）
CREATE INDEX IF NOT EXISTS idx_task_task_status ON task(task_status);

-- 为 checked_at 创建索引（用于排序完成检查列表）
CREATE INDEX IF NOT EXISTS idx_task_checked_at ON task(checked_at);

-- 为 reviewed_at 创建索引（用于排序审核列表）
CREATE INDEX IF NOT EXISTS idx_task_reviewed_at ON task(reviewed_at);

-- 为 task_history 的 review_status 创建索引（用于筛选审核状态）
CREATE INDEX IF NOT EXISTS idx_task_history_review_status ON task_history(review_status);

-- ============================================
-- 执行完成提示
-- ============================================
-- 执行完成后，请验证：
-- 1. SELECT * FROM task LIMIT 1; -- 查看 task 表是否有新字段
-- 2. SELECT * FROM task_history LIMIT 1; -- 查看 task_history 表是否有新字段
-- 3. SELECT COUNT(*) FROM task WHERE task_status = 0; -- 验证现有数据已正确初始化

