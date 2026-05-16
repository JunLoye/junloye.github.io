/**
 * RSS Feed 生成器
 * 由 GitHub Actions 触发，自动从仓库 Issues 生成 RSS feed
 * 使用 /post/NUM 规范URL格式（兼容 ?post=NUM 旧格式）
 */
const fs = require('fs');
const https = require('https');

const OWNER = process.env.GITHUB_REPOSITORY_OWNER;
const REPO = process.env.GITHUB_REPOSITORY.split('/')[1];
const SITE_URL = 'https://' + OWNER + '.github.io';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'GitHub-Actions' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function escapeXml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&')
    .replace(/</g, '<').replace(/>/g, '>')
    .replace(/"/g, '"').replace(/'/g, ''');
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

async function main() {
  try {
    console.log('Generating RSS for: ' + OWNER + '/' + REPO);
    
    const query = encodeURIComponent('repo:' + OWNER + '/' + REPO + ' is:issue is:open');
    const result = await fetch(
      'https://api.github.com/search/issues?q=' + query + '&sort=created&order=desc&per_page=100'
    );

    if (!result.items || result.items.length === 0) {
      console.log('No items found');
      return;
    }

    const items = result.items.filter(issue => {
      const isAuthor = issue.user && issue.user.login === OWNER;
      const hasFeedbackTag = issue.labels.some(l => l.name === '反馈');
      return isAuthor && !hasFeedbackTag;
    });

    if (items.length === 0) {
      console.log('No valid items after filtering');
      return;
    }

    const pubDate = new Date().toUTCString();
    
    const rssItems = items.map(issue => {
      const title = escapeXml(issue.title);
      const postUrl = SITE_URL + '/post/' + issue.number;
      const createdDate = new Date(issue.created_at).toUTCString();
      const label = issue.labels && issue.labels.length > 0
        ? escapeXml(issue.labels[0].name)
        : 'Blog';
      
      // 生成摘要
      let description = '';
      if (issue.body) {
        const summaryMatch = issue.body.match(/\[Summary\]\s*([\s\S]*?)(?=\n---|\[Content\]|###|$)/);
        if (summaryMatch) {
          description = truncate(summaryMatch[1].split('\n').filter(Boolean).slice(0, 3).join(' '), 200);
        } else {
          description = truncate(issue.body
            .replace(/\[Cover\]\s*http\S+/g, '')
            .replace(/\[Content\]/g, '').replace(/\[Summary\]/g, '')
            .replace(/\[References\]/g, '').replace(/!\[.*?\]\(.*?\)/g, '')
            .replace(/#{1,6}\s+/g, '').replace(/```[\s\S]*?```/g, '')
            .trim(), 200);
        }
      }

      return [
        '    <item>',
        '        <title>' + title + '</title>',
        '        <description><![CDATA[<p>' + escapeXml(description) + '</p>]]></description>',
        '        <link>' + postUrl + '</link>',
        '        <guid isPermaLink="true">' + postUrl + '</guid>',
        '        <pubDate>' + createdDate + '</pubDate>',
        '        <category>' + label + '</category>',
        '    </item>'
      ].join('\n');
    }).join('\n');

    const rssXml = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<rss version="2.0"',
      '     xmlns:atom="http://www.w3.org/2005/Atom"',
      '     xmlns:content="http://purl.org/rss/1.0/modules/content/">',
      '<channel>',
      '    <title>' + escapeXml(OWNER) + '\'s Blog</title>',
      '    <link>' + SITE_URL + '</link>',
      '    <description>' + escapeXml(OWNER) + ' 的个人博客，分享编程技术、生活点滴与思考。</description>',
      '    <language>zh-cn</language>',
      '    <lastBuildDate>' + pubDate + '</lastBuildDate>',
      '    <pubDate>' + pubDate + '</pubDate>',
      '    <generator>GitHub Issues Blog System (Auto-Generated)</generator>',
      '    <atom:link href="' + SITE_URL + '/rss.xml" rel="self" type="application/rss+xml"/>',
      rssItems,
      '</channel>',
      '</rss>'
    ].join('\n');

    fs.writeFileSync('rss.xml', rssXml, 'utf-8');
    console.log('RSS feed generated with ' + items.length + ' items');
    console.log('Posts use /post/NUM URL format');

    // 输出文章列表供后续使用
    const postList = items.map(i => ({
      number: i.number,
      title: i.title,
      url: '/post/' + i.number,
      createdAt: i.created_at
    }));
    fs.writeFileSync('post-list.json', JSON.stringify(postList, null, 2), 'utf-8');

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
