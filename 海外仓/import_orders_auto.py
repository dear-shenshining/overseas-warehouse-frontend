#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
自动Excel导入数据库脚本（无需确认）
将 C:\\Users\\Administrator\\Desktop\\海外仓\\待查询订单.xlsx 的发货单号、发货日期和发货渠道
自动导入到数据库 Post_searchs 表的 search_num、Ship_date 和 channel 字段
"""

import pandas as pd
import pymysql
import json
import os
from datetime import datetime, timedelta

def load_db_config(config_path='db_config.json'):
    """加载数据库配置"""
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"找不到数据库配置文件: {config_path}")

    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_database_connection(db_config):
    """获取数据库连接"""
    try:
        conn = pymysql.connect(
            host=db_config["host"],
            port=db_config["port"],
            user=db_config["user"],
            password=db_config["password"],
            database=db_config["database"],
            charset=db_config.get("charset", "utf8mb4"),
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False,
        )
        return conn
    except Exception as e:
        raise Exception(f"数据库连接失败: {e}")

def ensure_Post_searchs_table(cursor):
    """确保Post_searchs表存在"""
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS Post_searchs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            search_num VARCHAR(64) NOT NULL UNIQUE,
            Ship_date DATE NULL,
            states VARCHAR(64) NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """
    )

    # 检查并添加Ship_date列（如果不存在）
    try:
        cursor.execute("ALTER TABLE Post_searchs ADD COLUMN Ship_date DATE NULL")
    except Exception:
        # 列可能已经存在，忽略错误
        pass

    # 检查并添加channel列（如果不存在）
    try:
        cursor.execute("ALTER TABLE Post_searchs ADD COLUMN channel VARCHAR(100) NULL")
    except Exception:
        # 列可能已经存在，忽略错误
        pass

def read_excel_data(excel_path):
    """读取Excel文件的发货单号和发货日期数据"""
    try:
        # 读取Excel文件，第一行作为列名
        df = pd.read_excel(excel_path, header=0)

        if df.empty:
            raise ValueError("Excel文件为空")

        # 检查必要的列是否存在
        required_columns = ['发货单号', '发货日期']
        for col in required_columns:
            if col not in df.columns:
                raise ValueError(f"Excel文件缺少必要的列: {col}")

        # 检查可选列是否存在
        has_channel = '发货渠道' in df.columns

        # 获取发货单号、发货日期和发货渠道数据
        order_data = []
        for index, row in df.iterrows():
            shipping_num = row['发货单号']
            ship_date = row['发货日期']
            channel = row['发货渠道'] if has_channel else None

            # 处理发货单号
            if pd.notna(shipping_num):
                # 处理数字类型，确保不带小数点
                if isinstance(shipping_num, float) and shipping_num.is_integer():
                    # 如果是整数的float，转换为整数再转字符串
                    shipping_num_str = str(int(shipping_num))
                else:
                    # 其他情况直接转字符串并去除空白
                    shipping_num_str = str(shipping_num).strip()
                    # 如果是带.0的float字符串，移除.0
                    if shipping_num_str.endswith('.0'):
                        shipping_num_str = shipping_num_str[:-2]

                if not shipping_num_str:  # 为空字符串跳过
                    continue
            else:
                continue  # 发货单号为空跳过

            # 处理发货日期
            if pd.notna(ship_date):
                try:
                    # 尝试使用pandas的to_datetime统一处理各种日期格式
                    if isinstance(ship_date, str):
                        # 字符串类型，先尝试解析
                        ship_date_parsed = pd.to_datetime(ship_date, errors='coerce')
                        if pd.notna(ship_date_parsed):
                            ship_date_str = ship_date_parsed.strftime('%Y-%m-%d')
                        else:
                            ship_date_str = ship_date.strip()
                    elif isinstance(ship_date, (int, float)):
                        # 整数或浮点数，可能是Excel日期序列号
                        try:
                            # 尝试转换为pandas Timestamp
                            ship_date_parsed = pd.to_datetime(ship_date, origin='1899-12-30', unit='D', errors='coerce')
                            if pd.notna(ship_date_parsed):
                                ship_date_str = ship_date_parsed.strftime('%Y-%m-%d')
                            else:
                                # 如果pandas转换失败，使用手动转换
                                excel_epoch = datetime(1899, 12, 30)
                                days = int(ship_date)
                                date_obj = excel_epoch + timedelta(days=days)
                                ship_date_str = date_obj.strftime('%Y-%m-%d')
                        except Exception:
                            ship_date_str = str(ship_date)
                    elif hasattr(ship_date, 'strftime'):
                        # datetime或Timestamp对象
                        ship_date_str = ship_date.strftime('%Y-%m-%d')
                    else:
                        # 其他类型，尝试用pandas转换
                        ship_date_parsed = pd.to_datetime(ship_date, errors='coerce')
                        if pd.notna(ship_date_parsed):
                            ship_date_str = ship_date_parsed.strftime('%Y-%m-%d')
                        else:
                            ship_date_str = str(ship_date)
                except Exception as e:
                    # 如果所有转换都失败，使用字符串形式
                    ship_date_str = str(ship_date)
            else:
                ship_date_str = None  # 日期为空

            # 处理发货渠道
            if pd.notna(channel):
                channel_str = str(channel).strip()
            else:
                channel_str = None  # 渠道为空

            order_data.append({
                'shipping_num': shipping_num_str,
                'ship_date': ship_date_str,
                'channel': channel_str
            })

        return order_data

    except FileNotFoundError:
        raise FileNotFoundError(f"找不到Excel文件: {excel_path}")
    except Exception as e:
        raise Exception(f"读取Excel文件失败: {e}")

