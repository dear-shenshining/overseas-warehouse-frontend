-- 创建历史任务表（task_history）
-- 用于存储已完成的任务记录（当可售天数从 >=15 降到 <15 时）
-- 历史任务永久保留，支持一个SKU多次完成任务

CREATE TABLE IF NOT EXISTS `task_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `ware_sku` VARCHAR(255) NOT NULL COMMENT '马帮SKU',
  `completed_sale_day` INT DEFAULT NULL COMMENT '完成时可售天数',
  `charge` VARCHAR(255) DEFAULT NULL COMMENT '完成时负责人',
  `promised_land` INT DEFAULT 0 COMMENT '完成时选择的方案：0=未选择，1=退回厂家，2=降价清仓，3=打处理',
  `completed_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '完成时间',
  `inventory_num` INT DEFAULT 0 COMMENT '完成时库存数量（快照）',
  `sales_num` INT DEFAULT 0 COMMENT '完成时最近7天销量（快照）',
  `label` JSON DEFAULT NULL COMMENT '完成时的标签（快照）',
  INDEX `idx_ware_sku` (`ware_sku`),
  INDEX `idx_completed_at` (`completed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='历史任务表（已完成的任务）';

-- 表结构说明：
-- id: 自增主键，唯一标识每条记录
-- ware_sku: 马帮SKU，可以有重复（因为一个SKU可能多次完成任务）
-- completed_sale_day: 完成时的可售天数（从 >=15 降到 <15 时的值）
-- charge: 完成时的负责人
-- promised_land: 完成时选择的方案（0=未选择，1=退回厂家，2=降价清仓，3=打处理）
-- completed_at: 完成时间，自动记录
-- inventory_num: 完成时的库存数量快照
-- sales_num: 完成时的最近7天销量快照
-- label: 完成时的标签快照（JSON格式）

