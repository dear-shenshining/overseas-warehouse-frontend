-- 创建库存表（inventory）
-- 用于存储滞销库存管理的数据

CREATE TABLE IF NOT EXISTS `inventory` (
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
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='库存表';

-- 表结构说明：
-- id: 自增主键，唯一标识每条记录
-- ware_sku: 马帮SKU，唯一索引，确保不重复
-- inventory_num: 库存数量，使用INT类型，计算公式：SUM(库存数量) - SUM(待发货量) + SUM(在途量)
-- sales_num: 最近7天销量，使用INT类型，计算公式：SUM(最近7天销量)
-- sale_day: 销售天数，INT类型，可选字段，计算公式：库存数量 * 7 / 最近七天销量
-- charge: 费用/负责人，VARCHAR类型，可选字段，从per_charge表匹配
-- label: 标签列表，JSON类型，根据条件自动生成：
--   1: inventory_num为0
--   2: sales_num为0
--   3: sales_num大于300
--   4: sale_day大于1
--   5: inventory_num为负数
-- created_at: 创建时间，自动记录
-- updated_at: 更新时间，自动更新