def import_to_database(order_data, db_config):
    """将数据导入数据库"""
    conn = None
    try:
        conn = get_database_connection(db_config)
        cursor = conn.cursor()

        # 确保表存在
        ensure_Post_searchs_table(cursor)

        # 统计
        total = len(order_data)
        inserted = 0
        updated = 0
        skipped = 0

        print(f"准备导入 {total} 条记录...")

        for item in order_data:
            shipping_num = item['shipping_num']
            ship_date = item['ship_date']
            channel = item.get('channel')

            try:
                # 使用INSERT ... ON DUPLICATE KEY UPDATE
                cursor.execute(
                    """
                    INSERT INTO Post_searchs (search_num, Ship_date, channel)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        Ship_date = VALUES(Ship_date),
                        channel = VALUES(channel),
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (shipping_num, ship_date, channel)
                )

                if cursor.rowcount == 1:
                    inserted += 1
                    channel_info = f", 发货渠道: {channel}" if channel else ""
                    print(f"✓ 新增: {shipping_num} (发货日期: {ship_date}{channel_info})")
                else:
                    updated += 1
                    channel_info = f", 发货渠道: {channel}" if channel else ""
                    print(f"↻ 更新: {shipping_num} (发货日期: {ship_date}{channel_info})")

            except Exception as e:
                print(f"❌ 导入失败 {shipping_num}: {e}")
                skipped += 1
                continue

        # 提交事务
        conn.commit()

        print("\n📊 导入结果统计:")
        print(f"  总计: {total}")
        print(f"  新增: {inserted}")
        print(f"  更新: {updated}")
        print(f"  跳过: {skipped}")

        return {
            "total": total,
            "inserted": inserted,
            "updated": updated,
            "skipped": skipped
        }

    except Exception as e:
        if conn:
            conn.rollback()
        raise Exception(f"数据库操作失败: {e}")
    finally:
        if conn:
            conn.close()

def main():
    """主函数"""
    print("🚀 Excel自动导入数据库工具启动")
    print("=" * 50)

    # Excel文件路径
    excel_path = "C:\\Users\\Administrator\\Desktop\\海外仓\\待查询订单.xlsx"

    try:
        # 检查文件是否存在
        if not os.path.exists(excel_path):
            print(f"❌ 找不到Excel文件: {excel_path}")
            input("按回车键退出...")
            return

        # 加载数据库配置
        print("📡 加载数据库配置...")
        db_config = load_db_config('db_config.json')

        # 读取Excel数据
        print(f"📖 读取Excel文件: {excel_path}")
        order_data = read_excel_data(excel_path)
        print(f"📋 读取到 {len(order_data)} 条有效记录")

        if not order_data:
            print("❌ Excel文件中没有找到有效数据")
            input("按回车键退出...")
            return

        # 显示前几个数据示例
        print("\n📋 数据预览:")
        for i, item in enumerate(order_data[:5]):
            channel_info = f", 发货渠道: {item.get('channel', '无')}" if item.get('channel') else ", 发货渠道: 无"
            print(f"  {i+1}. 发货单号: {item['shipping_num']}, 发货日期: {item['ship_date']}{channel_info}")
        if len(order_data) > 5:
            print(f"  ... 还有 {len(order_data) - 5} 条记录")

        # 自动开始导入
        print("\n💾 开始自动导入数据...")
        result = import_to_database(order_data, db_config)

        print("\n✅ 导入完成！")
        print("=" * 50)

    except Exception as e:
        print(f"❌ 执行出错: {e}")
        print("请检查错误信息并重试")

    input("按回车键退出...")

if __name__ == "__main__":
    main()
