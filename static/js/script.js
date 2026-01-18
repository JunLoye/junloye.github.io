const CONFIG = { 
    username: 'JunLoye',
    repo: 'junloye.github.io',
    branch: 'main',
    musicFolder: 'music',
    clientId: 'Ov23licJrsWm5hKFYAxj',
    proxyUrl: 'https://github-oauth-worker.loyejun.workers.dev',
    defaultCover: 'https://github.githubassets.com/images/modules/open_graph/github-octocat.png'
};

const ICON_PLAY = "M8 5v14l11-7z", ICON_PAUSE = "M6 19h4V5H6v14zm8-14v14h4V5h-4z";

let allIssues = [];
const ORIGINAL_TITLE = document.title;
let templatesLoaded = false;

window.onerror = (msg) => showNotification(`代码错误: ${msg}`, 'error');
window.onunhandledrejection = (event) => showNotification(`异步请求失败: ${event.reason}`, 'error');

function showNotification(msg, type = 'error') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '🌟';
    toast.innerHTML = `<span>${icon} ${msg}</span>`;
    container.appendChild(toast);
    
    const dismiss = () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 400);
    };
    
    setTimeout(dismiss, 5000);
    toast.onclick = dismiss;
}

// 检查 GitHub API 配额限制
async function checkGitHubRateLimit() {
    try {
        const res = await fetch('https://api.github.com/rate_limit');
        if (res.ok) {
            const data = await res.json();
            const searchLimit = data.resources.search;
            const coreLimit = data.resources.core;
            
            if (searchLimit.remaining === 0) {
                const resetDate = new Date(searchLimit.reset * 1000).toLocaleTimeString();
                return `搜索接口配额已用尽。请在 ${resetDate} 后重试。`;
            }
            if (coreLimit.remaining === 0) {
                const resetDate = new Date(coreLimit.reset * 1000).toLocaleTimeString();
                return `API 核心配额已用尽。请在 ${resetDate} 后重试。`;
            }
        }
    } catch (e) {
        return "无法连接到 GitHub 服务。";
    }
    return null;
}

async function handleRouting() {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
        await exchangeCodeForToken(code);
    }

    if (!templatesLoaded) {
        setTimeout(handleRouting, 100);
        return;
    }

    if (hash.startsWith('#post-')) {
        const num = parseInt(hash.replace('#post-', ''));
        if (!isNaN(num)) openPost(num, false);
    } else if (hash === '#about') {
        openAbout(false);
    } else if (hash === '#qa') {
        openQA(false);
    }
}

window.addEventListener('popstate', () => {
    const detailArea = document.getElementById('detail-content-area');
    const aboutContent = document.getElementById('about-content');
    const qaContent = document.getElementById('qa-content');
    if (!window.location.hash) {
        if (detailArea?.classList.contains('show')) realClosePost();
        if (aboutContent?.classList.contains('show')) realCloseAbout();
        if (qaContent?.classList.contains('show')) realCloseQA();
    } else {
        handleRouting();
    }
});

window.onkeydown = (e) => { 
    if (e.key === 'Escape') {
        if (typeof closePost === 'function') closePost();
        if (typeof closeAbout === 'function') closeAbout();
        if (typeof closePublishModal === 'function') closePublishModal();
        if (typeof closeQA === 'function') closeQA();
    }
};

async function fetchPosts() {
    const CACHE_KEY = 'blog_posts_cache';
    const CACHE_TIME = 5 * 60 * 1000; 
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));

    if (cached && (Date.now() - cached.time < CACHE_TIME)) {
        allIssues = cached.data;
        renderPosts(allIssues);
        handleRouting();
        return; 
    }

    const container = document.getElementById('post-list-container');
    try {
        const query = encodeURIComponent(`repo:${CONFIG.username}/${CONFIG.repo} is:issue is:open involves:${CONFIG.username}`);
        const res = await fetch(`https://api.github.com/search/issues?q=${query}&sort=created&order=desc`);
        
        if (!res.ok) {
            const limitMsg = await checkGitHubRateLimit();
            throw new Error(limitMsg || `GitHub 接口请求失败 (状态码: ${res.status})`);
        }
        
        const data = await res.json();
        allIssues = data.items.filter(i => !i.pull_request && !i.title.includes('[FEEDBACK]'));
        
        localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data: allIssues }));
        
        renderPosts(allIssues);
        handleRouting();
    } catch (e) {
        showNotification(e.message, 'error');
        if (container) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 100px 20px;"><h3>内容加载失败</h3><p>${e.message}</p></div>`;
        }
    }
}

/**
 * 核心渲染函数：匹配新 form 格式
 */
