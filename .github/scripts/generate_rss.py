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

def extract_cover_image(body):
    """从issue body中提取封面图片URL"""
    if not body:
        return ""
    
    # 匹配[Cover]标签后的图片URL
    cover_match = re.search(r'\[Cover\]\s*([^\n]+)', body)
    if cover_match:
        cover_url = cover_match.group(1).strip()
        # 检查是否是有效的URL
        if re.match(r'^https?://', cover_url):
            return cover_url
    
    # 如果没有[Cover]标签，尝试匹配markdown图片
    image_match = re.search(r'!\[.*?\]\((https?://[^\s)]+)\)', body)
    if image_match:
        return image_match.group(1)
    
    return ""

def extract_content_summary(body):
    """从issue body中提取内容摘要（纯文本，用于description）"""
    if not body:
        return ""
    
    # 尝试匹配[Content]标签
    content_match = re.search(r'\[Content\]\s*([\s\S]*?)(?=\n---|\[References\]|###|$)', body)
    if content_match:
        content = content_match.group(1).strip()
    else:
        # 如果没有[Content]标签，使用整个body
        content = body
    
    # 清理markdown格式，但保留文本内容
    # 移除markdown图片标签，但保留图片URL作为文本
    content = re.sub(r'!\[.*?\]\((.*?)\)', r'\1', content)
    
    # 移除markdown链接标签，保留链接文本
    content = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', content)
    
    # 移除HTML标签
    content = re.sub(r'<[^>]+>', '', content)
    
    # 移除markdown格式标记，但保留文本内容
    # 移除粗体标记 **text** -> text
    content = re.sub(r'\*\*(.*?)\*\*', r'\1', content)
    # 移除斜体标记 *text* -> text
    content = re.sub(r'\*(.*?)\*', r'\1', content)
    # 移除内联代码标记 `text` -> text
    content = re.sub(r'`(.*?)`', r'\1', content)
    # 移除标题标记 # text -> text
    content = re.sub(r'^#+\s*', '', content, flags=re.MULTILINE)
    
    # 移除[Cover]、[Content]、[References]等标签
    content = re.sub(r'\[(Cover|Summary|Content|References)\]\s*', '', content)
    
    # 移除多余的空格和换行
    content = re.sub(r'\s+', ' ', content).strip()
    
    # 根据用户示例，取前250个字符作为摘要（更符合实际显示）
    if len(content) > 250:
        content = content[:247] + "..."
    
    return escape_xml(content)


def extract_full_content(body):
    """从issue body中提取完整内容（保留markdown格式，用于content:encoded）"""
    if not body:
        return ""
    
    # 尝试匹配[Content]标签
    content_match = re.search(r'\[Content\]\s*([\s\S]*?)(?=\n---|\[References\]|###|$)', body)
    if content_match:
        content = content_match.group(1).strip()
    else:
        # 如果没有[Content]标签，使用整个body
        content = body
    
    # 移除[Cover]、[Content]、[References]等标签
    content = re.sub(r'\[(Cover|Summary|Content|References)\]\s*', '', content)
    
    # 将markdown转换为简单的HTML格式以在RSS中更好地显示
    # 转换图片 ![alt](url) -> <img src="url" alt="alt" />
    content = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'<img src="\2" alt="\1" />', content)
    # 转换链接 [text](url) -> <a href="url">text</a>
    content = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', content)
    # 转换粗体 **text** -> <strong>text</strong>
    content = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', content)
    # 转换斜体 *text* -> <em>text</em>
    content = re.sub(r'\*(.*?)\*', r'<em>\1</em>', content)
    # 转换内联代码 `text` -> <code>text</code>
    content = re.sub(r'`(.*?)`', r'<code>\1</code>', content)
    # 转换标题 # text -> <h3>text</h3>
    content = re.sub(r'^###\s+(.*?)$', r'<h3>\1</h3>', content, flags=re.MULTILINE)
    content = re.sub(r'^##\s+(.*?)$', r'<h2>\1</h2>', content, flags=re.MULTILINE)
    content = re.sub(r'^#\s+(.*?)$', r'<h1>\1</h1>', content, flags=re.MULTILINE)
    # 转换列表 - 简单处理
    content = re.sub(r'^- (.*?)$', r'<li>\1</li>', content, flags=re.MULTILINE)
    # 将连续的行用<br/>分隔（简单段落处理）
    lines = content.split('\n')
    processed_lines = []
    in_list = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if in_list:
                processed_lines.append('</ul>')
                in_list = False
            continue
        if stripped.startswith('<h') or stripped.startswith('<li') or stripped.startswith('</'):
            processed_lines.append(stripped)
            if stripped.startswith('<li'):
                if not in_list:
                    processed_lines.insert(-1, '<ul>')
                    in_list = True
        elif stripped.startswith('<img') or stripped.startswith('<a') or stripped.startswith('<strong') or stripped.startswith('<em') or stripped.startswith('<code'):
            processed_lines.append(f'<p>{stripped}</p>')
        else:
            processed_lines.append(f'<p>{stripped}</p>')
    if in_list:
        processed_lines.append('</ul>')
    content = '\n'.join(processed_lines)
    
    return escape_xml(content)


