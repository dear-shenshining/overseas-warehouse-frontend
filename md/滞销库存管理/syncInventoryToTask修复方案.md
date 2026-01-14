# syncInventoryToTask 函数修复方案

## 一、当前问题

1. **先删除再插入，导致 `created_at` 丢失**
   - 当前逻辑：`DELETE FROM task` → 重新插入所有记录
   - 结果：所有任务的 `created_at` 都被重置为当前时间
   - 影响：倒计时计算错误

2. **任务状态字段未处理**
   - 当前逻辑：只更新 `promised_land`，没有处理 `task_status`
   - 如果任务在完成检查（`task_status=4`）或审核中（`task_status=5`），状态会丢失

3. **任务重复出现逻辑未实现**
   - 需求：如果任务在完成检查/审核中，但 `inventory` 表中重新满足条件，应该流回任务正在进行中

## 二、修复后的逻辑

### 2.1 核心思路

1. **不要先删除所有任务**
2. **检查每个任务是否存在**
3. **根据任务状态决定更新策略**
4. **最后删除不再符合条件的任务**

### 2.2 详细逻辑

```typescript
export async function syncInventoryToTask(): Promise<{ success: boolean; error?: string }> {
  const connection = await getConnection()
  await connection.query('BEGIN')

  try {
    // 1. 从 inventory 表查询符合条件的记录
    const sql = `
      SELECT id, ware_sku, inventory_num, sales_num, sale_day, charge, label
      FROM inventory
      WHERE (label::jsonb @> '[4]'::jsonb)
         OR ((label::jsonb @> '[2]'::jsonb)
             AND NOT (label::jsonb @> '[1]'::jsonb)
             AND NOT (label::jsonb @> '[5]'::jsonb))
    `
    const result = await connection.query(sql)
    const inventoryRecords = result.rows

    // 2. 获取所有现有任务（用于检查是否存在）
    const existingTasksResult = await connection.query(
      'SELECT ware_sku, task_status, promised_land, promised_land_snapshot, created_at FROM task'
    )
    const existingTasksMap = new Map(
      existingTasksResult.rows.map((row: any) => [row.ware_sku, row])
    )

    // 3. 处理每个符合条件的 inventory 记录
    for (const record of inventoryRecords) {
      const labelValue = processLabelField(record.label)
      const existingTask = existingTasksMap.get(record.ware_sku)

      if (existingTask) {
        // 任务已存在，需要更新
        const taskStatus = existingTask.task_status ?? 0
        const promisedLandSnapshot = existingTask.promised_land_snapshot
        const originalCreatedAt = existingTask.created_at

        // 情况1：任务在完成检查（task_status=4）或审核中（task_status=5）
        if (taskStatus === 4 || taskStatus === 5) {
          // 流回任务正在进行中
          // 重置状态：task_status = promised_land_snapshot 或 promised_land
          const newTaskStatus = promisedLandSnapshot ?? existingTask.promised_land ?? 0
          
          await connection.query(
            `UPDATE task SET
              inventory_num = $1,
              sales_num = $2,
              sale_day = $3,
              charge = $4,
              label = $5,
              task_status = $6,
              promised_land = $7,
              promised_land_snapshot = NULL,
              checked_at = NULL,
              reviewed_at = NULL,
              review_status = NULL,
              reject_reason = NULL,
              updated_at = CURRENT_TIMESTAMP
            WHERE ware_sku = $8`,
            [
              record.inventory_num,
              record.sales_num,
              record.sale_day ?? null,
              record.charge ?? null,
              labelValue,
              newTaskStatus,
              newTaskStatus, // promised_land 也同步更新
              record.ware_sku,
            ]
          )
          // 注意：created_at 保持不变，倒计时继续计算
        } else {
          // 情况2：任务在未选择方案（task_status=0）或任务正在进行中（task_status=1/2/3）
          // 正常更新数据字段，保持 created_at 和状态字段不变
          await connection.query(
            `UPDATE task SET
              inventory_num = $1,
              sales_num = $2,
              sale_day = $3,
              charge = $4,
              label = $5,
              updated_at = CURRENT_TIMESTAMP
            WHERE ware_sku = $6`,
            [
              record.inventory_num,
              record.sales_num,
              record.sale_day ?? null,
              record.charge ?? null,
              labelValue,
              record.ware_sku,
            ]
          )
          // 注意：created_at、task_status、promised_land 等保持不变
        }
      } else {
        // 任务不存在，插入新任务
        await connection.query(
          `INSERT INTO task (
            ware_sku, inventory_num, sales_num, sale_day, charge, label, 
            promised_land, task_status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            record.ware_sku,
            record.inventory_num,
            record.sales_num,
            record.sale_day ?? null,
            record.charge ?? null,
            labelValue,
            0, // promised_land 默认为 0（未选择方案）
            0, // task_status 默认为 0（未选择方案）
          ]
        )
      }
    }

    // 4. 删除不再符合条件的任务
    // 获取所有符合条件的 SKU
    const validSkus = inventoryRecords.map((r: any) => r.ware_sku)
    
    if (validSkus.length > 0) {
      // 使用参数化查询，避免 SQL 注入
      const placeholders = validSkus.map((_, index) => `$${index + 1}`).join(',')
      await connection.query(
        `DELETE FROM task WHERE ware_sku NOT IN (${placeholders})`,
        validSkus
      )
    } else {
      // 如果没有符合条件的记录，删除所有任务
      await connection.query('DELETE FROM task')
    }

    await connection.query('COMMIT')
    return { success: true }
  } catch (error: any) {
    await connection.query('ROLLBACK')
    console.error('同步数据到 task 表失败:', error)
    return {
      success: false,
      error: error.message || '同步失败',
    }
  } finally {
    connection.release()
  }
}
```

## 三、关键修复点

### 3.1 保护 created_at 字段

**修复前：**
```sql
DELETE FROM task  -- 先删除所有任务
INSERT INTO task ... VALUES (..., CURRENT_TIMESTAMP, ...)  -- 重新插入，created_at 被重置
```

**修复后：**
```sql
-- 检查任务是否存在
IF EXISTS (SELECT 1 FROM task WHERE ware_sku = ...) THEN
  UPDATE task SET ... WHERE ware_sku = ...  -- 更新时不修改 created_at
