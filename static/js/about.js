async function openAbout(pushState = true) {
    const overlay = document.getElementById('about-overlay');
    if (!overlay) return;

    if (overlay.innerHTML.trim() === "") {
        try {
            const resp = await fetch('/about.html');
            if (!resp.ok) throw new Error("无法读取 about.html");
            overlay.innerHTML = await resp.text();
        } catch (e) {
            console.error(e);
            if (typeof showNotification === 'function') showNotification("加载 About 失败", "error");
            return;
        }
    }

    const content = document.getElementById('about-content');
    if (!content) return;
    
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        content.classList.add('show');
    }, 50);

    // 填充统计数据和元信息
    populateAboutMeta();
    populateAboutStats();
    fetchGitHubCommits();
}

function populateAboutMeta() {
    // 从 CONFIG 动态填充 about 页面的标题和头像
    if (typeof CONFIG !== 'undefined' && CONFIG.site) {
        const aboutTitle = document.querySelector('.about-title-group h1');
        if (aboutTitle && CONFIG.site.brand) {
            aboutTitle.textContent = CONFIG.site.brand;
        }
        const aboutAvatar = document.querySelector('.about-avatar-wrapper img');
        if (aboutAvatar && CONFIG.site.favicon) {
            aboutAvatar.src = CONFIG.site.favicon.replace('.ico', '.png');
        }
        // 如果存在 owner 且与 brand 不同，可通过 config 设置 subtitle
        const subtitle = document.querySelector('.subtitle');
        if (subtitle && CONFIG.owner && CONFIG.site.brand) {
            // 保留已有 subtitle，不做覆盖
        }
    }
}

function populateAboutStats() {
    // 博文总数
    const postCount = typeof allIssues !== 'undefined' ? allIssues.length : 0;
    const displayIssues = typeof filterIssues === 'function' && typeof allIssues !== 'undefined'
        ? filterIssues(allIssues) : [];
    const displayCount = displayIssues.length || postCount;
    
    // 标签数量（从过滤后的文章统计）
    let tagCount = 0;
    if (displayIssues.length > 0) {
        const tagSet = new Set();
        displayIssues.forEach(issue => {
            (issue.labels || []).forEach(label => {
                if (label.name !== '反馈') tagSet.add(label.name);
            });
        });
        tagCount = tagSet.size;
    }
    
    // 运行天数
    const startDate = (typeof CONFIG !== 'undefined' && CONFIG.site && CONFIG.site.start_date) || '2026-01-01';
    const startTime = new Date(startDate);
    const now = new Date();
    const days = Math.floor((now - startTime) / (1000 * 60 * 60 * 24));
    
    // 版本号
    const version = document.getElementById('sidebar-version')?.textContent || 'v1.0';
    
    // 填充到各个卡片
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    
    setText('about-post-count', `${displayCount} 篇博文`);
    setText('about-run-time', `${days} 天`);
    setText('about-version', version);
    setText('about-stat-posts', displayCount);
    setText('about-stat-tags', tagCount);
    setText('about-stat-runtime', days);
    setText('about-stat-version', version);
}

async function fetchGitHubCommits() {
    const listContainer = document.getElementById('changelog-list');
    const loadingText = document.getElementById('changelog-loading');
    if (!listContainer) return;

    const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {
        username: CONFIG.username,
        repo: CONFIG.repo,
        branch: CONFIG.branch || 'main'
    };

    try {
        const response = await fetch(`https://api.github.com/repos/${cfg.username}/${cfg.repo}/commits?sha=${cfg.branch}&per_page=30`);
        if (!response.ok) throw new Error("API Limit");

        const commits = await response.json();
        if (loadingText) loadingText.style.display = 'none';

        listContainer.className = "changelog-wrapper";

        // 保留逻辑：只展示最新一条 + 包含多行描述的 commit
        const displayCommits = commits.filter((item, index) => {
            if (index === 0) return true;
            return item.commit.message.includes('\n');
        });

        if (displayCommits.length === 0) {
            if (loadingText) {
                loadingText.style.display = 'block';
                loadingText.textContent = "暂无更新记录";
            }
            return;
        }

        // 转义 HTML 专用函数
        const escapeHtml = (str) => {
            return str.replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;");
        };

        listContainer.innerHTML = displayCommits.map(item => {
            const date = new Date(item.commit.author.date).toLocaleDateString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            const rawMessage = item.commit.message;
            // 分离第一行（版本号/标题）和剩余描述
            const firstNewline = rawMessage.indexOf('\n');
            let title = rawMessage;
            let body = '';
            if (firstNewline !== -1) {
                title = rawMessage.substring(0, firstNewline);
                body = rawMessage.substring(firstNewline + 1);
            }
            // 去除标题首尾空格
            title = title.trim();
            // 保留 body 原有换行，并转义
            const escapedTitle = escapeHtml(title);
            const escapedBody = body ? escapeHtml(body).replace(/\n/g, '<br>') : '';

            const hash = item.sha.substring(0, 7);
            const commitUrl = `https://github.com/${cfg.username}/${cfg.repo}/commit/${item.sha}`;

            return `
                <div class="changelog-item">
                    <div class="changelog-date">
                        <span class="commit-date-text">${date}</span>
                        <a href="${commitUrl}" target="_blank" class="git-version-tag">
                            <svg class="git-icon" viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0z"></path></svg>
                            ${hash}
                        </a>
                    </div>
                    <div class="changelog-version">${escapedTitle}</div>
                    ${escapedBody ? `<div class="changelog-desc">${escapedBody}</div>` : ''}
                </div>
            `;
        }).join('');
    } catch (e) {
        if (loadingText) loadingText.textContent = "暂时无法获取记录";
    }
}

function closeAbout() {
    const overlay = document.getElementById('about-overlay');
    const content = document.getElementById('about-content');
    if (!content) return;

    content.classList.remove('show');
    setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
}

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page === 'about') {
        openAbout(false);
    } else {
        closeAbout();
    }
});