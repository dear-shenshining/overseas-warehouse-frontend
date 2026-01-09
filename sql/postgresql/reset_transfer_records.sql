-- 临时修复脚本：将所有有转单号的记录重置
-- 1. 将转单号设置为空
-- 2. 将转单日期设置为空
-- 3. 将状态设置为"未上网"状态

-- 查看需要更新的记录数量（可选，用于验证）
-- SELECT COUNT(*) as affected_count
-- FROM post_searchs
-- WHERE transfer_num IS NOT NULL AND transfer_num != '';

-- 更新所有有转单号的记录
UPDATE post_searchs 
SET 
  transfer_num = NULL,
  transfer_date = NULL,
  states = 'Not registered',
  updated_at = CURRENT_TIMESTAMP
WHERE 
  transfer_num IS NOT NULL 
  AND transfer_num != '';

-- 验证更新结果（可选）
-- SELECT 
--   COUNT(*) FILTER (WHERE transfer_num IS NOT NULL AND transfer_num != '') as remaining_transfer_num_count,
--   COUNT(*) FILTER (WHERE transfer_date IS NOT NULL) as remaining_transfer_date_count,
--   COUNT(*) FILTER (WHERE states = 'Not registered') as not_registered_count
-- FROM post_searchs;

