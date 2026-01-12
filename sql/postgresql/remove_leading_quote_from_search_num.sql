-- 使用正则表达式提取 search_num 字段中的纯数字部分
-- 可以处理各种格式：'628409284661、'628409284661'、628409284661 等
-- 只保留数字字符，去掉所有非数字字符（包括单引号、空格、标点符号等）

-- 方法1：使用 REGEXP_REPLACE 去掉所有非数字字符（推荐）
UPDATE post_searchs 
SET search_num = REGEXP_REPLACE(search_num, '[^0-9]', '', 'g')
WHERE search_num ~ '[^0-9]';

-- 方法2：使用 SUBSTRING 提取第一个数字序列（如果数字在开头）
-- UPDATE post_searchs 
-- SET search_num = SUBSTRING(search_num FROM '[0-9]+')
-- WHERE search_num ~ '[^0-9]';

-- 执行前可以先查看有多少条记录包含非数字字符：
-- SELECT COUNT(*) FROM post_searchs WHERE search_num ~ '[^0-9]';

-- 执行前可以查看具体数据（更新前）：
-- SELECT id, search_num FROM post_searchs WHERE search_num ~ '[^0-9]' LIMIT 10;

-- 执行后可以查看更新结果：
-- SELECT id, search_num FROM post_searchs WHERE search_num ~ '[^0-9]' LIMIT 10;

