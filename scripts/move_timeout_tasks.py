"""
影刀编码版：将超时任务移动到历史任务表
每小时定时执行

超时任务定义：count_down < 0（倒计时为负数）
注意：只插入到 task_history，不删除 task 表中的数据
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import os

# 数据库连接配置（从环境变量读取，或直接配置）
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'your-db-host'),
    'port': int(os.getenv('DB_PORT', '5432')),
    'database': os.getenv('DB_NAME', 'seas_ware'),
    'user': os.getenv('DB_USER', 'neondb_owner'),
    'password': os.getenv('DB_PASSWORD', 'your-password'),
    'sslmode': 'require'  # Neon 数据库需要 SSL
}

def move_timeout_tasks_to_history():
    """
    将超时任务（count_down < 0）移动到历史任务表
    只插入到 task_history，不删除 task 表中的数据
    """
    conn = None
    try:
        # 连接数据库
        print(f"[{datetime.now()}] 开始连接数据库...")
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = False  # 使用事务
        
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # 查询超时任务数量
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM task 
            WHERE count_down < 0
        """)
        timeout_count = cursor.fetchone()['count']
        print(f"[{datetime.now()}] 发现 {timeout_count} 个超时任务")
        
        if timeout_count == 0:
            print(f"[{datetime.now()}] 没有超时任务需要处理")
            return
        
        # 插入超时任务到 task_history
        insert_sql = """
            INSERT INTO task_history (
                ware_sku,
                completed_sale_day,
                charge,
                promised_land,
                completed_at,
                inventory_num,
                sales_num,
                label
            )
            SELECT 
                t.ware_sku,
                t.sale_day AS completed_sale_day,
                t.charge,
                t.promised_land,
                CURRENT_TIMESTAMP AS completed_at,
                t.inventory_num,
                t.sales_num,
                t.label
            FROM task t
            WHERE t.count_down < 0
              AND t.ware_sku NOT IN (
                -- 避免重复插入：检查今天是否已插入过
                SELECT ware_sku 
                FROM task_history 
                WHERE completed_at >= CURRENT_DATE
                  AND completed_at < CURRENT_DATE + INTERVAL '1 day'
              )
        """
        
        cursor.execute(insert_sql)
        inserted_count = cursor.rowcount
        
        # 提交事务
        conn.commit()
        
        print(f"[{datetime.now()}] ✅ 成功插入 {inserted_count} 条超时任务到 task_history")
        print(f"[{datetime.now()}] 注意：task 表中的数据保持不变（未删除）")
        
        # 验证：查询当前超时任务数
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM task 
            WHERE count_down < 0
        """)
        remaining_count = cursor.fetchone()['count']
        print(f"[{datetime.now()}] 当前 task 表中仍有 {remaining_count} 个超时任务")
        
    except psycopg2.Error as e:
        # 发生错误时回滚
        if conn:
            conn.rollback()
        print(f"[{datetime.now()}] ❌ 错误：{e}")
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[{datetime.now()}] ❌ 未知错误：{e}")
        raise
    finally:
        # 关闭连接
        if conn:
            cursor.close()
            conn.close()
            print(f"[{datetime.now()}] 数据库连接已关闭")

if __name__ == '__main__':
    print("=" * 60)
    print("影刀定时任务：移动超时任务到历史任务表")
    print("=" * 60)
    move_timeout_tasks_to_history()
    print("=" * 60)

