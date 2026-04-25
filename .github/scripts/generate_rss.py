#!/usr/bin/env python3
"""
RSS生成脚本
从GitHub Issues生成RSS feed，包含完整文章内容
"""

import os
import json
from datetime import datetime, timezone
import pytz
import requests
import re
import html

# ============================================================
# 辅助函数
# ============================================================

def escape_xml(text):
    """转义XML特殊字符（用于纯文本内容）"""
    if not text:
        return ""
    return html.escape(text)


def escape_xml_attr(text):
    """转义XML属性值中的特殊字符"""
    if not text:
        return ""
    return html.escape(text, quote=True)


def rfc2822_date(dt):
    """将datetime格式化为RFC 2822日期格式（RSS标准）"""
    return dt.strftime('%a, %d %b %Y %H:%M:%S %z')


def wrap_cdata(content):
    """将内容包裹在CDATA中"""
    if content is None:
        content = ""
    # 确保CDATA中不包含嵌套的CDATA结束标记
    content = content.replace(']]>', ']]]]><![CDATA[')
    return f'<![CDATA[{content}]]>'


# ============================================================
# GitHub API 数据获取
# ============================================================

def fetch_github_issues():
    """从GitHub API获取issues"""
    try:
        token = os.environ.get('GITHUB_TOKEN', '')

        config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'config.json')
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)

        username = config.get('username', 'JunLoye')
        repo = config.get('repo', 'junloye.github.io')

        url = f"https://api.github.com/search/issues?q=repo:{username}/{repo}+is:issue+is:open&sort=created&order=desc&per_page=50"

        headers = {}
        if token:
            headers['Authorization'] = f'token {token}'

        print(f"Fetching issues from: {url}")
        response = requests.get(url, headers=headers, timeout=30)
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


# ============================================================
# 内容提取函数
# ============================================================

def extract_cover_image(body):
    """从issue body中提取封面图片URL"""
    if not body:
        return ""

    cover_match = re.search(r'\[Cover\]\s*([^\n]+)', body)
    if cover_match:
        cover_url = cover_match.group(1).strip()
        if re.match(r'^https?://', cover_url):
            return cover_url

    image_match = re.search(r'!\[.*?\]\((https?://[^\s)]+)\)', body)
    if image_match:
        return image_match.group(1)

    return ""

def extract_content_section(body):
    """从issue body中提取[Content]部分的内容（原始markdown）"""
    if not body:
        return ""

    # 首先尝试匹配 [Content] 标签后的内容（使用更安全的分隔符）
    content_match = re.search(r'\[Content\]\s*([\s\S]*?)(?=\n---\s*\n|\n\[References\]|\n\[Cover\]|\n\[Summary\]|$)', body)
    if content_match:
        return content_match.group(1).strip()

    # 降级：如果没有 [Content] 标签，尝试使用 [Summary] 之后的内容
    summary_match = re.search(r'\[Summary\]\s*([\s\S]*?)(?=\n---\s*\n|\n\[Content\]|\n\[References\]|$)', body)
    if summary_match:
        return summary_match.group(1).strip()

    # 最后降级：返回整个 body
    return body

def extract_content_summary(body):
    """从issue body中提取纯文本摘要（用于description）"""
    if not body:
        return ""

    content = extract_content_section(body)

    # 清理markdown格式，保留纯文本
    content = re.sub(r'```[\s\S]*?```', '', content)
    content = re.sub(r'!\[.*?\]\((.*?)\)', r'\1', content)
    content = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', content)
    content = re.sub(r'<[^>]+>', '', content)
    content = re.sub(r'\*\*(.*?)\*\*', r'\1', content)
    content = re.sub(r'\*(.*?)\*', r'\1', content)
    content = re.sub(r'`(.*?)`', r'\1', content)
    content = re.sub(r'^#+\s*', '', content, flags=re.MULTILINE)
    content = re.sub(r'\[(Cover|Summary|Content|References)\]\s*', '', content)
    content = re.sub(r'\s+', ' ', content).strip()

    if len(content) > 250:
        content = content[:247] + "..."

    return escape_xml(content)


