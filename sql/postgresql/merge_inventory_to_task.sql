-- 合并 inventory 和 task 表到 task 表
-- 所有 SKU 数据都存储在 task 表中
-- task_status IS NOT NULL 或 promised_land IS NOT NULL 表示是任务记录

-- ============================================
-- 1. 修改 task 表结构（如果字段不存在则添加）
-- ============================================

-- 确保所有字段都存在
ALTER TABLE task 
ADD COLUMN IF NOT EXISTS task_status INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reject_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promised_land_snapshot INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS checked_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT NULL;

-- 修改 promised_land 默认值为 NULL（NULL 表示不是任务）
-- 先移除 NOT NULL 约束（如果存在）
DO $$ 
BEGIN
    -- 检查并移除 promised_land 的 NOT NULL 约束
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'task' 
        AND column_name = 'promised_land' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE task ALTER COLUMN promised_land DROP NOT NULL;
    END IF;
END $$;

ALTER TABLE task ALTER COLUMN promised_land SET DEFAULT NULL;

-- 修改 task_status 默认值为 NULL（NULL 表示不是任务）
-- 先移除 NOT NULL 约束（如果存在）
DO $$ 
BEGIN
    -- 检查并移除 task_status 的 NOT NULL 约束
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'task' 
        AND column_name = 'task_status' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE task ALTER COLUMN task_status DROP NOT NULL;
    END IF;
END $$;

ALTER TABLE task ALTER COLUMN task_status SET DEFAULT NULL;

-- ============================================
-- 2. 迁移 inventory 表数据到 task 表
-- ============================================

-- 将 inventory 表中不存在于 task 表的记录插入到 task 表
INSERT INTO task (ware_sku, inventory_num, sales_num, sale_day, charge, label, created_at, updated_at)
SELECT ware_sku, inventory_num, sales_num, sale_day, charge, label, created_at, updated_at
FROM inventory
WHERE ware_sku NOT IN (SELECT ware_sku FROM task)
ON CONFLICT (ware_sku) DO NOTHING;

-- ============================================
-- 3. 更新现有 task 记录的字段（如果字段为 NULL）
-- ============================================

-- 对于已经是任务的记录（promised_land IS NOT NULL），保持原有逻辑
-- 对于新插入的记录（promised_land IS NULL），保持 NULL 表示不是任务

-- ============================================
-- 4. 创建索引优化查询性能
-- ============================================

-- 为任务记录创建部分索引（只索引是任务的记录）
CREATE INDEX IF NOT EXISTS idx_task_task_status ON task(task_status) WHERE task_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_promised_land ON task(promised_land) WHERE promised_land IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_checked_at ON task(checked_at) WHERE checked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_reviewed_at ON task(reviewed_at) WHERE reviewed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_label ON task USING GIN(label) WHERE label IS NOT NULL;

-- ============================================
-- 5. 更新注释
-- ============================================

COMMENT ON TABLE task IS '库存和任务表（合并表）：所有 SKU 数据，task_status IS NOT NULL 或 promised_land IS NOT NULL 表示是任务记录';
COMMENT ON COLUMN task.promised_land IS '方案选择：NULL=不是任务，0=未选择方案，1=退回厂家，2=降价清仓，3=打处理';
COMMENT ON COLUMN task.task_status IS '任务状态：NULL=不是任务，0=未选择方案，1=退回厂家，2=降价清仓，3=打处理，4=完成检查，5=审核中';
COMMENT ON COLUMN task.image_urls IS '任务相关图片URL数组（JSONB格式）';

-- ============================================
-- 6. 删除 inventory 表（可选，建议先备份）
-- ============================================

-- 注意：执行前请先备份 inventory 表数据
-- DROP TABLE IF EXISTS inventory;

