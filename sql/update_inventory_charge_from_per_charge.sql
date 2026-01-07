-- 更新 inventory 表的 charge 字段
-- 根据 per_charge 表的 sku 匹配 inventory 表的 ware_sku
-- 匹配规则：ware_sku 包含 per_charge.sku

-- 先检查表是否存在（可选，如果表不存在会报错）
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('inventory', 'per_charge');

-- 方法1：使用子查询（推荐，兼容性好）
-- 只更新 charge 为空的记录
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
AND (inventory.charge IS NULL OR inventory.charge = '');  -- 只更新空的 charge

-- 方法2：使用 FROM 子句（PostgreSQL 特有，性能更好）
-- UPDATE inventory AS i
-- SET charge = pc.charge,
--     updated_at = CURRENT_TIMESTAMP
-- FROM (
--     SELECT DISTINCT ON (i.id)
--         i.id,
--         pc.charge
--     FROM inventory i
--     CROSS JOIN per_charge pc
--     WHERE i.ware_sku LIKE '%' || pc.sku || '%'
--     ORDER BY i.id, LENGTH(pc.sku) DESC
-- ) AS pc
-- WHERE i.id = pc.id
-- AND (i.charge IS NULL OR i.charge = '');

-- 方法3：如果需要强制更新所有记录（包括已有 charge 的），去掉最后的 AND 条件
-- UPDATE inventory
-- SET charge = (
--     SELECT charge
--     FROM per_charge
--     WHERE inventory.ware_sku LIKE '%' || per_charge.sku || '%'
--     ORDER BY LENGTH(per_charge.sku) DESC
--     LIMIT 1
-- ),
-- updated_at = CURRENT_TIMESTAMP
-- WHERE EXISTS (
--     SELECT 1
--     FROM per_charge
--     WHERE inventory.ware_sku LIKE '%' || per_charge.sku || '%'
-- );

-- 特殊规则：如果 ware_sku 包含 "ZMT"，直接设置为 "朱梦婷"
UPDATE inventory
SET charge = '朱梦婷',
    updated_at = CURRENT_TIMESTAMP
WHERE ware_sku LIKE '%ZMT%'
AND (charge IS NULL OR charge = '');

-- 查看更新结果
-- SELECT 
--     i.ware_sku,
--     i.charge AS inventory_charge,
--     pc.sku AS per_charge_sku,
--     pc.charge AS per_charge_charge
-- FROM inventory i
-- LEFT JOIN per_charge pc ON i.ware_sku LIKE '%' || pc.sku || '%'
-- WHERE i.charge IS NOT NULL
-- ORDER BY i.ware_sku
-- LIMIT 100;

