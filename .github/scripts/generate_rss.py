#!/usr/bin/env python3
"""
RSS生成脚本
从GitHub Issues生成RSS feed
"""

import os
import json
import xml.etree.ElementTree as ET
from xml.dom import minidom
from datetime import datetime
import pytz
import requests
import re
import html

def prettify(elem):
    """返回格式化的XML字符串"""
    rough_string = ET.tostring(elem, encoding='utf-8')
    reparsed = minidom.parseString(rough_string)
    return reparsed.toprettyxml(indent="    ", encoding='utf-8').decode('utf-8')

def fetch_github_issues():
    """从GitHub API获取issues"""
    try:
        # 从环境变量获取token，如果没有则使用无token访问（有限制）
        token = os.environ.get('GITHUB_TOKEN', '')
        
        # 从config.json读取仓库信息
        config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'config.json')
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        username = config.get('username', 'JunLoye')
        repo = config.get('repo', 'junloye.github.io')
        
        # GitHub API URL
        url = f"https://api.github.com/search/issues?q=repo:{username}/{repo}+is:issue+is:open&sort=created&order=desc"
        
        headers = {}
        if token:
            headers['Authorization'] = f'token {token}'
        
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        issues = data.get('items', [])
        
        # 过滤掉非作者的和反馈标签的issues
        filtered_issues = []
        for issue in issues:
            issue_author = issue.get('user', {}).get('login', '')
            is_author = issue_author == username
            has_feedback_tag = any(label.get('name', '') == '反馈' for label in issue.get('labels', []))
            
            if is_author and not has_feedback_tag:
                filtered_issues.append(issue)
            else:
                print(f"跳过文章: {issue.get('title', 'Untitled')} (作者: {issue_author}, 是否作者: {is_author}, 有反馈标签: {has_feedback_tag})")
        
        print(f"过滤后文章数量: {len(filtered_issues)} (总共: {len(issues)})")
        return filtered_issues
        
    except Exception as e:
        print(f"Error fetching GitHub issues: {e}")
        return []

def escape_xml(text):
    """转义XML特殊字符"""
    if not text:
        return ""
    # 使用html.escape来转义XML特殊字符
    return html.escape(text)

def extract_summary(body):
    """从issue body中提取摘要并清理markdown标签"""
    if not body:
        return ""
    
    # 首先移除所有markdown标签：[Cover]、[Summary]、[Content]、[References]
    cleaned_body = re.sub(r'\[(Cover|Summary|Content|References)\]\s*', '', body)
    
    # 移除markdown图片标签
    cleaned_body = re.sub(r'!\[.*?\]\(.*?\)', '', cleaned_body)
    
    # 移除markdown链接标签，保留链接文本
    cleaned_body = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', cleaned_body)
    
    # 移除HTML标签
    cleaned_body = re.sub(r'<[^>]+>', '', cleaned_body)
    
    # 移除markdown格式标记：**、*、`、#等
    cleaned_body = re.sub(r'[*_`#]', '', cleaned_body)
    
    # 移除多余的空格和换行
    cleaned_body = re.sub(r'\s+', ' ', cleaned_body).strip()
    
    # 尝试匹配[Summary]标签（在原始body中）
    summary_match = re.search(r'\[Summary\]\s*([\s\S]*?)(?=\n---|\[Content\]|###|$)', body)
    if summary_match:
        summary = summary_match.group(1).strip()
        # 清理summary中的markdown标签
        summary = re.sub(r'\[(Cover|Summary|Content|References)\]\s*', '', summary)
        summary = re.sub(r'!\[.*?\]\(.*?\)', '', summary)
        summary = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', summary)
        summary = re.sub(r'<[^>]+>', '', summary)
        summary = re.sub(r'[*_`#]', '', summary)
        summary = re.sub(r'\s+', ' ', summary).strip()
        
        # 取前200个字符作为摘要
        if len(summary) > 200:
            summary = summary[:197] + "..."
        return escape_xml(summary)
    
    # 如果没有[Summary]，取清理后的前200个字符
    if len(cleaned_body) > 200:
        cleaned_body = cleaned_body[:197] + "..."
    return escape_xml(cleaned_body)

