-- 创建任务表（task）
-- PostgreSQL 版本
-- 用于存储滞销库存管理中需要处理的任务（label包含2或4的记录）

CREATE TABLE IF NOT EXISTS task (
  id SERIAL PRIMARY KEY,
  ware_sku VARCHAR(255) NOT NULL UNIQUE,
  inventory_num INTEGER DEFAULT 0,
  sales_num INTEGER DEFAULT 0,
  sale_day INTEGER DEFAULT NULL,
  charge VARCHAR(255) DEFAULT NULL,
  label JSONB DEFAULT NULL,
  promised_land INTEGER DEFAULT 0,
  count_down INTEGER DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ware_sku ON task(ware_sku);

-- 添加注释
COMMENT ON TABLE task IS '任务表';
COMMENT ON COLUMN task.id IS '主键ID';
COMMENT ON COLUMN task.ware_sku IS '马帮SKU（唯一标识，不重复不遗漏）';
COMMENT ON COLUMN task.inventory_num IS '库存数量';
COMMENT ON COLUMN task.sales_num IS '最近7天销量';
COMMENT ON COLUMN task.sale_day IS '销售天数';
COMMENT ON COLUMN task.charge IS '费用/负责人';
COMMENT ON COLUMN task.label IS '标签列表（JSONB格式）';
COMMENT ON COLUMN task.promised_land IS '方案选择：0=未选择，1=退回厂家，2=降价清仓，3=打处理';
COMMENT ON COLUMN task.count_down IS '倒计时数字';
COMMENT ON COLUMN task.created_at IS '创建时间';
COMMENT ON COLUMN task.updated_at IS '更新时间';

-- 创建触发器：自动更新 updated_at
CREATE TRIGGER update_task_updated_at BEFORE UPDATE ON task
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

