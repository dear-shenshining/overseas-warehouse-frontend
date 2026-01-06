-- 创建任务表（task）
-- 用于存储滞销库存管理中需要处理的任务（label包含2或4的记录）

CREATE TABLE IF NOT EXISTS `task` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `ware_sku` VARCHAR(255) NOT NULL UNIQUE COMMENT '马帮SKU（唯一标识，不重复不遗漏）',
  `inventory_num` INT DEFAULT 0 COMMENT '库存数量（计算值：库存数量 - 待发货量 + 在途量）',
  `sales_num` INT DEFAULT 0 COMMENT '最近7天销量',
  `sale_day` INT DEFAULT NULL COMMENT '销售天数',
  `charge` VARCHAR(255) DEFAULT NULL COMMENT '费用/负责人',
  `label` JSON DEFAULT NULL COMMENT '标签列表（JSON格式数组，如[1,2]）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_ware_sku` (`ware_sku`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='任务表';

-- 表结构说明：
-- id: 自增主键，唯一标识每条记录
-- ware_sku: 马帮SKU，唯一索引，确保不重复
-- inventory_num: 库存数量，使用INT类型
-- sales_num: 最近7天销量，使用INT类型
-- sale_day: 销售天数，INT类型，可选字段
-- charge: 费用/负责人，VARCHAR类型，可选字段
-- label: 标签列表，JSON类型
-- created_at: 创建时间，自动记录
-- updated_at: 更新时间，自动更新
-- 
-- 注意：此表的数据来自 inventory 表，当 inventory 表的 label 包含 2（无销量）或 4（在售天数预警）时，会自动同步到此表

