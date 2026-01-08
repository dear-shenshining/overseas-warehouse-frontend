# 🚨 Vercel Hobby 计划超时问题解决方案

## ❌ 问题说明

**外部 cron 服务无法绕过 Vercel Hobby 计划的限制！**

- Vercel Hobby 计划：函数执行时间限制为 **10 秒**
- 外部 cron（如 cron-job.org）只是发送 HTTP 请求
- API 路由仍在 Vercel 的 serverless 函数中执行
- **仍然受到 10 秒限制**

---

## ✅ 解决方案

### 方案 1：分批处理（推荐，无需升级）

**原理**：将大任务拆分成多个小批次，每次只处理一部分数据。

**使用方法**：

1. **第一次调用**（处理前 100 条）：
   ```
   https://your-domain.com/api/update-countdown?secret=YOUR_SECRET&batchSize=100&offset=0
   ```

2. **如果返回 `hasMore: true`**，继续调用返回的 `nextBatchUrl`

3. **在 cron-job.org 中设置多个任务**：
   - 任务 1：每小时的 0 分执行（处理批次 1）
   - 任务 2：每小时的 5 分执行（处理批次 2）
   - 任务 3：每小时的 10 分执行（处理批次 3）
   - ...（根据数据量调整）

**优点**：
- ✅ 无需升级 Vercel 计划
- ✅ 完全免费
- ✅ 可以处理任意大小的数据

**缺点**：
- ⚠️ 需要设置多个 cron 任务
- ⚠️ 需要手动管理批次

---

### 方案 2：使用 Vercel Cron Jobs（Hobby 计划限制）

**配置**：已在 `vercel.json` 中配置

```json
{
  "crons": [
    {
      "path": "/api/update-countdown?secret=YOUR_SECRET_KEY&batchSize=100",
      "schedule": "0 * * * *"
    }
  ]
}
```

**限制**：
- ⚠️ Hobby 计划：**每天只能执行 1 次**
- ⚠️ 仍然受 10 秒执行时间限制

**适用场景**：
- 数据量小（< 1000 条）
- 每天只需要更新一次

---

### 方案 3：优化查询性能

**方法**：

1. **为 `task` 表添加索引**：
   ```sql
   CREATE INDEX IF NOT EXISTS idx_task_created_at ON task(created_at);
   CREATE INDEX IF NOT EXISTS idx_task_promised_land ON task(promised_land);
   ```

2. **检查数据量**：
   ```sql
   SELECT COUNT(*) FROM task WHERE created_at IS NOT NULL;
   ```

3. **如果数据量 < 500 条**，通常可以在 10 秒内完成

---

### 方案 4：升级到 Vercel Pro 计划

**优点**：
- ✅ 函数执行时间限制：**60 秒**
- ✅ Cron Jobs：每天可执行多次
- ✅ 更多资源配额

**价格**：$20/月

**适用场景**：
- 数据量大（> 1000 条）
- 需要频繁更新（每小时）
- 预算允许

---

## 🎯 推荐方案

### 如果数据量 < 500 条：
使用 **方案 3（优化查询）** + **方案 2（Vercel Cron）**

### 如果数据量 > 500 条：
使用 **方案 1（分批处理）**

### 如果需要频繁更新且预算允许：
使用 **方案 4（升级 Pro 计划）**

---

## 📝 分批处理详细说明

### 自动分批处理脚本

如果需要自动处理所有批次，可以创建一个简单的脚本：

```bash
#!/bin/bash
SECRET="your_secret_key"
BASE_URL="https://your-domain.com/api/update-countdown"
BATCH_SIZE=100
OFFSET=0

while true; do
  URL="${BASE_URL}?secret=${SECRET}&batchSize=${BATCH_SIZE}&offset=${OFFSET}"
  RESPONSE=$(curl -s "$URL")
  
  # 检查是否成功
  if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "批次 ${OFFSET} 处理成功"
    
    # 检查是否还有更多
    if echo "$RESPONSE" | grep -q '"hasMore":true'; then
      # 提取下一个 offset（需要解析 JSON）
      OFFSET=$((OFFSET + BATCH_SIZE))
      echo "继续处理批次 ${OFFSET}..."
      sleep 2  # 等待 2 秒再处理下一批次
    else
      echo "所有批次处理完成！"
      break
    fi
  else
    echo "处理失败: $RESPONSE"
    break
  fi
done
```

### 在 cron-job.org 中使用

1. 创建多个 cron 任务，每个任务处理不同的批次
2. 设置不同的执行时间（例如：每小时的不同分钟）
3. 每个任务使用不同的 `offset` 参数

---

## 🔍 测试和监控

### 测试单个批次：
```bash
curl "https://your-domain.com/api/update-countdown?secret=YOUR_SECRET&batchSize=100&offset=0"
```

### 查看执行时间：
- Vercel Dashboard → Deployments → Functions → Logs
- 查看 `duration` 字段

### 监控超时：
- 如果经常超时，减小 `batchSize`（例如：从 100 改为 50）
- 如果执行很快，可以增大 `batchSize`（例如：从 100 改为 200）

---

## ⚠️ 注意事项

1. **批次大小选择**：
   - 建议从 `batchSize=100` 开始
   - 根据实际执行时间调整
   - 确保单批次在 8 秒内完成

2. **数据库索引**：
   - 确保 `task` 表的 `created_at` 和 `id` 字段有索引
   - 可以显著提升查询速度

3. **错误处理**：
   - 如果某个批次失败，可以重试
   - 不会影响其他批次

4. **数据一致性**：
   - 分批处理是安全的
   - 每个批次使用事务，确保数据一致性

---

## 📚 相关文档

- [Vercel 计划对比](https://vercel.com/pricing)
- [Vercel Cron Jobs 文档](https://vercel.com/docs/cron-jobs)
- [PostgreSQL 索引优化](https://www.postgresql.org/docs/current/indexes.html)

