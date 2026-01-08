-- ============================================================
-- 将超时任务移动到历史任务表（安全版本，带错误处理）
-- 用于影刀每小时定时执行
-- 
-- 超时任务定义：count_down < 0（倒计时为负数）
-- 注意：只插入到 task_history，不删除 task 表中的数据
-- 
-- 安全特性：
-- 1. 使用事务确保数据一致性
-- 2. 避免重复插入（检查今天是否已插入）
-- 3. 记录执行日志
-- ============================================================

DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  -- 开始事务（DO 块自动处理事务）
  
  -- 将超时任务插入到 task_history 表
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
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  
  -- 输出执行结果（影刀可以捕获这个输出）
  RAISE NOTICE '成功移动超时任务：插入 % 条记录到 task_history', inserted_count;
  
EXCEPTION
  WHEN OTHERS THEN
    -- 发生错误时回滚并记录错误信息
    RAISE EXCEPTION '移动超时任务时发生错误：%', SQLERRM;
END $$;

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

