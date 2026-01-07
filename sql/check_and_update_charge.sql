-- 1. 先检查表是否存在
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('inventory', 'per_charge');

-- 2. 如果表存在，执行更新操作
-- 更新 inventory 表的 charge 字段（只更新空的 charge）
UPDATE inventory
SET charge = (
    SELECT charge
    FROM per_charge
    WHERE inventory.ware_sku LIKE '%' || per_charge.sku || '%'
    ORDER BY LENGTH(per_charge.sku) DESC  -- 如果有多个匹配，选择最长的 sku（最具体）
    LIMIT 1
),
updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
    SELECT 1
    FROM per_charge
    WHERE inventory.ware_sku LIKE '%' || per_charge.sku || '%'
)
AND (inventory.charge IS NULL OR inventory.charge = '');

-- 3. 特殊规则：如果 ware_sku 包含 "ZMT"，直接设置为 "朱梦婷"
UPDATE inventory
SET charge = '朱梦婷',
    updated_at = CURRENT_TIMESTAMP
WHERE ware_sku LIKE '%ZMT%'
AND (charge IS NULL OR charge = '');

-- 4. 查看更新结果统计
SELECT 
    COUNT(*) AS total_records,
    COUNT(charge) AS records_with_charge,
    COUNT(*) - COUNT(charge) AS records_without_charge
FROM inventory;

-- 5. 查看匹配示例（前10条）
SELECT 
    i.ware_sku,
    i.charge AS inventory_charge,
    pc.sku AS matched_per_charge_sku,
    pc.charge AS per_charge_charge
FROM inventory i
LEFT JOIN per_charge pc ON i.ware_sku LIKE '%' || pc.sku || '%'
WHERE i.charge IS NOT NULL
ORDER BY i.ware_sku
LIMIT 10;

