-- ============================================================
-- 将超时任务移动到历史任务表
-- 用于影刀每小时定时执行
-- 
-- 超时任务定义：count_down < 0（倒计时为负数）
-- 注意：只插入到 task_history，不删除 task 表中的数据
-- ============================================================

BEGIN;

-- 将超时任务插入到 task_history 表
-- 条件：count_down < 0（超时任务）
-- 注意：不删除 task 表中的数据，只做插入操作
INSERT INTO task_history (
  ware_sku,
  completed_sale_day,
  charge,
  promised_land,
  completed_at,
  inventory_num,
  sales_num,
  label
)
SELECT 
  t.ware_sku,
  t.sale_day AS completed_sale_day,
  t.charge,
  t.promised_land,
  CURRENT_TIMESTAMP AS completed_at,
  t.inventory_num,
  t.sales_num,
  t.label
FROM task t
WHERE t.count_down < 0  -- 超时任务：倒计时为负数
  AND t.ware_sku NOT IN (
    -- 避免重复插入：检查今天是否已插入过
    SELECT ware_sku 
    FROM task_history 
    WHERE completed_at >= CURRENT_DATE
      AND completed_at < CURRENT_DATE + INTERVAL '1 day'
  );

-- 提交事务
COMMIT;

-- ============================================================
-- 执行结果查询（可选，用于验证）
-- ============================================================
-- 查看本次移动的记录数
-- SELECT COUNT(*) as moved_count 
-- FROM task_history 
-- WHERE completed_at >= CURRENT_DATE 
--   AND completed_at < CURRENT_DATE + INTERVAL '1 day';

-- 查看当前 task 表中剩余的失败任务数（应该为 0）
-- SELECT COUNT(*) as remaining_failed_tasks 
-- FROM task 
-- WHERE label::jsonb @> '[4]'::jsonb;