ELSE
  INSERT INTO task ... VALUES (..., CURRENT_TIMESTAMP, ...)  -- 新任务才设置 created_at
END IF
```

### 3.2 处理任务状态

**修复前：**
- 只更新 `promised_land`，不处理 `task_status`

**修复后：**
- 如果 `task_status IN (4,5)` → 流回任务正在进行中，重置状态字段
- 如果 `task_status IN (0,1,2,3)` → 保持状态不变，只更新数据字段

### 3.3 任务重复出现逻辑

**修复后：**
- 检测到任务在完成检查/审核中时，自动流回任务正在进行中
- 保持 `created_at` 不变，倒计时继续计算
- 清除 `promised_land_snapshot`、`checked_at`、`reviewed_at` 等字段

## 四、测试场景

### 场景1：新任务创建
- **输入：** inventory 表中有新SKU，label包含4
- **预期：** task 表中插入新任务，`created_at` = 当前时间，`task_status` = 0

### 场景2：已有任务更新（未选择方案）
- **输入：** task 表中已有任务，`task_status` = 0
- **预期：** 更新数据字段，`created_at` 保持不变

### 场景3：已有任务更新（任务正在进行中）
- **输入：** task 表中已有任务，`task_status` = 1/2/3
- **预期：** 更新数据字段，`created_at` 和 `task_status` 保持不变

### 场景4：任务在完成检查中，重新出现
- **输入：** task 表中任务，`task_status` = 4，`promised_land_snapshot` = 2
- **预期：** 
  - 流回任务正在进行中：`task_status` = 2，`promised_land` = 2
  - 清除：`promised_land_snapshot`、`checked_at` 等
  - 保持：`created_at` 不变

### 场景5：任务在审核中，重新出现
- **输入：** task 表中任务，`task_status` = 5，`promised_land_snapshot` = 1
- **预期：** 同场景4

### 场景6：任务不再满足条件
- **输入：** task 表中有任务，但 inventory 表中 label 不再包含2或4
- **预期：** 从 task 表中删除该任务

## 五、注意事项

1. **事务处理：** 所有操作都在一个事务中，确保数据一致性
2. **性能优化：** 使用 Map 存储现有任务，避免多次查询
3. **参数化查询：** 使用参数化查询防止 SQL 注入
4. **错误处理：** 如果同步失败，回滚所有更改

