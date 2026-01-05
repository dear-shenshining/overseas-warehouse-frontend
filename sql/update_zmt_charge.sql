-- 更新 inventory 表中所有 ware_sku 包含 "ZMT" 的记录的 charge 字段为 "朱梦婷"
-- 使用 LIKE 操作符进行模糊匹配，%ZMT% 表示包含 ZMT 的任意位置

UPDATE inventory 
SET charge = '朱梦婷', updated_at = NOW()
WHERE ware_sku LIKE '%ZMT%';

-- 查看更新结果（可选，用于验证）
-- SELECT ware_sku, charge FROM inventory WHERE ware_sku LIKE '%ZMT%';