def markdown_to_html(markdown_text):
    """将markdown文本转换为简单的HTML（用于content:encoded）"""
    if not markdown_text:
        return ""

    content = markdown_text

    # 移除[Cover]、[Content]、[References]等标签
    content = re.sub(r'\[(Cover|Summary|Content|References)\]\s*', '', content)

    # 保护代码块
    code_blocks = []
    def save_code_block(match):
        code_blocks.append(match.group(0))
        return f'%%CODEBLOCK_{len(code_blocks)-1}%%'
    content = re.sub(r'```[\s\S]*?```', save_code_block, content)

    # 保护行内代码
    inline_codes = []
    def save_inline_code(match):
        inline_codes.append(match.group(0))
        return f'%%INLINECODE_{len(inline_codes)-1}%%'
    content = re.sub(r'`[^`]+`', save_inline_code, content)

    # Markdown -> HTML 转换
    content = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'<img src="\2" alt="\1" />', content)
    content = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', content)
    content = re.sub(r'\*\*\*(.*?)\*\*\*', r'<strong><em>\1</em></strong>', content)
    content = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', content)
    content = re.sub(r'\*(.*?)\*', r'<em>\1</em>', content)
    content = re.sub(r'^###\s+(.*?)$', r'<h3>\1</h3>', content, flags=re.MULTILINE)
    content = re.sub(r'^##\s+(.*?)$', r'<h2>\1</h2>', content, flags=re.MULTILINE)
    content = re.sub(r'^#\s+(.*?)$', r'<h1>\1</h1>', content, flags=re.MULTILINE)
    content = re.sub(r'^- (.*?)$', r'<li>\1</li>', content, flags=re.MULTILINE)
    content = re.sub(r'^\d+\.\s+(.*?)$', r'<li>\1</li>', content, flags=re.MULTILINE)
    # 水平线
    content = re.sub(r'^---+\s*$', r'<hr />', content, flags=re.MULTILINE)
    # 引用 - 处理多行blockquote
    # 先将连续的引用行合并为一个blockquote
    def process_blockquotes(text):
        lines = text.split('\n')
        result = []
        in_bq = False
        bq_lines = []
        for line in lines:
            bq_match = re.match(r'^>\s*(.*)$', line)
            if bq_match:
                bq_lines.append(bq_match.group(1))
                in_bq = True
            else:
                if in_bq:
                    result.append('<blockquote>')
                    for bq_line in bq_lines:
                        result.append(bq_line)
                    result.append('</blockquote>')
                    bq_lines = []
                    in_bq = False
                result.append(line)
        if in_bq:
            result.append('<blockquote>')
            for bq_line in bq_lines:
                result.append(bq_line)
            result.append('</blockquote>')
        return '\n'.join(result)
    content = process_blockquotes(content)

    # 恢复行内代码
    for i, code in enumerate(inline_codes):
        code_content = code.strip('`')
        content = content.replace(f'%%INLINECODE_{i}%%', f'<code>{escape_xml(code_content)}</code>')

    # 恢复代码块
    for i, block in enumerate(code_blocks):
        lines = block.split('\n')
        lang = lines[0].replace('```', '').strip()
        code_content = '\n'.join(lines[1:-1]) if len(lines) > 2 else ''
        lang_attr = f' class="language-{escape_xml(lang)}"' if lang else ''
        code_html = f'<pre><code{lang_attr}>{escape_xml(code_content)}</code></pre>'
        content = content.replace(f'%%CODEBLOCK_{i}%%', code_html)

    # 将行用<p>标签包裹
    lines = content.split('\n')
    processed_lines = []
    in_list = False
    in_blockquote = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if in_list:
                processed_lines.append('</ul>')
                in_list = False
            continue
        if stripped.startswith('<h') or stripped.startswith('</'):
            processed_lines.append(stripped)
        elif stripped.startswith('<li'):
            if not in_list:
                processed_lines.append('<ul>')
                in_list = True
            processed_lines.append(stripped)
        elif stripped == '<blockquote>':
            processed_lines.append(stripped)
            in_blockquote = True
        elif stripped == '</blockquote>':
            processed_lines.append(stripped)
            in_blockquote = False
        elif stripped.startswith('<pre') or stripped.startswith('<hr'):
            if in_list:
                processed_lines.append('</ul>')
                in_list = False
            processed_lines.append(stripped)
        elif stripped.startswith('<img') or stripped.startswith('<a') or stripped.startswith('<strong') or stripped.startswith('<em') or stripped.startswith('<code'):
            processed_lines.append(f'<p>{stripped}</p>')
        else:
            processed_lines.append(f'<p>{stripped}</p>')
    if in_list:
        processed_lines.append('</ul>')

    return '\n'.join(processed_lines)


