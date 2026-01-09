-- 临时脚本：删除 states 状态为空的数据
-- 执行前请先备份数据库！

-- 1. 先查看有多少条数据会被删除
SELECT COUNT(*) as will_be_deleted
FROM post_searchs
WHERE states IS NULL OR states = '';

-- 2. 查看这些数据的详细信息（可选，用于确认）
-- SELECT id, search_num, ship_date, channel, states
-- FROM post_searchs
-- WHERE states IS NULL OR states = ''
-- ORDER BY id DESC
-- LIMIT 100;

-- 3. 执行删除操作（谨慎！请先确认上面的查询结果）
-- 取消下面的注释来执行删除
-- DELETE FROM post_searchs
-- WHERE states IS NULL OR states = '';

-- 4. 验证删除结果
-- SELECT COUNT(*) as remaining_empty_states
-- FROM post_searchs
-- WHERE states IS NULL OR states = '';

