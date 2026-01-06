-- 创建物流查询表（post_searchs）
-- PostgreSQL 版本

CREATE TABLE IF NOT EXISTS post_searchs (
  id SERIAL PRIMARY KEY,
  search_num VARCHAR(255) NOT NULL UNIQUE,
  states VARCHAR(255) DEFAULT NULL,
  ship_date TIMESTAMP DEFAULT NULL,
  channel VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_search_num ON post_searchs(search_num);
CREATE INDEX IF NOT EXISTS idx_states ON post_searchs(states);
CREATE INDEX IF NOT EXISTS idx_ship_date ON post_searchs(ship_date);

-- 添加注释
COMMENT ON TABLE post_searchs IS '物流查询表';
COMMENT ON COLUMN post_searchs.id IS '主键ID';
COMMENT ON COLUMN post_searchs.search_num IS '货运单号';
COMMENT ON COLUMN post_searchs.states IS '状态';
COMMENT ON COLUMN post_searchs.ship_date IS '发货日期';
COMMENT ON COLUMN post_searchs.channel IS '发货渠道';
COMMENT ON COLUMN post_searchs.created_at IS '创建时间';
COMMENT ON COLUMN post_searchs.updated_at IS '更新时间';

-- 创建触发器：自动更新 updated_at
CREATE TRIGGER update_post_searchs_updated_at BEFORE UPDATE ON post_searchs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

