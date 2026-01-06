-- 检查所有表的唯一约束
-- 用于诊断哪些表缺少唯一约束

-- 1. 检查 post_searchs 表
SELECT 
    'post_searchs' as table_name,
    constraint_name,
    constraint_type,
    column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'post_searchs' 
AND tc.constraint_type = 'UNIQUE'
ORDER BY constraint_name;

-- 2. 检查 inventory 表
SELECT 
    'inventory' as table_name,
    constraint_name,
    constraint_type,
    column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'inventory' 
AND tc.constraint_type = 'UNIQUE'
ORDER BY constraint_name;

-- 3. 检查 task 表
SELECT 
    'task' as table_name,
    constraint_name,
    constraint_type,
    column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'task' 
AND tc.constraint_type = 'UNIQUE'
ORDER BY constraint_name;

-- 4. 检查 task_history 表（通常不需要唯一约束）
SELECT 
    'task_history' as table_name,
    constraint_name,
    constraint_type,
    column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'task_history' 
AND tc.constraint_type = 'UNIQUE'
ORDER BY constraint_name;

-- 5. 检查 per_charge 表（如果存在）
SELECT 
    'per_charge' as table_name,
    constraint_name,
    constraint_type,
    column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'per_charge' 
AND tc.constraint_type = 'UNIQUE'
ORDER BY constraint_name;

-- 汇总：显示所有表的唯一约束情况
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
AND tc.constraint_type = 'UNIQUE'
AND tc.table_name IN ('post_searchs', 'inventory', 'task', 'task_history', 'per_charge')
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
ORDER BY tc.table_name, tc.constraint_name;

