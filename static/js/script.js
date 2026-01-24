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
    const dismiss = () => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 400); };
    setTimeout(dismiss, 5000);
    toast.onclick = dismiss;
}

async function handleRouting() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const postId = urlParams.get('post');
    const hash = window.location.hash;
    if (code) { window.history.replaceState({}, document.title, window.location.pathname); await exchangeCodeForToken(code); }
    if (!templatesLoaded) { setTimeout(handleRouting, 100); return; }
    if (postId) { const num = parseInt(postId); if (!isNaN(num)) openPost(num, false); }
    else if (hash === '#about') { openAbout(false); }
}

window.addEventListener('popstate', () => {
    const detailArea = document.getElementById('content-area');
    const aboutContent = document.getElementById('about-content');
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('post') && detailArea?.classList.contains('show')) realClosePost();
    if (!window.location.hash && aboutContent?.classList.contains('show')) realCloseAbout();
    handleRouting();
});

window.onkeydown = (e) => { 
    if (e.key === 'Escape') {
        if (typeof closePost === 'function') closePost();
        if (typeof closeAbout === 'function') closeAbout();
        if (typeof closePublishModal === 'function') closePublishModal();
    }
};

async function fetchPosts() {
    const CACHE_KEY = 'blog_posts_cache';
    const CACHE_TIME = 5 * 60 * 1000; 
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && (Date.now() - cached.time < CACHE_TIME)) {
        allIssues = cached.data;
        renderPosts(allIssues);
        updateSidebarStats(allIssues.length);
        handleRouting();
        return; 
    }
    try {
        // 策略：优先读取由 Actions 维护的静态清单文件，避免触发 GitHub API 限制
        const manifestRes = await fetch('./manifest.json?t=' + Date.now());
        if (manifestRes.ok) {
            const manifestData = await manifestRes.json();
            allIssues = manifestData.items || [];
        } else {
            // 降级：仅当清单文件不存在时调用 API
            const query = encodeURIComponent(`repo:${CONFIG.username}/${CONFIG.repo} is:issue is:open involves:${CONFIG.username}`);
            const res = await fetch(`https://api.github.com/search/issues?q=${query}&sort=created&order=desc`);
            if (!res.ok) throw new Error("GitHub API 请求受限");
            const data = await res.json();
            allIssues = data.items.filter(issue => !issue.pull_request && !issue.title.toUpperCase().includes('[FEEDBACK]'));
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data: allIssues }));
        renderPosts(allIssues);
        updateSidebarStats(allIssues.length);
        handleRouting();
    } catch (e) {
        showNotification(e.message, 'error');
    }
}

function renderPosts(posts, highlightTerm = "") {
    const container = document.getElementById('post-list-container');
    if (!container) return;
    container.innerHTML = posts.map(issue => {
        const coverMatch = issue.body?.match(/\[Cover\]\s*(http\S+)/);
        const cover = coverMatch ? coverMatch[1] : CONFIG.defaultCover;
        const summaryMatch = issue.body?.match(/\[Summary\]\s*([\s\S]*?)(?=\n---|\[Content\]|###|$)/);
        const summaryRaw = summaryMatch ? summaryMatch[1].split('\n').filter(Boolean).slice(0, 3).join('\n') : "";
        let displayTitle = issue.title;
        let displaySummary = (typeof marked !== 'undefined') ? marked.parse(summaryRaw) : summaryRaw;
        if (highlightTerm) {
            const regex = new RegExp(`(${highlightTerm})`, 'gi');
            displayTitle = displayTitle.replace(regex, `<mark class="search-highlight">$1</mark>`);
        }
        const tagsHtml = issue.labels.map(l => `<span class="post-tag">${l.name}</span>`).join('');
        return `<div class="post-card" onclick="openPost(${issue.number})">
            <div class="post-cover"><img src="${cover}" onerror="this.src='${CONFIG.defaultCover}'"></div>
            <h2 class="post-card-title">${displayTitle}</h2>
            <div class="post-card-summary markdown-body">${displaySummary}</div>
            <div class="post-card-tags">${tagsHtml}</div>
        </div>`;
    }).join('');
}

async function loadTemplate(id, file) {
    try {
        const response = await fetch(file);
        const text = await response.text();
        const el = document.getElementById(id);
        if (el) el.innerHTML = text;
        return true;
    } catch (e) { return false; }
}

async function initAllTemplates() {
    await Promise.all([
        loadTemplate('about-overlay', 'components/about.html'),
        loadTemplate('post-overlay', 'components/post.html'),
        loadTemplate('publish-modal', 'components/publish.html')
    ]);
    templatesLoaded = true;
    if (typeof initPublishForm === 'function') initPublishForm();
    if (typeof updateAuthUI === 'function') await updateAuthUI();
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
        if (document.getElementById('sidebar-ip')) document.getElementById('sidebar-ip').textContent = '未知';
    }
}

function updateBlogRunTime() {
    const startTime = new Date('2026-01-01');
    const now = new Date();
    const days = Math.floor((now - startTime) / (1000 * 60 * 60 * 24));
    const footerEl = document.getElementById('blog-run-time');
    if (footerEl) footerEl.textContent = `已运行: ${days} 天`;
    const sidebarEl = document.getElementById('sidebar-run-time');
    if (sidebarEl) sidebarEl.textContent = `${days} 天`;
}

window.addEventListener('load', () => {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    fetchPosts(); 
    initAllTemplates();
    fetchUserIP();
    updateBlogRunTime();
});