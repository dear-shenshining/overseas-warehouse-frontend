-- 临时修复：将 post_searchs 表中所有值为 "-" 的字段更新为空字符串
-- 这是一个一次性修复脚本，用于清理之前导出导入时产生的 "-" 占位符

-- 更新订单号字段（如果值为 "-"）
UPDATE post_searchs 
SET order_num = NULL 
WHERE order_num = '-';

-- 更新发货渠道字段（如果值为 "-"）
UPDATE post_searchs 
SET channel = NULL 
WHERE channel = '-';

-- 更新转单号字段（如果值为 "-"）
UPDATE post_searchs 
SET transfer_num = NULL 
WHERE transfer_num = '-';

-- 更新备注字段（如果值为 "-"）
UPDATE post_searchs 
SET notes = NULL 
WHERE notes = '-';

-- 查看更新结果（可选，用于验证）
-- SELECT 
--   COUNT(*) FILTER (WHERE order_num = '-') as order_num_dash_count,
--   COUNT(*) FILTER (WHERE channel = '-') as channel_dash_count,
--   COUNT(*) FILTER (WHERE transfer_num = '-') as transfer_num_dash_count,
--   COUNT(*) FILTER (WHERE notes = '-') as notes_dash_count
-- FROM post_searchs;

