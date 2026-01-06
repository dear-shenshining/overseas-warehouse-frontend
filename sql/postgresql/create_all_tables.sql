-- ============================================
-- PostgreSQL 完整建表脚本
-- 基于原 MySQL 数据库结构转换
-- ============================================

-- 1. 创建库存表（inventory）
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  ware_sku VARCHAR(255) NOT NULL UNIQUE,
  inventory_num INTEGER DEFAULT 0,
  sales_num INTEGER DEFAULT 0,
  sale_day INTEGER DEFAULT NULL,
  charge VARCHAR(255) DEFAULT NULL,
  label JSONB DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ware_sku ON inventory(ware_sku);

COMMENT ON TABLE inventory IS '库存表';
COMMENT ON COLUMN inventory.id IS '主键ID';
COMMENT ON COLUMN inventory.ware_sku IS '马帮SKU（唯一标识，不重复不遗漏）';
COMMENT ON COLUMN inventory.inventory_num IS '库存数量（计算值：库存数量 - 待发货量 + 在途量）';
COMMENT ON COLUMN inventory.sales_num IS '最近7天销量';
COMMENT ON COLUMN inventory.sale_day IS '销售天数';
COMMENT ON COLUMN inventory.charge IS '费用/负责人';
COMMENT ON COLUMN inventory.label IS '标签列表（JSONB格式数组，如[1,2]）';
COMMENT ON COLUMN inventory.created_at IS '创建时间';
COMMENT ON COLUMN inventory.updated_at IS '更新时间';

-- 2. 创建任务表（task）
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_ware_sku ON task(ware_sku);

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

-- 3. 创建历史任务表（task_history）
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_ware_sku ON task_history(ware_sku);
CREATE INDEX IF NOT EXISTS idx_completed_at ON task_history(completed_at);

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

-- 4. 创建物流查询表（post_searchs）
-- ============================================
CREATE TABLE IF NOT EXISTS post_searchs (
  id SERIAL PRIMARY KEY,
  search_num VARCHAR(255) NOT NULL UNIQUE,
  states VARCHAR(255) DEFAULT NULL,
  ship_date TIMESTAMP DEFAULT NULL,
  channel VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_num ON post_searchs(search_num);
CREATE INDEX IF NOT EXISTS idx_states ON post_searchs(states);
CREATE INDEX IF NOT EXISTS idx_ship_date ON post_searchs(ship_date);

COMMENT ON TABLE post_searchs IS '物流查询表';
COMMENT ON COLUMN post_searchs.id IS '主键ID';
COMMENT ON COLUMN post_searchs.search_num IS '货运单号';
COMMENT ON COLUMN post_searchs.states IS '状态';
COMMENT ON COLUMN post_searchs.ship_date IS '发货日期';
COMMENT ON COLUMN post_searchs.channel IS '发货渠道';
COMMENT ON COLUMN post_searchs.created_at IS '创建时间';
COMMENT ON COLUMN post_searchs.updated_at IS '更新时间';

-- 5. 创建追踪历史记录表（tracking_history）
-- ============================================
CREATE TABLE IF NOT EXISTS tracking_history (
  id SERIAL PRIMARY KEY,
  item_number VARCHAR(50) NOT NULL,
  date VARCHAR(50) DEFAULT NULL,
  shipping_track_record VARCHAR(200) DEFAULT NULL,
  details TEXT DEFAULT NULL,
  office VARCHAR(100) DEFAULT NULL,
  zip_code VARCHAR(20) DEFAULT NULL,
  prefecture VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_item_number ON tracking_history(item_number);
CREATE INDEX IF NOT EXISTS idx_date ON tracking_history(date);

COMMENT ON TABLE tracking_history IS '追踪历史记录表';
COMMENT ON COLUMN tracking_history.id IS '主键ID';
COMMENT ON COLUMN tracking_history.item_number IS '物品编号（追踪号）';
COMMENT ON COLUMN tracking_history.date IS '日期';
COMMENT ON COLUMN tracking_history.shipping_track_record IS '配送记录';
COMMENT ON COLUMN tracking_history.details IS '详情';
COMMENT ON COLUMN tracking_history.office IS '办公室';
COMMENT ON COLUMN tracking_history.zip_code IS '邮编';
COMMENT ON COLUMN tracking_history.prefecture IS '都道府县';
COMMENT ON COLUMN tracking_history.created_at IS '创建时间';

-- 6. 创建负责人映射表（per_charge）- 可选
-- ============================================
-- 如果原 MySQL 数据库中有此表，可以创建
CREATE TABLE IF NOT EXISTS per_charge (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(255) NOT NULL,
  charge VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sku ON per_charge(sku);

COMMENT ON TABLE per_charge IS 'SKU负责人映射表';
COMMENT ON COLUMN per_charge.id IS '主键ID';
COMMENT ON COLUMN per_charge.sku IS 'SKU关键字（用于匹配）';
COMMENT ON COLUMN per_charge.charge IS '负责人名称';
COMMENT ON COLUMN per_charge.created_at IS '创建时间';
COMMENT ON COLUMN per_charge.updated_at IS '更新时间';

-- 7. 创建触发器函数（用于自动更新 updated_at）
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. 为所有表创建触发器
-- ============================================
CREATE TRIGGER update_inventory_updated_at 
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_updated_at 
    BEFORE UPDATE ON task
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_searchs_updated_at 
    BEFORE UPDATE ON post_searchs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_per_charge_updated_at 
    BEFORE UPDATE ON per_charge
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 建表完成
-- ============================================

