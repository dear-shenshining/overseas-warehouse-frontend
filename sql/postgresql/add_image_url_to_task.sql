-- 在 task 表中添加 image_urls 字段（JSONB数组类型）
-- 用于存储任务相关的多张图片URL

-- 如果之前有 image_url 字段，先删除
ALTER TABLE task DROP COLUMN IF EXISTS image_url;

-- 添加 image_urls 字段（JSONB数组类型）
ALTER TABLE task ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

-- 添加注释
COMMENT ON COLUMN task.image_urls IS '任务相关图片URL数组（从无铭图床上传，JSONB格式）';

