-- 启用 post_searchs 表的 updated_at 触发器
-- 如果触发器被禁用，执行此脚本可以重新启用它

-- 方法1：使用 ALTER TABLE ENABLE TRIGGER
ALTER TABLE post_searchs ENABLE TRIGGER update_post_searchs_updated_at;

-- 方法2：如果触发器不存在，重新创建
-- 先删除旧的触发器（如果存在）
DROP TRIGGER IF EXISTS update_post_searchs_updated_at ON post_searchs;

-- 确保函数存在
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- 使用中国时间（GMT+8）
    -- 如果数据库时区已设置为 Asia/Shanghai，CURRENT_TIMESTAMP 会自动使用该时区
    -- 否则可以使用 (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 重新创建触发器
CREATE TRIGGER update_post_searchs_updated_at 
    BEFORE UPDATE ON post_searchs
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 验证触发器是否已启用
SELECT 
    tgname as trigger_name,
    CASE tgenabled
        WHEN 'O' THEN '启用'
        WHEN 'D' THEN '禁用'
        ELSE '未知'
    END as status
FROM pg_trigger 
WHERE tgname = 'update_post_searchs_updated_at';

