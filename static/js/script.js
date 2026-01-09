const CONFIG = { 
    username: 'JunLoye',
    repo: 'junloye.github.io',
    branch: 'main',
    musicFolder: 'music',
    clientId: 'Ov23licJrsWm5hKFYAxj',
    proxyUrl: 'https://github-oauth-worker.loyejun.workers.dev'
};

const ICON_PLAY = "M8 5v14l11-7z", ICON_PAUSE = "M6 19h4V5H6v14zm8-14v14h4V5h-4z";


let allIssues = [];
const ORIGINAL_TITLE = document.title;
let templatesLoaded = false; // 标记外部组件是否加载完成

// --- 1. 全局错误与通知系统 ---
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

// --- 2. 路由与 OAuth 回调处理 ---
async function handleRouting() {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
        await exchangeCodeForToken(code);
    }

    // 如果模板还没加载好，延迟处理路由
    if (!templatesLoaded) {
        setTimeout(handleRouting, 100);
        return;
    }

    if (hash.startsWith('#post-')) {
        const num = parseInt(hash.replace('#post-', ''));
        if (!isNaN(num)) openPost(num, false);
    } else if (hash === '#about') {
        openAbout(false);
    }
}

window.addEventListener('popstate', () => {
    const detailArea = document.getElementById('detail-content-area');
    const aboutContent = document.getElementById('about-content');
    if (!window.location.hash) {
        if (detailArea?.classList.contains('show')) realClosePost();
        if (aboutContent?.classList.contains('show')) realCloseAbout();
    } else {
        handleRouting();
    }
});

window.onkeydown = (e) => { 
    if (e.key === 'Escape') {
        closePost();
        closeAbout();
        closePublishModal();
    }
};

// --- 5. 文章列表与详情 ---
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
        
        if (!res.ok) throw new Error(`无法获取文章 (状态码: ${res.status})`);
        
        const data = await res.json();
        allIssues = data.items.filter(i => !i.pull_request);
        
        localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data: allIssues }));
        
        renderPosts(allIssues);
        handleRouting();
    } catch (e) {
        showNotification(e.message, 'error');
        if (container) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 100px 20px;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">🚧</div>
                    <h3 style="color: var(--text);">内容加载失败</h3>
                    <p style="color: var(--text-soft);">${e.message}</p>
                    <button onclick="location.reload()" style="margin-top: 20px; padding: 8px 20px; border-radius: 20px; border: 1px solid var(--line); background: var(--bg); color: var(--text); cursor: pointer;">刷新页面</button>
                </div>`;
        }
    }
}

// --- 8. 运行时间与设置 ---
function updateRunTime() {
    const startTime = new Date('2026-01-01T00:00:00');
    const now = new Date();
    let years = now.getFullYear() - startTime.getFullYear();
    let months = now.getMonth() - startTime.getMonth();
    let days = now.getDate() - startTime.getDate();
    if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (months < 0) { years--; months += 12; }
    let timeStr = "本站已运行 ";
    if (years > 0) timeStr += `${years} 年 `;
    if (months > 0 || years > 0) timeStr += `${months} 个月 `;
    timeStr += `${days} 天`;
    const element = document.getElementById('blog-run-time');
    if (element) element.textContent = timeStr;
}

// --- 9. OAuth 登录核心逻辑 ---
function logoutGithub() {
    setCookie('github_token', '', -1);
    updateAuthUI();
}

// --- 10. 模板加载逻辑 ---
async function loadTemplate(id, file) {
    try {
        const response = await fetch(file);
        if (!response.ok) throw new Error(`加载模板失败: ${file}`);
        const text = await response.text();
        document.getElementById(id).innerHTML = text;
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

async function initAllTemplates() {
    const t1 = loadTemplate('about-overlay', 'components/about.html');
    const t2 = loadTemplate('post-detail-overlay', 'components/post-detail.html');
    const t3 = loadTemplate('publish-modal', 'components/publish-form.html');
    
    await Promise.all([t1, t2, t3]);
    templatesLoaded = true;
    
    if (typeof initPublishForm === 'function') {
        initPublishForm();
    }
    updateAuthUI();
}

// --- 11. 初始化 ---
window.onload = () => {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    
    updateRunTime(); 
    fetchPosts(); 
    if (typeof loadMusic === 'function') loadMusic();
    
    // 开始加载异步组件
    initAllTemplates();
};