def generate_rss():
    """生成RSS XML"""
    # 创建RSS根元素
    rss = ET.Element("rss", version="2.0")
    rss.set("xmlns:atom", "http://www.w3.org/2005/Atom")
    
    channel = ET.SubElement(rss, "channel")
    
    # 频道信息
    ET.SubElement(channel, "title").text = "Jun Loye's Blog"
    ET.SubElement(channel, "link").text = "https://junloye.github.io"
    ET.SubElement(channel, "description").text = "Jun Loye 的个人博客，分享编程技术、生活点滴与思考。涵盖技术、算法与数据结构等内容"
    ET.SubElement(channel, "language").text = "zh-CN"
    ET.SubElement(channel, "lastBuildDate").text = datetime.now(pytz.UTC).strftime('%a, %d %b %Y %H:%M:%S %z')
    
    # Atom self link
    atom_link = ET.SubElement(channel, "atom:link")
    atom_link.set("href", "https://junloye.github.io/rss.xml")
    atom_link.set("rel", "self")
    atom_link.set("type", "application/rss+xml")
    
    ET.SubElement(channel, "generator").text = "GitHub Issues Blog System"
    
    # 从GitHub API获取issues
    issues = fetch_github_issues()
    
    if issues:
        for issue in issues:
            item = ET.SubElement(channel, "item")
            ET.SubElement(item, "title").text = escape_xml(issue.get('title', 'Untitled'))
            ET.SubElement(item, "link").text = f"https://junloye.github.io/#post-{issue.get('number', '')}"
            
            # 提取描述
            body = issue.get('body', '')
            description = extract_summary(body)
            ET.SubElement(item, "description").text = description
            
            # 发布时间
            created_at = issue.get('created_at', '')
            if created_at:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                pub_date = dt.strftime('%a, %d %b %Y %H:%M:%S %z')
            else:
                pub_date = datetime.now(pytz.UTC).strftime('%a, %d %b %Y %H:%M:%S %z')
            ET.SubElement(item, "pubDate").text = pub_date
            
            ET.SubElement(item, "guid", isPermaLink="true").text = f"https://junloye.github.io/#post-{issue.get('number', '')}"
            
            # 添加标签作为分类
            labels = issue.get('labels', [])
            for label in labels:
                label_name = label.get('name', '')
                if label_name != '反馈':  # 跳过反馈标签
                    ET.SubElement(item, "category").text = escape_xml(label_name)
    else:
        # 如果没有获取到issues，添加一个默认项目
        print("Warning: No issues fetched, adding default item")
        item = ET.SubElement(channel, "item")
        ET.SubElement(item, "title").text = "RSS Feed Generated"
        ET.SubElement(item, "link").text = "https://junloye.github.io"
        ET.SubElement(item, "description").text = "RSS feed has been automatically generated by GitHub Actions."
        ET.SubElement(item, "pubDate").text = datetime.now(pytz.UTC).strftime('%a, %d %b %Y %H:%M:%S %z')
        ET.SubElement(item, "guid", isPermaLink="true").text = "https://junloye.github.io"
    
    return prettify(rss)

def main():
    """主函数"""
    print("Generating RSS feed...")
    
    # 生成RSS内容
    rss_content = generate_rss()
    
    # 写入文件
    output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'rss.xml')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(rss_content)
    
    print(f"RSS feed written to {output_path}")
    
    # 验证文件
    if os.path.exists(output_path):
        with open(output_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if '<?xml' in content and '<rss' in content:
                print("RSS feed generated successfully!")
            else:
                print("Warning: Generated file may not be valid RSS")
    else:
        print("Error: RSS file was not created")

if __name__ == "__main__":
    main()