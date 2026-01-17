-- ============================================
-- 创建 task_with_countdown 视图
-- 实现类似生成列的效果，实时计算 count_down
-- ============================================

-- 说明：
-- 由于 count_down 依赖于 CURRENT_TIMESTAMP（当前时间），
-- 不能使用 STORED 生成列（因为值会随时间变化）。
-- 使用视图可以在查询时实时计算，达到相同的效果。

-- 步骤 1：创建视图（如果不存在）
CREATE OR REPLACE VIEW task_with_countdown AS
SELECT 
  id,
  ware_sku,
  inventory_num,
  sales_num,
  sale_day,
  charge,
  label,
  promised_land,
  created_at,
  updated_at,
  -- 实时计算 count_down
  CASE 
    WHEN promised_land = 0 
    THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
    ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
  END as count_down
FROM task;

-- 步骤 2：添加注释说明
COMMENT ON VIEW task_with_countdown IS 
'任务表视图，包含实时计算的 count_down 字段。count_down 根据 promised_land 和 created_at 自动计算。';

-- 步骤 3：测试视图
-- SELECT * FROM task_with_countdown LIMIT 5;

-- ============================================
-- 可选：创建索引优化查询性能
-- ============================================

-- 为基表的常用查询字段创建索引
CREATE INDEX IF NOT EXISTS idx_task_created_at ON task(created_at);
CREATE INDEX IF NOT EXISTS idx_task_promised_land ON task(promised_land);
CREATE INDEX IF NOT EXISTS idx_task_ware_sku ON task(ware_sku);

-- ============================================
-- 可选：创建函数用于计算 count_down
-- ============================================

-- 创建计算函数（可以在其他地方复用）
CREATE OR REPLACE FUNCTION calculate_count_down(
  p_created_at TIMESTAMP,
  p_promised_land INTEGER
) RETURNS INTEGER AS $$
BEGIN
  RETURN CASE 
    WHEN p_promised_land = 0 
    THEN 1 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - p_created_at))::INTEGER
    ELSE 7 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - p_created_at))::INTEGER
  END;
END;
$$ LANGUAGE plpgsql STABLE;

-- 添加函数注释
COMMENT ON FUNCTION calculate_count_down IS 
'计算任务的倒计时。参数：created_at（创建时间），promised_land（方案选择）。返回：倒计时天数。';

-- ============================================
-- 使用示例
-- ============================================

-- 示例 1：查询所有任务（包含 count_down）
-- SELECT * FROM task_with_countdown;

-- 示例 2：查询超时任务（count_down < 0）
-- SELECT * FROM task_with_countdown WHERE count_down < 0;

-- 示例 3：使用函数计算单个任务的 count_down
-- SELECT 
--   ware_sku,
--   created_at,
--   promised_land,
--   calculate_count_down(created_at, promised_land) as count_down
-- FROM task
-- WHERE ware_sku = 'SKU123';

-- 示例 4：按 count_down 排序
-- SELECT * FROM task_with_countdown 
-- ORDER BY count_down ASC;

-- ============================================
-- 注意事项
-- ============================================

-- 1. 视图是只读的，不能直接 INSERT/UPDATE/DELETE
--    需要操作基表 task

-- 2. 更新基表后，视图会自动反映最新数据

-- 3. 如果修改了基表结构，可能需要重新创建视图

-- 4. 性能：对于大多数场景（< 10000 条记录），性能可接受
--    如果数据量很大，考虑添加更多索引



















