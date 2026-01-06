-- 创建 post_searchs 表的 SQL 脚本
-- 用于存储物流查询数据

-- 如果数据库不存在，请先创建数据库
-- CREATE DATABASE IF NOT EXISTS `seas_ware` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE `seas_ware`;

-- 创建 post_searchs 表
CREATE TABLE IF NOT EXISTS `post_searchs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `search_num` VARCHAR(255) NOT NULL COMMENT '货运单号',
  `states` VARCHAR(100) DEFAULT NULL COMMENT '状态',
  `Ship_date` DATE DEFAULT NULL COMMENT '发货日期',
  `channel` VARCHAR(100) DEFAULT NULL COMMENT '渠道',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_search_num` (`search_num`),
  INDEX `idx_states` (`states`),
  INDEX `idx_ship_date` (`Ship_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='物流查询表';





