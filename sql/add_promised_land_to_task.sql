-- 在 task 表中添加 promised_land 字段
-- 用于存储方案选择：0=未选择，1=退回厂家，2=降价清仓，3=打处理

ALTER TABLE `task` 
ADD COLUMN `promised_land` INT DEFAULT 0 COMMENT '方案选择：0=未选择，1=退回厂家，2=降价清仓，3=打处理' 
AFTER `label`;

-- 将现有记录的 promised_land 设置为 0（默认值）
UPDATE `task` SET `promised_land` = 0 WHERE `promised_land` IS NULL;

