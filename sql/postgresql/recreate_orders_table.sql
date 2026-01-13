-- ============================================================
-- 重建 orders 表（完整版）
-- PostgreSQL 版本
-- 警告：此操作会删除现有的 orders 表及其所有数据，请务必备份！
-- ============================================================

-- ============================================================
-- 执行前检查
-- ============================================================

-- 1. 检查表是否存在
-- SELECT EXISTS (
--     SELECT FROM information_schema.tables 
--     WHERE table_schema = 'public' 
--     AND table_name = 'orders'
-- );

-- 2. 检查表的依赖关系（外键、视图等）
-- SELECT 
--     tc.table_name, 
--     kcu.column_name, 
--     ccu.table_name AS foreign_table_name,
--     ccu.column_name AS foreign_column_name 
-- FROM information_schema.table_constraints AS tc 
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY' 
--   AND tc.table_name = 'orders';

-- 3. 检查是否有视图依赖此表
-- SELECT 
--     table_name as view_name
-- FROM information_schema.views
-- WHERE table_schema = 'public'
--   AND view_definition LIKE '%orders%';

-- ============================================================
-- 第一步：删除现有表（如果存在）
-- ============================================================

-- 删除触发器（如果存在）
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;

-- 删除表（CASCADE 会删除所有依赖项，包括外键约束、索引等）
-- 警告：这会删除所有数据！
DROP TABLE IF EXISTS orders CASCADE;

-- 注意：删除表后，序列 orders_id_seq 可能仍然存在
-- SQL 中会自动删除并重新创建序列，确保从1开始

-- ============================================================
-- 第二步：创建序列（如果不存在）
-- ============================================================

-- 创建序列用于 id 字段的自增
-- 如果序列已存在，先删除再创建（确保从1开始）
DROP SEQUENCE IF EXISTS orders_id_seq CASCADE;
CREATE SEQUENCE orders_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- ============================================================
-- 第三步：创建触发器函数（如果不存在）
-- ============================================================

-- 创建或替换触发器函数：自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================
-- 第四步：创建表结构
-- ============================================================

CREATE TABLE "public"."orders" (
  "id" int4 NOT NULL DEFAULT nextval('orders_id_seq'::regclass),
  "order_number" varchar(255) COLLATE "pg_catalog"."default" NOT NULL,
  "store_name" varchar(255) COLLATE "pg_catalog"."default" DEFAULT NULL::character varying,
  "operator" varchar(50) COLLATE "pg_catalog"."default",
  "payment_time" timestamp(6),
  "platform_sku" varchar(255) COLLATE "pg_catalog"."default" DEFAULT NULL::character varying,
  "logistics_channel" varchar(255) COLLATE "pg_catalog"."default" DEFAULT NULL::character varying,
  "order_status" varchar(255) COLLATE "pg_catalog"."default" DEFAULT NULL::character varying,
  "total_product_cost" numeric(10,2) DEFAULT 0,
  "actual_shipping_fee" numeric(10,2) DEFAULT 0,
  "product_and_shipping_cost" numeric(10,2) DEFAULT 0,
  "profit" numeric(10,2) DEFAULT 0,
  "profit_rate" numeric(10,2) DEFAULT 0,
  "sales_refund" numeric(10,2) DEFAULT 0,
  "shipping_refund" numeric(10,2) DEFAULT 0,
  "total_amount" numeric(10,2) DEFAULT 0,
  "created_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_order_number_key" UNIQUE ("order_number")
);

-- 设置表所有者（根据实际情况修改）
-- ALTER TABLE "public"."orders" OWNER TO "neondb_owner";

-- ============================================================
-- 第五步：创建索引
-- ============================================================

