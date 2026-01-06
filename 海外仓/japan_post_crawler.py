#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
日本邮政追踪信息爬虫
用于爬取日本邮政官网的包裹追踪信息
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import os
from typing import Dict, List, Optional
import pymysql
from datetime import datetime


class DatabaseManager:
    """数据库管理类"""
    
    def __init__(self, host='localhost', port=3306, user='root', password='', database='seas_ware', charset='utf8mb4'):
        """
        初始化数据库连接
        
        Args:
            host: 数据库主机地址
            port: 数据库端口
            user: 数据库用户名
            password: 数据库密码
            database: 数据库名称
            charset: 字符集
        """
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.database = database
        self.charset = charset
        self.connection = None
    
    def connect(self):
        """连接数据库"""
        try:
            self.connection = pymysql.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.database,
                charset=self.charset,
                cursorclass=pymysql.cursors.DictCursor
            )
            print(f"成功连接到数据库: {self.database}")
            return True
        except Exception as e:
            print(f"数据库连接失败: {str(e)}")
            return False
    
    def close(self):
        """关闭数据库连接"""
        if self.connection:
            self.connection.close()
            print("数据库连接已关闭")
    
    def create_tables(self):
        """创建数据表"""
        if not self.connection:
            print("数据库未连接")
            return False
        
        try:
            with self.connection.cursor() as cursor:
                # 创建历史记录表
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS tracking_history (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        item_number VARCHAR(50) NOT NULL COMMENT '物品编号',
                        date VARCHAR(50) COMMENT '日期',
                        shipping_track_record VARCHAR(200) COMMENT '配送记录',
                        details TEXT COMMENT '详情',
                        office VARCHAR(100) COMMENT '办公室',
                        zip_code VARCHAR(20) COMMENT '邮编',
                        prefecture VARCHAR(50) COMMENT '都道府县',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                        INDEX idx_item_number (item_number),
                        INDEX idx_date (date)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='追踪历史记录表'
                """)
            
            self.connection.commit()
            print("数据表创建成功")
            return True
        except Exception as e:
            print(f"创建数据表失败: {str(e)}")
            self.connection.rollback()
            return False
    
    def save_tracking_data(self, tracking_number: str, data: Dict) -> bool:
        """
        保存追踪数据到数据库（只保存 history）
        
        Args:
            tracking_number: 追踪号
            data: 追踪数据字典
        
        Returns:
            保存是否成功
        """
        if not self.connection:
            print("数据库未连接")
            return False
        
        try:
            with self.connection.cursor() as cursor:
                # 只保存历史记录，使用 tracking_number 作为 item_number
                if data.get('history'):
                    for history in data['history']:
                        cursor.execute("""
                            INSERT INTO tracking_history 
                            (item_number, date, shipping_track_record, details, office, zip_code, prefecture)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """, (
                            tracking_number,  # 使用 tracking_number 作为 item_number
                            history.get('date', ''),
                            history.get('shipping_track_record', ''),
                            history.get('details', ''),
                            history.get('office', ''),
                            history.get('zip_code', ''),
                            history.get('prefecture', '')
                        ))
                
                self.connection.commit()
                print(f"历史记录已保存到数据库: {tracking_number}")
                return True
        except Exception as e:
            print(f"保存数据到数据库失败: {str(e)}")
            self.connection.rollback()
            return False

    def fetch_pending_search_numbers(self) -> List[Dict]:
        """
        获取需要查询的追踪号（过滤已完成状态）
        Returns:
            [{'search_num': '...', 'states': '...'}, ...]
        """
        if not self.connection:
            print("数据库未连接")
            return []
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    SELECT search_num, states
                    FROM Post_searchs
                    WHERE states NOT IN ('Final delivery', 'Returned to sender')
                       OR states IS NULL
                """)
                rows = cursor.fetchall()
                return rows
        except Exception as e:
            print(f"获取待查询追踪号失败: {str(e)}")
            return []

    def update_search_state(self, search_num: str, new_state: str) -> bool:
        """更新 Post_searchs 表的状态"""
        if not self.connection:
            print("数据库未连接")
            return False
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE Post_searchs SET states = %s WHERE search_num = %s",
                    (new_state, search_num)
                )
            self.connection.commit()
            print(f"已更新 {search_num} 状态为 {new_state}")
            return True
        except Exception as e:
            print(f"更新状态失败: {str(e)}")
            self.connection.rollback()
            return False


