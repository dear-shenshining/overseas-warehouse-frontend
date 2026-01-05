-- 在 task 表中添加 count_down 字段
-- 用于存储倒计时数据，格式为 JSON 数组，如 [0, 0, "2025-12-31"]

ALTER TABLE `task` 
ADD COLUMN `count_down` JSON DEFAULT NULL COMMENT '倒计时数据，格式为 [数字, 数字, 日期字符串]，如 [0, 0, "2025-12-31"]' 
AFTER `promised_land`;

