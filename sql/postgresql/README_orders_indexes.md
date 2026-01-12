# Orders 表性能优化索引说明

## 概述

此索引文件用于优化"每日发货毛利"模块的查询性能，特别是 `getOrdersStatistics` 和 `getAnomalySKUs` 函数。

## 性能提升预期

- **日期范围查询**：10-50倍性能提升
- **店铺筛选查询**：5-20倍性能提升
- **SKU分组查询**：20-100倍性能提升
- **复合条件查询**：10-50倍性能提升

## 索引列表

### 基础索引

1. **idx_orders_payment_time_date**
   - 字段：`payment_time::date`
   - 用途：日期范围查询和 GROUP BY 日期
   - 查询场景：`WHERE payment_time::date >= ... AND payment_time::date <= ...`

2. **idx_orders_store_name**
   - 字段：`store_name`
   - 用途：店铺筛选
   - 查询场景：`WHERE store_name = ...`

3. **idx_orders_operator**
   - 字段：`operator`
   - 用途：运营人员筛选
   - 查询场景：`WHERE operator = ...`

4. **idx_orders_platform_sku**
   - 字段：`platform_sku`
   - 用途：SKU查询（异常页面）
   - 查询场景：`WHERE platform_sku IS NOT NULL AND platform_sku != ''`

5. **idx_orders_profit_rate_low**
   - 字段：`profit_rate`（部分索引）
   - 用途：毛利率低于20%的订单筛选
   - 查询场景：`WHERE profit_rate IS NOT NULL AND profit_rate < 20`

6. **idx_orders_shipping_refund_zero**
   - 字段：`shipping_refund`（部分索引）
   - 用途：无运费补贴订单筛选
   - 查询场景：`WHERE shipping_refund IS NULL OR shipping_refund = 0`

### 复合索引

7. **idx_orders_payment_time_store_name**
   - 字段：`(payment_time::date, store_name)`
   - 用途：日期 + 店铺组合查询（最常用）
   - 查询场景：`WHERE payment_time::date >= ... AND store_name = ...`

8. **idx_orders_payment_time_operator**
   - 字段：`(payment_time::date, operator)`
   - 用途：日期 + 运营人员组合查询
   - 查询场景：`WHERE payment_time::date >= ... AND operator = ...`

9. **idx_orders_payment_time_platform_sku**
   - 字段：`(payment_time::date, platform_sku)`
   - 用途：日期 + SKU组合查询（异常页面）
   - 查询场景：`WHERE payment_time::date >= ... AND platform_sku IS NOT NULL`

10. **idx_orders_payment_time_store_profit_rate**
    - 字段：`(payment_time::date, store_name, profit_rate)`
    - 用途：日期 + 店铺 + 毛利率组合查询
    - 查询场景：`WHERE payment_time::date >= ... AND store_name = ... AND profit_rate < 20`

11. **idx_orders_payment_time_store_shipping_refund**
    - 字段：`(payment_time::date, store_name, shipping_refund)`
    - 用途：日期 + 店铺 + 运费回款组合查询
    - 查询场景：`WHERE payment_time::date >= ... AND store_name = ... AND shipping_refund = 0`

## 执行方法

### 方法1：使用 psql 命令行（推荐）

```bash
# 连接到数据库
psql -U your_username -d your_database

# 执行索引文件
\i sql/postgresql/add_orders_performance_indexes.sql
```

### 方法2：使用 pgAdmin

1. 打开 pgAdmin
2. 连接到数据库
3. 右键点击数据库 -> Query Tool
4. 打开 `sql/postgresql/add_orders_performance_indexes.sql` 文件
5. 执行 SQL

### 方法3：使用 Node.js 脚本

```javascript
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  // 你的数据库配置
});

async function createIndexes() {
  const sql = fs.readFileSync(
    path.join(__dirname, 'sql/postgresql/add_orders_performance_indexes.sql'),
    'utf8'
  );
  
  // 按分号分割SQL语句，逐条执行
  const statements = sql.split(';').filter(s => s.trim());
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await pool.query(statement);
        console.log('✓ 执行成功');
      } catch (error) {
        console.error('✗ 执行失败:', error.message);
      }
    }
  }
  
  await pool.end();
}

createIndexes();
```

## 执行注意事项

1. **执行时间**：索引创建可能需要较长时间，取决于数据量
   - 10万条数据：约 1-5 分钟
   - 100万条数据：约 10-30 分钟
   - 1000万条数据：约 1-3 小时

2. **使用 CONCURRENTLY**：所有索引都使用 `CONCURRENTLY` 创建，不会锁表
   - 可以在生产环境执行
   - 不会影响正在运行的查询

3. **磁盘空间**：索引会占用额外的磁盘空间
   - 预计占用空间：约为表大小的 20-50%
   - 建议确保有足够的磁盘空间

4. **执行顺序**：可以按顺序执行，也可以并行执行（使用 CONCURRENTLY）

## 验证索引

执行完成后，可以使用以下 SQL 验证索引是否创建成功：

```sql
-- 查看 orders 表的所有索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'orders'
ORDER BY indexname;

-- 查看索引大小
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE tablename = 'orders'
ORDER BY pg_relation_size(indexrelid) DESC;
```

## 性能测试

执行索引前后，可以使用以下 SQL 测试查询性能：

```sql
-- 测试日期范围查询
EXPLAIN ANALYZE
SELECT 
    COUNT(*) as total_orders,
    COALESCE(SUM(total_amount), 0) as total_amount,
    COALESCE(SUM(profit), 0) as total_profit
FROM orders
WHERE payment_time::date >= '2025-01-01'
  AND payment_time::date <= '2025-01-31';

-- 测试日期 + 店铺查询
EXPLAIN ANALYZE
SELECT 
    COUNT(*) as total_orders
FROM orders
WHERE payment_time::date >= '2025-01-01'
  AND payment_time::date <= '2025-01-31'
  AND store_name = '店铺名称';
```

## 维护建议

1. **定期更新统计信息**：
   ```sql
   ANALYZE orders;
   ```

2. **监控索引使用情况**：
   ```sql
   SELECT
       schemaname,
       tablename,
       indexname,
       idx_scan,
       idx_tup_read,
       idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE tablename = 'orders'
   ORDER BY idx_scan DESC;
   ```

3. **清理未使用的索引**（如果发现某些索引从未被使用）：
   ```sql
   DROP INDEX CONCURRENTLY IF EXISTS index_name;
   ```

## 回滚

如果需要删除所有索引（不推荐），可以使用：

```sql
-- 删除所有新创建的索引
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_payment_time_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_store_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_operator;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_platform_sku;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_profit_rate_low;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_shipping_refund_zero;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_payment_time_store_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_payment_time_operator;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_payment_time_platform_sku;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_payment_time_store_profit_rate;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_payment_time_store_shipping_refund;
```

## 问题排查

如果索引创建失败，可能的原因：

1. **权限不足**：确保数据库用户有 CREATE INDEX 权限
2. **磁盘空间不足**：检查磁盘空间
3. **表被锁定**：检查是否有长时间运行的查询
4. **字段不存在**：检查 operator 字段是否存在（某些索引依赖此字段）

## 联系支持

如有问题，请查看：
- PostgreSQL 官方文档：https://www.postgresql.org/docs/
- 索引优化指南：https://www.postgresql.org/docs/current/indexes.html

