// archive.js
document.addEventListener('DOMContentLoaded', () => {
    const fileDetailContainer = document.getElementById('file-detail');
    const CONFIG_SOURCE = '/data/archive.json';

    async function initArchive() {
        try {
            const configRes = await fetch(CONFIG_SOURCE);
            if (!configRes.ok) throw new Error('无法读取 archive.json');
            const repoList = await configRes.json();

            fileDetailContainer.innerHTML = '';
            await Promise.all(repoList.map(repo => fetchRepoReleases(repo)));
        } catch (error) {
            console.error('初始化失败:', error);
            fileDetailContainer.innerHTML = `<p style="padding:20px; color:var(--text-soft);">加载失败: ${error.message}</p>`;
        }
    }

    async function fetchRepoReleases(repoInfo) {
        try {
            const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/releases`;
            const response = await fetch(apiUrl);
            if (!response.ok) return;

            const releases = await response.json();
            if (releases.length === 0) return;

            const latest = releases.find(r => !r.prerelease);
            const pre = releases.find(r => r.prerelease);

            if (latest) renderCard(latest, repoInfo, 'latest');
            if (pre) renderCard(pre, repoInfo, 'pre');
        } catch (e) {
            console.warn(`无法获取 ${repoInfo.repo} 的版本信息:`, e);
        }
    }

    /**
     * GitHub Alert 解析器 (修复 [!CAUTION] 等)
     */
    function parseGitHubAlerts(text) {
        const alertTypes = {
            'NOTE': { icon: 'ℹ️', color: '#0969da' },
            'TIP': { icon: '💡', color: '#1a7f37' },
            'IMPORTANT': { icon: '💬', color: '#8250df' },
            'WARNING': { icon: '⚠️', color: '#9a6700' },
            'CAUTION': { icon: '🚫', color: '#d1242f' }
        };

        return text.replace(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?([\s\S]*?)(?=\n[^>]|$)/gm, (match, type, content) => {
            const config = alertTypes[type];
            return `<div class="gh-alert gh-alert-${type.toLowerCase()}" style="border-left: 4px solid ${config.color}; background: rgba(128,128,128,0.05); padding: 12px 16px; margin: 16px 0; border-radius: 6px;">
                        <div style="color: ${config.color}; font-weight: 700; display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 0.9rem;">
                            <span>${config.icon}</span> ${type}
                        </div>
                        <div class="alert-content">${content.replace(/^>\s?/gm, '').trim()}</div>
                    </div>`;
        });
    }

    /**
     * 文本预处理器：修复 --- 和 ## 无法解析的问题
     */
    function preProcessMarkdown(text) {
        if (!text) return "";

        return text
            // 1. 修复分割线：确保 --- 前后有换行，否则会被识别为普通文本或上标题的下划线
            .replace(/^---$/gm, '\n---\n')
            
            // 2. 修复标题：确保 # 后面有空格，且 # 前面有换行（GitHub 原始文本常缺失换行）
            .replace(/^#+(?=[^#\s])/gm, (match) => match + ' ') 
            .replace(/([^\n])\n(#+\s)/g, '$1\n\n$2')

            // 3. 移除特殊的回车符 (\r\n 转 \n)，防止解析器对多行识别失效
            .replace(/\r\n/g, '\n')

            // 4. 过滤 README 干扰
            .replace(/^#\s*README.*$/gim, "")
            .trim();
    }

    function renderCard(release, repoInfo, type) {
        const card = document.createElement('div');
        card.className = 'archive-card';

        const dateStr = new Date(release.published_at).toLocaleDateString('zh-CN', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        const isStable = type === 'latest';
        const tagHTML = isStable ? '<span class="tag tag-latest">Stable</span>' : '<span class="tag tag-pre">Pre-release</span>';
        
        let htmlContent = "";
        let rawBody = release.body || "";

        if (repoInfo.hideBody) {
            htmlContent = '<p style="color:var(--text-soft); font-style:italic;">更新日志已隐藏</p>';
        } else {
            // 依次执行：文本预处理 -> GitHub Alert 处理 -> Markdown 渲染
            rawBody = preProcessMarkdown(rawBody);
            rawBody = parseGitHubAlerts(rawBody);
            
            if (typeof marked !== 'undefined') {
                htmlContent = marked.parse(rawBody);
            } else {
                htmlContent = `<div style="white-space: pre-wrap;">${rawBody}</div>`;
            }
        }

        card.innerHTML = `
            <div class="card-header">
                <div>
                    <small style="color:var(--accent); font-weight:bold; opacity:0.8;">${repoInfo.owner} / ${repoInfo.repo}</small>
                    <h2 style="margin: 5px 0 0 0; font-size: 1.4rem;">${release.name || release.tag_name}</h2>
                </div>
                ${tagHTML}
            </div>
            <div class="content-body markdown-body">
                ${htmlContent}
            </div>
            <div class="share-links">
                <a href="${release.html_url}" target="_blank" class="btn-secondary">仓库主页</a>
                <a href="${release.zipball_url}" class="btn-primary">源码 (ZIP)</a>
                ${release.assets && release.assets.length > 0 ? 
                    `<a href="${release.assets[0].browser_download_url}" class="btn-primary">下载资源</a>` : ''}
            </div>
        `;
        fileDetailContainer.appendChild(card);
    }

    initArchive();
});