class JapanPostCrawler:
    """日本邮政追踪信息爬虫类"""
    
    def __init__(self, db_config: Optional[Dict] = None):
        """
        初始化爬虫
        
        Args:
            db_config: 数据库配置字典，如果提供则自动连接数据库
        """
        self.base_url = "https://trackings.post.japanpost.jp/services/srv/search/direct"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
        
        # 初始化数据库管理器
        self.db_manager = None
        if db_config:
            self.db_manager = DatabaseManager(**db_config)
            if self.db_manager.connect():
                self.db_manager.create_tables()
    
    def fetch_tracking_info(self, tracking_number: str, return_html: bool = False) -> Optional[Dict]:
        """
        获取追踪信息
        
        Args:
            tracking_number: 追踪号（如：628327933074）
            return_html: 是否在返回结果中包含原始HTML
        
        Returns:
            包含追踪信息的字典，如果失败返回None
        """
        # 构建请求URL
        params = {
            'searchKind': 'S004',
            'locale': 'en',
            'reqCodeNo1': tracking_number,
            'x': '29',
            'y': '9'
        }
        
        try:
            # 发送GET请求
            response = requests.get(
                self.base_url,
                params=params,
                headers=self.headers,
                timeout=30
            )
            response.encoding = 'utf-8'
            
            if response.status_code == 200:
                result = self.parse_html(response.text)
                if return_html and result:
                    result['raw_html'] = response.text
                return result
            else:
                print(f"请求失败，状态码: {response.status_code}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"请求异常: {str(e)}")
            return None
    
    def fetch_raw_html(self, tracking_number: str) -> Optional[str]:
        """
        获取原始HTML内容
        
        Args:
            tracking_number: 追踪号（如：628327933074）
        
        Returns:
            原始HTML字符串，如果失败返回None
        """
        params = {
            'searchKind': 'S004',
            'locale': 'en',
            'reqCodeNo1': tracking_number,
            'x': '29',
            'y': '9'
        }
        
        try:
            response = requests.get(
                self.base_url,
                params=params,
                headers=self.headers,
                timeout=30
            )
            response.encoding = 'utf-8'
            
            if response.status_code == 200:
                return response.text
            else:
                print(f"请求失败，状态码: {response.status_code}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"请求异常: {str(e)}")
            return None
    
    def parse_html(self, html_content: str) -> Dict:
        """
        解析HTML内容，提取追踪信息
        
        Args:
            html_content: HTML内容
        
        Returns:
            包含解析后数据的字典
        """
        soup = BeautifulSoup(html_content, 'html.parser')
        
        result = {
            'history': []
        }
        
        # 提取历史信息
        history_table = soup.find('table', {'summary': '履歴情報'})
        if history_table:
            rows = history_table.find_all('tr')
            i = 2  # 跳过表头行
            while i < len(rows):
                row = rows[i]
                cells = row.find_all(['td', 'th'])
                
                if len(cells) >= 5:
                    # 检查是否有rowspan
                    date_cell = cells[0]
                    date = date_cell.get_text(strip=True)
                    
                    # 获取rowspan值
                    rowspan = int(date_cell.get('rowspan', 1))
                    
                    if rowspan == 2:
                        # 第一行数据
                        track_record = cells[1].get_text(strip=True)
                        details = cells[2].get_text(strip=True)
                        office = cells[3].get_text(strip=True)
                        prefecture = cells[4].get_text(strip=True)
                        
                        # 下一行是邮编
                        if i + 1 < len(rows):
                            next_row = rows[i + 1]
                            zip_cells = next_row.find_all('td')
                            zip_code = zip_cells[0].get_text(strip=True) if zip_cells else ""
                        else:
                            zip_code = ""
                        
                        result['history'].append({
                            'date': date,
                            'shipping_track_record': track_record,
                            'details': details,
                            'office': office,
                            'zip_code': zip_code,
                            'prefecture': prefecture
                        })
                        
                        i += 2  # 跳过两行
                    else:
                        i += 1
        
        return result
    
    def save_to_file(self, data: Dict, filepath: str, format: str = 'json'):
        """
        保存数据到文件
        
        Args:
            data: 要保存的数据
            filepath: 文件路径
            format: 保存格式 ('json' 或 'html')
        """
        try:
            if format == 'json':
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
            elif format == 'html':
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(data)
            print(f"数据已保存到: {filepath}")
        except Exception as e:
            print(f"保存文件失败: {str(e)}")
    
    def save_raw_html(self, html_content: str, filepath: str):
        """
        保存原始HTML内容
        
        Args:
            html_content: HTML内容
            filepath: 文件路径
        """
        self.save_to_file(html_content, filepath, format='html')
    
    def save_to_database(self, tracking_number: str, data: Dict) -> bool:
        """
        保存数据到数据库
        
        Args:
            tracking_number: 追踪号
            data: 追踪数据字典
        
        Returns:
            保存是否成功
        """
        if not self.db_manager:
            print("数据库未配置")
            return False
        
        return self.db_manager.save_tracking_data(tracking_number, data)
    
    def close_database(self):
        """关闭数据库连接"""
        if self.db_manager:
            self.db_manager.close()


def load_db_config(config_file: str = 'db_config.json') -> Optional[Dict]:
    """
    从配置文件加载数据库配置
    
    Args:
        config_file: 配置文件路径
    
    Returns:
        数据库配置字典，如果失败返回None
    """
    try:
        if os.path.exists(config_file):
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                print(f"已从配置文件加载数据库配置: {config_file}")
                return config
        else:
            print(f"配置文件不存在: {config_file}，使用默认配置")
            return None
    except Exception as e:
        print(f"加载配置文件失败: {str(e)}")
        return None


def main():
    """主函数"""
    # 尝试从配置文件加载数据库配置
    db_config = load_db_config('db_config.json')
    
    # 如果配置文件不存在或加载失败，使用默认配置
    if not db_config:
        db_config = {
            'host': 'localhost',
            'port': 3306,
            'user': 'root',
            'password': '',  # 请填写数据库密码
            'database': 'seas_ware',
            'charset': 'utf8mb4'
        }
        print("使用默认数据库配置")
    
    # 创建爬虫实例（自动连接数据库）
    crawler = JapanPostCrawler(db_config=db_config)
    
    # 如果配置了数据库，则从 Post_searchs 表读取待查询追踪号
    tracking_numbers = []
    if crawler.db_manager:
        tracking_numbers = crawler.db_manager.fetch_pending_search_numbers()
    
    # 如果数据库没有记录，退回到单个示例追踪号
    if not tracking_numbers:
        tracking_numbers = [{'search_num': "628327933074", 'states': None}]
        print("未在数据库中找到待查询追踪号，使用默认示例。")
    
    # 返回值文件路径（共用）
    return_filepath = r"C:\Users\Administrator\Desktop\海外仓\返回值"

    # 用于收集查询失败的单号
    failed_tracking_numbers = []

    print(f"📋 开始处理 {len(tracking_numbers)} 个追踪号...")
    print("=" * 60)

    for item in tracking_numbers:
        tracking_number = str(item.get('search_num') or item)
        states = item.get('states')
        
        # 跳过已完成的单号
        if states in ('Final delivery', 'Returned to sender'):
            print(f"跳过已完成: {tracking_number} (状态: {states})")
            continue
        
        print(f"\n正在查询追踪号: {tracking_number}")
        print("-" * 50)
        
        # 获取原始HTML并保存到返回值文件
        raw_html = crawler.fetch_raw_html(tracking_number)
        if raw_html:
            crawler.save_raw_html(raw_html, return_filepath)
            print(f"原始HTML已保存到: {return_filepath}")

            # 检查是否为未注册的单号
            if 'Your item was not found' in raw_html:
                print("❌ 发现错误：单号未找到")
                if crawler.db_manager:
                    crawler.db_manager.update_search_state(tracking_number, 'Not registered')
                print("\n" + "=" * 50)
                print("查询完成！")
                continue

        # 获取并解析追踪信息
        result = crawler.fetch_tracking_info(tracking_number)
        
        if result:
            # 打印结果
            print("\n=== 历史信息 ===")
            for idx, record in enumerate(result['history'], 1):
                print(f"\n记录 {idx}:")
                print(f"  日期: {record.get('date', 'N/A')}")
                print(f"  配送记录: {record.get('shipping_track_record', 'N/A')}")
                print(f"  详情: {record.get('details', 'N/A')}")
                print(f"  办公室: {record.get('office', 'N/A')}")
                print(f"  邮编: {record.get('zip_code', 'N/A')}")
                print(f"  都道府县: {record.get('prefecture', 'N/A')}")
            
            # 保存JSON格式数据（只保存 history）
            json_filepath = r"C:\Users\Administrator\Desktop\海外仓\返回值.json"
            crawler.save_to_file(result, json_filepath, format='json')
            
            # 保存到数据库（只保存 history）
            if crawler.db_manager:
                crawler.save_to_database(tracking_number, result)
                
                # 检查最后一条记录的状态并更新 Post_searchs.states
                if result['history']:
                    last_record = result['history'][-1]
                    shipping_record = str(last_record.get('shipping_track_record', ''))

                    # 检查是否为最终配送状态
                    if 'Final delivery' in shipping_record:
                        crawler.db_manager.update_search_state(tracking_number, 'Final delivery')
                    else:
                        # 其他情况如实写入该值
                        crawler.db_manager.update_search_state(tracking_number, shipping_record)
            
            print("\n" + "=" * 50)
            print("查询完成！")
        else:
            print(f"❌ 查询失败: {tracking_number}，请检查追踪号或网络。")
            failed_tracking_numbers.append(tracking_number)

    # 如果有查询失败的单号，进行重试
    if failed_tracking_numbers:
        print(f"\n🔄 发现 {len(failed_tracking_numbers)} 个查询失败的单号，开始重试...")
        print("=" * 60)

        for tracking_number in failed_tracking_numbers:
            print(f"\n🔄 重新查询失败单号: {tracking_number}")
            print("-" * 50)

            # 重新获取原始HTML并保存
            raw_html = crawler.fetch_raw_html(tracking_number)
            if raw_html:
                crawler.save_raw_html(raw_html, return_filepath)
                print(f"原始HTML已保存到: {return_filepath}")

                # 检查是否为未注册的单号
                if 'Your item was not found' in raw_html:
                    print("❌ 发现错误：单号未找到")
                    if crawler.db_manager:
                        crawler.db_manager.update_search_state(tracking_number, 'Not registered')
                    print("\n" + "=" * 50)
                    print("✅ 重试查询成功！")
                    continue

            # 重新获取并解析追踪信息
            result = crawler.fetch_tracking_info(tracking_number)

            if result:
                # 打印结果
                print("\n=== 历史信息 ===")
                for idx, record in enumerate(result['history'], 1):
                    print(f"\n记录 {idx}:")
                    print(f"  日期: {record.get('date', 'N/A')}")
                    print(f"  配送记录: {record.get('shipping_track_record', 'N/A')}")
                    print(f"  详情: {record.get('details', 'N/A')}")
                    print(f"  办公室: {record.get('office', 'N/A')}")
                    print(f"  邮编: {record.get('zip_code', 'N/A')}")
                    print(f"  都道府县: {record.get('prefecture', 'N/A')}")

                # 保存JSON格式数据（只保存 history）
                json_filepath = r"C:\Users\Administrator\Desktop\海外仓\返回值.json"
                crawler.save_to_file(result, json_filepath, format='json')

                # 保存到数据库（只保存 history）
                if crawler.db_manager:
                    crawler.save_to_database(tracking_number, result)

                    # 检查最后一条记录的状态并更新 Post_searchs.states
                    if result['history']:
                        last_record = result['history'][-1]
                        shipping_record = str(last_record.get('shipping_track_record', ''))

                        # 检查是否为最终配送状态
                        if 'Final delivery' in shipping_record:
                            crawler.db_manager.update_search_state(tracking_number, 'Final delivery')
                        else:
                            # 其他情况如实写入该值
                            crawler.db_manager.update_search_state(tracking_number, shipping_record)

                print("\n" + "=" * 50)
                print("✅ 重试查询成功！")
            else:
                print(f"❌ 重试后仍查询失败: {tracking_number}")

        print(f"\n📊 重试完成，共处理 {len(failed_tracking_numbers)} 个失败单号")

    # 关闭数据库连接
    crawler.close_database()


if __name__ == "__main__":
    main()