function renderPosts(posts, highlightTerm = "") {
    const container = document.getElementById('post-list-container');
    if (!container) return;
    
    if (posts.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-soft);">未找到匹配的文章</div>`;
        return;
    }

    container.innerHTML = posts.map(issue => {
        // 1. 匹配封面：适配 [Cover] 标签
        const coverMatch = issue.body?.match(/\[Cover\]\s*(http\S+)/);
        const cover = coverMatch ? coverMatch[1] : CONFIG.defaultCover;
        
        // 2. 匹配简述：提取 [Summary] 后的内容，直到分隔符或 Content 标签
        const summaryMatch = issue.body?.match(/\[Summary\]\s*([\s\S]*?)(?=\n---|\[Content\]|###|$)/);
        const rawSummaryContent = summaryMatch ? summaryMatch[1] : "";

        // 去除空行并只取前 3 行
        const summaryRaw = rawSummaryContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== "") 
            .slice(0, 3)                
            .join('\n');
        
        let displayTitle = issue.title;
        let displaySummary = (typeof marked !== 'undefined') ? marked.parse(summaryRaw) : summaryRaw;

        // 搜索高亮逻辑
        if (highlightTerm) {
            const regex = new RegExp(`(${highlightTerm})`, 'gi');
            displayTitle = displayTitle.replace(regex, `<mark class="search-highlight">$1</mark>`);
            displaySummary = displaySummary.replace(new RegExp(`(>[^<]*)(${highlightTerm})([^>]*<)`, 'gi'), '$1<mark class="search-highlight">$2</mark>$3');
        }

        const tagsHtml = issue.labels.map(l => 
            `<span class="post-tag" onclick="event.stopPropagation(); filterByTag('${l.name}')">${l.name}</span>`
        ).join('');

        return `<div class="post-card" onclick="openPost(${issue.number})">
            <div class="post-cover">
                <img src="${cover}" alt="cover" onerror="this.onerror=null; this.src='${CONFIG.defaultCover}';">
            </div>
            <h2 class="post-card-title">${displayTitle}</h2>
            <div class="post-card-summary markdown-body" style="font-size: 0.9rem;">${displaySummary}</div>
            <div class="post-card-tags">${tagsHtml}</div>
        </div>`;
    }).join('');

    // 搜索提示
    if (highlightTerm) {
        let countEl = document.getElementById('search-count-hint');
        if (!countEl) {
            countEl = document.createElement('div');
            countEl.id = 'search-count-hint';
            countEl.style = 'grid-column: 1/-1; font-size: 0.85rem; color: var(--text-soft); margin-bottom: -20px;';
            container.prepend(countEl);
        }
        countEl.textContent = `找到 ${posts.length} 篇相关内容：`;
    }
}

function logoutGithub() {
    setCookie('github_token', '', -1);
    updateAuthUI();
}

async function loadTemplate(id, file) {
    try {
        const response = await fetch(file);
        if (!response.ok) throw new Error(`加载模板失败: ${file}`);
        const text = await response.text();
        const el = document.getElementById(id);
        if (el) el.innerHTML = text;
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

async function initAllTemplates() {
    await Promise.all([
        loadTemplate('about-overlay', 'components/about.html'),
        loadTemplate('post-detail-overlay', 'components/post-detail.html'),
        loadTemplate('publish-modal', 'components/publish-form.html'),
        loadTemplate('qa-overlay', 'components/qa.html')
    ]);
    templatesLoaded = true;
    
    // 初始化 publish.js 中的表单绑定逻辑
    if (typeof initPublishForm === 'function') {
        initPublishForm();
    }
    updateAuthUI();
}

function updateSidebarStats(count) {
    const countEl = document.getElementById('sidebar-post-count');
    if (countEl) countEl.textContent = `${count} 篇`;
}

async function fetchUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        const ipEl = document.getElementById('sidebar-ip');
        if (ipEl) ipEl.textContent = data.ip;
    } catch (e) {
        const ipEl = document.getElementById('sidebar-ip');
        if (ipEl) ipEl.textContent = '未知';
    }
}

function updateBlogRunTime() {
    const startTime = new Date('2026-01-01');
    const now = new Date();
    const diff = now - startTime;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    const footerEl = document.getElementById('blog-run-time');
    if (footerEl) footerEl.textContent = `已运行: ${days} 天`;
    
    const sidebarEl = document.getElementById('sidebar-run-time');
    if (sidebarEl) sidebarEl.textContent = `${days} 天`;
}

// 统一更新 UI 的入口
function updateAuthUI() {
    // 基础鉴权 UI 逻辑（由 initAllTemplates 和登录回调调用）
    fetchUserIP();
    updateBlogRunTime();
    if (allIssues.length > 0) {
        updateSidebarStats(allIssues.length);
    }
}

window.addEventListener('load', () => {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    
    fetchPosts(); 
    if (typeof loadMusic === 'function') loadMusic();
    initAllTemplates();
});

setInterval(updateBlogRunTime, 3600000);