#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
海外仓爬虫运行脚本
从数据库读取单号，进行爬虫，然后写入数据库
"""

import os
import sys

def main():
    """主函数"""
    print("🚀 海外仓爬虫启动")
    print("=" * 50)

    # 检查数据库配置文件
    if not os.path.exists('db_config.json'):
        print("❌ 错误：找不到数据库配置文件 db_config.json")
        print("请确保 db_config.json 文件存在并正确配置")
        input("按回车键退出...")
        return

    try:
        # 运行爬虫
        print("📡 正在连接数据库并读取单号...")
        os.system('python japan_post_crawler.py')

        print("✅ 爬虫执行完成")
        print("=" * 50)

    except KeyboardInterrupt:
        print("\n⚠️  用户中断执行")
    except Exception as e:
        print(f"❌ 执行出错: {e}")

    input("按回车键退出...")

if __name__ == "__main__":
    main()