-- 基础索引
CREATE INDEX "idx_order_number" ON "public"."orders" USING btree (
  "order_number" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

CREATE INDEX "idx_order_status" ON "public"."orders" USING btree (
  "order_status" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

CREATE INDEX "idx_payment_time" ON "public"."orders" USING btree (
  "payment_time" "pg_catalog"."timestamp_ops" ASC NULLS LAST
);

CREATE INDEX "idx_platform_sku" ON "public"."orders" USING btree (
  "platform_sku" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

CREATE INDEX "idx_store_name" ON "public"."orders" USING btree (
  "store_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- 运营人员索引
CREATE INDEX "idx_orders_operator" ON "public"."orders" USING btree (
  "operator" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- 日期索引（用于日期范围查询）
CREATE INDEX "idx_orders_payment_time_date" ON "public"."orders" USING btree (
  (payment_time::date) "pg_catalog"."date_ops" ASC NULLS LAST
);

-- 复合索引：日期 + 运营人员
CREATE INDEX "idx_orders_payment_time_operator" ON "public"."orders" USING btree (
  (payment_time::date) "pg_catalog"."date_ops" ASC NULLS LAST,
  "operator" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE payment_time IS NOT NULL AND operator IS NOT NULL;

-- 复合索引：日期 + SKU
CREATE INDEX "idx_orders_payment_time_platform_sku" ON "public"."orders" USING btree (
  (payment_time::date) "pg_catalog"."date_ops" ASC NULLS LAST,
  "platform_sku" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE payment_time IS NOT NULL AND platform_sku IS NOT NULL AND platform_sku::text <> ''::text;

-- 复合索引：日期 + 店铺
CREATE INDEX "idx_orders_payment_time_store_name" ON "public"."orders" USING btree (
  (payment_time::date) "pg_catalog"."date_ops" ASC NULLS LAST,
  "store_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE payment_time IS NOT NULL AND store_name IS NOT NULL;

-- 复合索引：日期 + 店铺 + 利润率（用于异常查询）
CREATE INDEX "idx_orders_payment_time_store_profit_rate" ON "public"."orders" USING btree (
  (payment_time::date) "pg_catalog"."date_ops" ASC NULLS LAST,
  "store_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
  "profit_rate" "pg_catalog"."numeric_ops" ASC NULLS LAST
) WHERE payment_time IS NOT NULL AND store_name IS NOT NULL AND profit_rate IS NOT NULL AND profit_rate < 20::numeric;

-- 复合索引：日期 + 店铺 + 运费回款（用于异常查询）
CREATE INDEX "idx_orders_payment_time_store_shipping_refund" ON "public"."orders" USING btree (
  (payment_time::date) "pg_catalog"."date_ops" ASC NULLS LAST,
  "store_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
  "shipping_refund" "pg_catalog"."numeric_ops" ASC NULLS LAST
) WHERE payment_time IS NOT NULL AND store_name IS NOT NULL AND (shipping_refund IS NULL OR shipping_refund = 0::numeric);

-- 部分索引：SKU（非空且非空字符串）
CREATE INDEX "idx_orders_platform_sku" ON "public"."orders" USING btree (
  "platform_sku" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE platform_sku IS NOT NULL AND platform_sku::text <> ''::text;

-- 部分索引：低利润率（用于异常查询）
CREATE INDEX "idx_orders_profit_rate_low" ON "public"."orders" USING btree (
  "profit_rate" "pg_catalog"."numeric_ops" ASC NULLS LAST
) WHERE profit_rate IS NOT NULL AND profit_rate < 20::numeric;

-- 部分索引：运费回款为零或NULL（用于异常查询）
CREATE INDEX "idx_orders_shipping_refund_zero" ON "public"."orders" USING btree (
  "shipping_refund" "pg_catalog"."numeric_ops" ASC NULLS LAST
) WHERE shipping_refund IS NULL OR shipping_refund = 0::numeric;

-- 部分索引：店铺名（非空）
CREATE INDEX "idx_orders_store_name" ON "public"."orders" USING btree (
  "store_name" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
) WHERE store_name IS NOT NULL;

-- ============================================================
-- 第六步：创建触发器
-- ============================================================

-- 创建触发器：自动更新 updated_at 字段
CREATE TRIGGER "update_orders_updated_at" 
  BEFORE UPDATE ON "public"."orders"
  FOR EACH ROW
  EXECUTE PROCEDURE "public"."update_updated_at_column"();

-- ============================================================
-- 第七步：添加表和字段注释
-- ============================================================

COMMENT ON TABLE "public"."orders" IS '订单表';

COMMENT ON COLUMN "public"."orders"."id" IS '主键ID';
COMMENT ON COLUMN "public"."orders"."order_number" IS '订单编号（唯一标识）';
COMMENT ON COLUMN "public"."orders"."store_name" IS '店铺名';
COMMENT ON COLUMN "public"."orders"."operator" IS '店铺运营人员';
COMMENT ON COLUMN "public"."orders"."payment_time" IS '付款时间';
COMMENT ON COLUMN "public"."orders"."platform_sku" IS '平台SKU';
COMMENT ON COLUMN "public"."orders"."logistics_channel" IS '物流渠道';
COMMENT ON COLUMN "public"."orders"."order_status" IS '订单状态';
COMMENT ON COLUMN "public"."orders"."total_product_cost" IS '商品总成本';
COMMENT ON COLUMN "public"."orders"."actual_shipping_fee" IS '实际运费';
COMMENT ON COLUMN "public"."orders"."product_and_shipping_cost" IS '商品及运费成本（商品总成本 + 实际运费）';
COMMENT ON COLUMN "public"."orders"."profit" IS '毛利（总计金额 - 商品及运费成本）';
COMMENT ON COLUMN "public"."orders"."profit_rate" IS '利润率（毛利 / 结算总金额 * 100%）';
COMMENT ON COLUMN "public"."orders"."sales_refund" IS '销售回款';
COMMENT ON COLUMN "public"."orders"."shipping_refund" IS '运费回款';
COMMENT ON COLUMN "public"."orders"."total_amount" IS '结算总金额';
COMMENT ON COLUMN "public"."orders"."created_at" IS '创建时间';
COMMENT ON COLUMN "public"."orders"."updated_at" IS '更新时间';

-- ============================================================
-- 执行后验证
-- ============================================================

-- 1. 验证表是否创建成功
-- SELECT EXISTS (
--     SELECT FROM information_schema.tables 
--     WHERE table_schema = 'public' 
--     AND table_name = 'orders'
-- );

-- 2. 验证所有字段是否存在
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders'
-- ORDER BY ordinal_position;

-- 3. 验证所有索引是否创建成功
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public' 
--   AND tablename = 'orders'
-- ORDER BY indexname;

-- 4. 验证触发器是否创建成功
-- SELECT trigger_name, event_manipulation, event_object_table, action_statement
-- FROM information_schema.triggers
-- WHERE event_object_schema = 'public' 
--   AND event_object_table = 'orders';

-- ============================================================
-- 重要注意事项
-- ============================================================
-- 
-- 1. ⚠️ 执行前务必备份数据！
--    - 此操作会删除所有现有数据
--    - 建议先导出数据：pg_dump 或 COPY 命令
-- 
-- 2. 序列（SERIAL）处理：
--    - SQL 会自动删除旧序列（如果存在）并创建新序列
--    - 新序列从 1 开始，确保 ID 连续
--    - 如果不想重置序列，可以注释掉序列创建部分，使用现有序列
-- 
-- 3. 表所有者：
--    - 默认情况下，表的所有者是执行 SQL 的用户
--    - 如果需要指定所有者，取消注释 ALTER TABLE ... OWNER TO 语句
-- 
-- 4. 索引创建顺序：
--    - 基础索引先创建
--    - 复合索引和部分索引后创建
--    - 如果数据量大，建议在数据导入后再创建索引（更快）
-- 
-- 5. 触发器函数：
--    - update_updated_at_column() 函数会被创建或替换
--    - 如果其他表也使用此函数，不会受影响
-- 
-- 6. 字段顺序：
--    - 已按照你提供的 SQL 调整字段顺序
--    - operator 字段在 store_name 之后
-- 
-- 7. 数据导入：
--    - 表创建完成后，可以使用 COPY 或 INSERT 导入数据
--    - 如果数据量大，建议分批导入
-- 
-- 8. 性能优化：
--    - 如果数据量很大，可以先导入数据，再创建索引（更快）
--    - 使用 CONCURRENTLY 创建索引可以避免锁表（但需要先创建表）
-- 
-- ============================================================

