-- 创建历史任务表（task_history）
-- PostgreSQL 版本
-- 用于存储已完成的任务记录（当可售天数从 >=15 降到 <15 时）
-- 历史任务永久保留，支持一个SKU多次完成任务

CREATE TABLE IF NOT EXISTS task_history (
  id SERIAL PRIMARY KEY,
  ware_sku VARCHAR(255) NOT NULL,
  completed_sale_day INTEGER DEFAULT NULL,
  charge VARCHAR(255) DEFAULT NULL,
  promised_land INTEGER DEFAULT 0,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  inventory_num INTEGER DEFAULT 0,
  sales_num INTEGER DEFAULT 0,
  label JSONB DEFAULT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ware_sku ON task_history(ware_sku);
CREATE INDEX IF NOT EXISTS idx_completed_at ON task_history(completed_at);

-- 添加注释
COMMENT ON TABLE task_history IS '历史任务表（已完成的任务）';
COMMENT ON COLUMN task_history.id IS '主键ID';
COMMENT ON COLUMN task_history.ware_sku IS '马帮SKU，可以有重复（因为一个SKU可能多次完成任务）';
COMMENT ON COLUMN task_history.completed_sale_day IS '完成时的可售天数（从 >=15 降到 <15 时的值）';
COMMENT ON COLUMN task_history.charge IS '完成时的负责人';
COMMENT ON COLUMN task_history.promised_land IS '完成时选择的方案（0=未选择，1=退回厂家，2=降价清仓，3=打处理）';
COMMENT ON COLUMN task_history.completed_at IS '完成时间，自动记录';
COMMENT ON COLUMN task_history.inventory_num IS '完成时的库存数量快照';
COMMENT ON COLUMN task_history.sales_num IS '完成时的最近7天销量快照';
COMMENT ON COLUMN task_history.label IS '完成时的标签快照（JSONB格式）';