def extract_full_content(body):
    """从issue body中提取完整HTML内容（用于content:encoded）"""
    if not body:
        return ""

    content_md = extract_content_section(body)
    return markdown_to_html(content_md)


# ============================================================
# RSS XML 生成（使用字符串模板，支持CDATA）
# ============================================================

def generate_rss_xml():
    """生成RSS XML字符串"""
    # 读取配置
    config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'config.json')
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    username = config.get('username', 'JunLoye')
    repo = config.get('repo', 'junloye.github.io')

    # 获取issues
    issues = fetch_github_issues()

    now = datetime.now(pytz.UTC)
    now_rfc = rfc2822_date(now)

    # 构建XML
    lines = []
    lines.append('<?xml version="1.0" encoding="utf-8"?>')
    lines.append('<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">')
    lines.append('    <channel>')
    lines.append(f'        <title>Jun Loye\'s Blog</title>')
    lines.append(f'        <link>https://junloye.github.io</link>')
    lines.append(f'        <description>Jun Loye 的个人博客，分享编程技术、生活点滴与思考。涵盖技术、算法与数据结构等内容</description>')
    lines.append(f'        <language>zh-CN</language>')
    lines.append(f'        <lastBuildDate>{now_rfc}</lastBuildDate>')
    lines.append(f'        <atom:link href="https://junloye.github.io/rss.xml" rel="self" type="application/rss+xml"/>')
    lines.append(f'        <generator>GitHub Issues Blog System</generator>')

    if issues:
        for issue in issues:
            title = escape_xml(issue.get('title', 'Untitled'))
            issue_num = issue.get('number', '')
            blog_url = f"https://junloye.github.io/?post={issue_num}"
            github_url = issue.get('html_url', f"https://github.com/{username}/{repo}/issues/{issue_num}")

            body = issue.get('body', '')
            description = extract_content_summary(body)
            full_content = extract_full_content(body)

            # 封面图片
            cover_image = extract_cover_image(body)
            if cover_image:
                full_content = f'<p><img src="{escape_xml(cover_image)}" alt="Cover" /></p>\n{full_content}'

            # 发布时间
            created_at = issue.get('created_at', '')
            if created_at:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                pub_date = rfc2822_date(dt)
            else:
                pub_date = now_rfc

            # 标签
            labels = issue.get('labels', [])
            categories = ''
            for label in labels:
                label_name = label.get('name', '')
                if label_name != '反馈':
                    categories += f'\n            <category>{escape_xml(label_name)}</category>'

            lines.append('        <item>')
            lines.append(f'            <title>{title}</title>')
            lines.append(f'            <link>{blog_url}</link>')
            lines.append(f'            <guid isPermaLink="true">{github_url}</guid>')
            lines.append(f'            <description>{description}</description>')
            lines.append(f'            <content:encoded>{wrap_cdata(full_content)}</content:encoded>')
            lines.append(f'            <pubDate>{pub_date}</pubDate>')
            lines.append(f'            <comments>{github_url}</comments>')
            if categories:
                lines.append(f'            {categories.strip()}')
            lines.append('        </item>')
    else:
        # 没有issues时添加默认项
        lines.append('        <item>')
        lines.append('            <title>RSS Feed Generated</title>')
        lines.append('            <link>https://junloye.github.io</link>')
        lines.append('            <description>RSS feed has been automatically generated by GitHub Actions.</description>')
        lines.append(f'            <pubDate>{now_rfc}</pubDate>')
        lines.append('            <guid isPermaLink="true">https://junloye.github.io</guid>')
        lines.append('        </item>')

    lines.append('    </channel>')
    lines.append('</rss>')

    return '\n'.join(lines) + '\n'


# ============================================================
# 主函数
# ============================================================

def main():
    """主函数"""
    print("Generating RSS feed...")

    rss_content = generate_rss_xml()

    output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'rss.xml')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(rss_content)

    print(f"RSS feed written to {output_path}")

    # 验证
    if os.path.exists(output_path):
        with open(output_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if '<?xml' in content and '<rss' in content:
                print("RSS feed generated successfully!")
                # 统计文章数
                item_count = content.count('<item>')
                print(f"Total items: {item_count}")
            else:
                print("Warning: Generated file may not be valid RSS")
    else:
        print("Error: RSS file was not created")


if __name__ == "__main__":
    main()