def extract_summary(body):
    """从issue body中提取完整的摘要（包含封面图片和内容）"""
    if not body:
        return ""
    
    cover_image = extract_cover_image(body)
    content_summary = extract_content_summary(body)
    
    # 如果有封面图片，将其包含在摘要中
    if cover_image:
        return f"{cover_image} {content_summary}"
    else:
        return content_summary

def generate_rss():
    """生成RSS XML"""
    # 创建RSS根元素
    rss = ET.Element("rss", version="2.0")
    rss.set("xmlns:atom", "http://www.w3.org/2005/Atom")
    rss.set("xmlns:content", "http://purl.org/rss/1.0/modules/content/")
    
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
    
    # 从config.json读取仓库信息（用于构建GitHub链接）
    config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'config.json')
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    username = config.get('username', 'JunLoye')
    repo = config.get('repo', 'junloye.github.io')
    
    # 从GitHub API获取issues
    issues = fetch_github_issues()
    
    if issues:
        for issue in issues:
            item = ET.SubElement(channel, "item")
            ET.SubElement(item, "title").text = escape_xml(issue.get('title', 'Untitled'))
            
            # 博客链接（hash路由）
            blog_url = f"https://junloye.github.io/#post-{issue.get('number', '')}"
            # GitHub Issue 实际链接
            github_url = issue.get('html_url', f"https://github.com/{username}/{repo}/issues/{issue.get('number', '')}")
            
            ET.SubElement(item, "link").text = blog_url
            # 添加GitHub Issue链接作为备用链接
            ET.SubElement(item, "comments").text = github_url
            
            # 提取描述（纯文本摘要）和完整内容（HTML格式）
            body = issue.get('body', '')
            description = extract_summary(body)
            ET.SubElement(item, "description").text = description
            
            # 添加完整内容（使用content:encoded命名空间）
            full_content = extract_full_content(body)
            # 如果有封面图片，在内容开头插入
            cover_image = extract_cover_image(body)
            if cover_image:
                full_content = f'<p><img src="{escape_xml(cover_image)}" alt="Cover" /></p>\n{full_content}'
            content_encoded = ET.SubElement(item, "{http://purl.org/rss/1.0/modules/content/}encoded")
            content_encoded.text = full_content
            
            # 发布时间
            created_at = issue.get('created_at', '')
            if created_at:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                pub_date = dt.strftime('%a, %d %b %Y %H:%M:%S %z')
            else:
                pub_date = datetime.now(pytz.UTC).strftime('%a, %d %b %Y %H:%M:%S %z')
            ET.SubElement(item, "pubDate").text = pub_date
            
            # GUID使用GitHub Issue的URL，更稳定
            ET.SubElement(item, "guid", isPermaLink="true").text = github_url
            
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