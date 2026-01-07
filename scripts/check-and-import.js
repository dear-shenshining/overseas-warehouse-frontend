/**
 * 连接数据库，查看 per_charge 表结构，然后执行导入
 */
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// 从环境变量读取数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'seas_ware',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
}

async function checkAndImport() {
  const pool = new Pool(dbConfig)
  
  try {
    console.log('正在连接数据库...')
    console.log(`数据库: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`)
    
    // 1. 检查表是否存在
    console.log('\n1. 检查 per_charge 表是否存在...')
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'per_charge'
      );
    `)
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ per_charge 表不存在，正在创建...')
      // 创建表
      await pool.query(`
        CREATE TABLE per_charge (
          id SERIAL PRIMARY KEY,
          sku VARCHAR(255) NOT NULL,
          charge VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_sku ON per_charge(sku);
      `)
      console.log('✅ 表已创建')
    } else {
      console.log('✅ per_charge 表已存在')
    }
    
    // 2. 查看表结构
    console.log('\n2. 查看表结构...')
    const structure = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'per_charge'
      ORDER BY ordinal_position;
    `)
    
    console.log('\n表结构:')
    console.table(structure.rows)
    
    // 3. 查看现有数据数量
    console.log('\n3. 查看现有数据...')
    const countResult = await pool.query('SELECT COUNT(*) as count FROM per_charge')
    const currentCount = parseInt(countResult.rows[0].count)
    console.log(`当前表中有 ${currentCount} 条记录`)
    
    // 4. 读取 SQL 文件
    const sqlPath = path.join(process.cwd(), 'sql', 'import_per_charge.sql')
    console.log(`\n4. 读取 SQL 文件: ${sqlPath}`)
    
    if (!fs.existsSync(sqlPath)) {
      console.error('❌ SQL 文件不存在，请先运行 read-excel-to-sql.js 生成 SQL 文件')
      return
    }
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8')
    
    // 5. 询问是否执行导入
    console.log('\n5. 准备导入数据...')
    console.log(`将导入约 11557 条记录`)
    console.log('\n⚠️  注意：')
    console.log('   - 如果表中有数据，新数据将被添加（不会删除旧数据）')
    console.log('   - 如果 SKU 重复，可能会插入失败（取决于是否有唯一约束）')
    console.log('\n是否执行导入？(y/n)')
    
    // 在 Node.js 中，我们需要使用 readline 来获取用户输入
    // 但为了简化，我们可以直接执行，或者添加一个参数
    const shouldImport = process.argv[2] === '--yes' || process.argv[2] === '-y'
    
    if (!shouldImport) {
      console.log('\n💡 提示：要执行导入，请运行:')
      console.log('   node scripts/check-and-import.js --yes')
      console.log('\n或者手动执行 SQL 文件:')
      console.log(`   psql -h ${dbConfig.host} -U ${dbConfig.user} -d ${dbConfig.database} -f ${sqlPath}`)
      return
    }
    
    // 6. 执行导入
    console.log('\n6. 开始导入数据...')
    
    // 提取 INSERT 语句
    const insertMatch = sqlContent.match(/INSERT INTO.*?VALUES\s*([\s\S]*?);/)
    if (!insertMatch) {
      console.error('❌ 无法解析 SQL 文件中的 INSERT 语句')
      return
    }
    
    // 执行 SQL
    await pool.query(sqlContent)
    
    // 7. 验证导入结果
    const newCountResult = await pool.query('SELECT COUNT(*) as count FROM per_charge')
    const newCount = parseInt(newCountResult.rows[0].count)
    const imported = newCount - currentCount
    
    console.log(`\n✅ 导入完成！`)
    console.log(`   - 导入前: ${currentCount} 条记录`)
    console.log(`   - 导入后: ${newCount} 条记录`)
    console.log(`   - 新增: ${imported} 条记录`)
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message)
    if (error.code) {
      console.error('错误代码:', error.code)
    }
  } finally {
    await pool.end()
  }
}

checkAndImport().catch(console.error)

