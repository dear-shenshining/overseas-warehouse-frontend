/**
 * 读取 Excel 文件并生成 SQL INSERT 语句
 */
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

async function readExcelAndGenerateSQL() {
  const excelPath = path.join(process.cwd(), '新建 XLS 工作表.xls')
  const outputPath = path.join(process.cwd(), 'sql', 'import_per_charge.sql')

  console.log('正在读取 Excel 文件:', excelPath)

  // 读取 Excel 文件
  const workbook = XLSX.readFile(excelPath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  // 转换为 JSON
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

  console.log(`找到 ${data.length} 行数据`)
  console.log('前几行数据:', data.slice(0, 5))

  // 生成 SQL
  let sql = `-- 导入 per_charge 表数据
-- 从 Excel 文件: 新建 XLS 工作表.xls
-- 生成时间: ${new Date().toLocaleString('zh-CN')}

-- 清空现有数据（可选，如果需要重新导入）
-- TRUNCATE TABLE per_charge;

-- 插入数据
INSERT INTO per_charge (sku, charge, created_at, updated_at) VALUES
`

  const values: string[] = []
  const now = new Date().toISOString()

  // 跳过表头，从第二行开始
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length < 2) continue

    const sku = String(row[0] || '').trim()
    const charge = String(row[1] || '').trim()

    // 跳过空行
    if (!sku || !charge) continue

    // 转义单引号
    const escapedSku = sku.replace(/'/g, "''")
    const escapedCharge = charge.replace(/'/g, "''")

    values.push(`('${escapedSku}', '${escapedCharge}', '${now}', '${now}')`)
  }

  sql += values.join(',\n') + ';\n\n'

  // 添加 ON CONFLICT 处理（如果需要更新已存在的记录）
  sql += `-- 如果需要更新已存在的记录，可以使用以下语句：
-- INSERT INTO per_charge (sku, charge, created_at, updated_at) VALUES
-- ${values.slice(0, 3).join(',\n')}
-- ON CONFLICT (sku) DO UPDATE SET
--   charge = EXCLUDED.charge,
--   updated_at = EXCLUDED.updated_at;
`

  // 确保 sql 目录存在
  const sqlDir = path.dirname(outputPath)
  if (!fs.existsSync(sqlDir)) {
    fs.mkdirSync(sqlDir, { recursive: true })
  }

  // 写入 SQL 文件
  fs.writeFileSync(outputPath, sql, 'utf-8')

  console.log(`\n✅ SQL 文件已生成: ${outputPath}`)
  console.log(`共生成 ${values.length} 条 INSERT 语句`)
}

readExcelAndGenerateSQL().catch(console.error)

