-- 查询 task 表中的所有负责人（去重）
SELECT DISTINCT charge 
FROM task 
WHERE charge IS NOT NULL 
AND charge != '' 
ORDER BY charge;

-- 查询 inventory 表中的所有负责人（去重）
SELECT DISTINCT charge 
FROM inventory 
WHERE charge IS NOT NULL 
AND charge != '' 
ORDER BY charge;

