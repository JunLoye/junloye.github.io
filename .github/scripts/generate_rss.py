#!/usr/bin/env python3
import os
import json
from datetime import datetime, timezone
import requests
import re
import html


def escape_xml(text):
    if not text:
        return ""
    return html.escape(text)


def escape_xml_attr(text):
    if not text:
        return ""
    return html.escape(text, quote=True)


def to_gmt_date(dt):
    gmt_dt = dt.astimezone(timezone.utc)
    return gmt_dt.strftime('%a, %d %b %Y %H:%M:%S GMT')


def wrap_cdata(content):
    if content is None:
        content = ""
    content = content.replace(']]>', ']]]]><![CDATA[')
    return f'<![CDATA[{content}]]>'


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


def extract_cover_image(body):
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
    if not body:
        return ""

    content_match = re.search(r'\[Content\]\s*([\s\S]*?)(?=\n---\s*\n|\n\[References\]|\n\[Cover\]|\n\[Summary\]|$)', body)
    if content_match:
        return content_match.group(1).strip()

    summary_match = re.search(r'\[Summary\]\s*([\s\S]*?)(?=\n---\s*\n|\n\[Content\]|\n\[References\]|$)', body)
    if summary_match:
        return summary_match.group(1).strip()

    return body


def markdown_to_html(markdown_text):
    if not markdown_text:
        return ""

    content = markdown_text

    content = re.sub(r'\[(Cover|Summary|Content|References)\]\s*', '', content)

    code_blocks = []
    def save_code_block(match):
        code_blocks.append(match.group(0))
        return f'%%CODEBLOCK_{len(code_blocks)-1}%%'
    content = re.sub(r'```[\s\S]*?```', save_code_block, content)

    inline_codes = []
    def save_inline_code(match):
        inline_codes.append(match.group(0))
        return f'%%INLINECODE_{len(inline_codes)-1}%%'
    content = re.sub(r'`[^`]+`', save_inline_code, content)

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
    content = re.sub(r'^---+\s*$', r'<hr />', content, flags=re.MULTILINE)

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

    for i, code in enumerate(inline_codes):
        code_content = code.strip('`')
        content = content.replace(f'%%INLINECODE_{i}%%', f'<code>{escape_xml(code_content)}</code>')

    for i, block in enumerate(code_blocks):
        lines = block.split('\n')
        lang = lines[0].replace('```', '').strip()
        code_content = '\n'.join(lines[1:-1]) if len(lines) > 2 else ''
        lang_attr = f' class="language-{escape_xml(lang)}"' if lang else ''
        code_html = f'<pre><code{lang_attr}>{escape_xml(code_content)}</code></pre>'
        content = content.replace(f'%%CODEBLOCK_{i}%%', code_html)

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


def extract_full_html_content(body):
    if not body:
        return ""

    content_md = extract_content_section(body)
    html_content = markdown_to_html(content_md)

    cover_image = extract_cover_image(body)
    if cover_image:
        html_content = f'<p><img src="{escape_xml(cover_image)}" alt="Cover" /></p>\n{html_content}'

    return html_content


def generate_rss_xml():
    config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'config.json')
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    username = config.get('username', 'JunLoye')
    repo = config.get('repo', 'junloye.github.io')

    issues = fetch_github_issues()

    now = datetime.now(timezone.utc)
    now_gmt = to_gmt_date(now)

    lines = []
    lines.append('<?xml version="1.0" encoding="utf-8"?>')
    lines.append('<rss version="2.0">')
    lines.append('<channel>')
    lines.append(f'    <title>Jun Loye\'s Blog</title>')
    lines.append(f'    <link>https://junloye.github.io</link>')
    lines.append(f'    <description>Jun Loye 的个人博客，分享编程技术、生活点滴与思考。涵盖技术、算法与数据结构等内容</description>')
    lines.append(f'    <language>zh-cn</language>')
    lines.append(f'    <pubDate>{now_gmt}</pubDate>')
    lines.append(f'    <generator>GitHub Issues Blog System</generator>')
    lines.append(f'    <atom:link href="https://junloye.github.io/rss.xml" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom"/>')

    if issues:
        for issue in issues:
            title = escape_xml(issue.get('title', 'Untitled'))
            issue_num = issue.get('number', '')
            blog_url = f"https://junloye.github.io/?post={issue_num}"
            github_url = issue.get('html_url', f"https://github.com/{username}/{repo}/issues/{issue_num}")

            body = issue.get('body', '')
            full_html = extract_full_html_content(body)

            created_at = issue.get('created_at', '')
            if created_at:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                pub_date = to_gmt_date(dt)
            else:
                pub_date = now_gmt

            labels = issue.get('labels', [])
            categories = ''
            for label in labels:
                label_name = label.get('name', '')
                if label_name != '反馈':
                    categories += f'\n            <category>{escape_xml(label_name)}</category>'

            lines.append('    <item>')
            lines.append(f'        <title>{title}</title>')
            lines.append(f'        <description>{wrap_cdata(full_html)}</description>')
            lines.append(f'        <link>{blog_url}</link>')
            lines.append(f'        <guid>{github_url}</guid>')
            lines.append(f'        <pubDate>{pub_date}</pubDate>')
            if categories:
                lines.append(f'        {categories.strip()}')
            lines.append('    </item>')
    else:
        lines.append('    <item>')
        lines.append('        <title>RSS Feed Generated</title>')
        lines.append('        <description>RSS feed has been automatically generated by GitHub Actions.</description>')
        lines.append(f'        <link>https://junloye.github.io</link>')
        lines.append(f'        <guid>https://junloye.github.io</guid>')
        lines.append(f'        <pubDate>{now_gmt}</pubDate>')
        lines.append('    </item>')

    lines.append('</channel>')
    lines.append('</rss>')

    return '\n'.join(lines) + '\n'


def main():
    print("Generating RSS feed...")

    rss_content = generate_rss_xml()

    output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'rss.xml')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(rss_content)

    print(f"RSS feed written to {output_path}")

    if os.path.exists(output_path):
        with open(output_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if '<?xml' in content and '<rss' in content:
                print("RSS feed generated successfully!")
                item_count = content.count('<item>')
                print(f"Total items: {item_count}")
            else:
                print("Warning: Generated file may not be valid RSS")
    else:
        print("Error: RSS file was not created")


if __name__ == "__main__":
    main()