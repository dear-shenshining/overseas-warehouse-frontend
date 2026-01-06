-- 修改 task 表的 count_down 字段为 INT 类型，并统一设置为 1

-- 步骤1: 如果字段存在，先删除旧字段
ALTER TABLE `task` 
DROP COLUMN IF EXISTS `count_down`;

-- 步骤2: 添加新的 INT 类型字段，默认值为 1
ALTER TABLE `task` 
ADD COLUMN `count_down` INT DEFAULT 1 COMMENT '倒计时数字，默认值为1' 
AFTER `promised_land`;

-- 步骤3: 将现有记录的 count_down 统一更新为 1
UPDATE `task` 
SET `count_down` = 1 
WHERE `count_down` IS NULL OR `count_down` != 1;








