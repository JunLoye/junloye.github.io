const CONFIG = { 
    username: 'JunLoye',
    repo: 'junloye.github.io',
    branch: 'main',
    musicFolder: 'music',
    clientId: 'Ov23licJrsWm5hKFYAxj',
    proxyUrl: 'https://github-oauth-worker.loyejun.workers.dev',
    defaultCover: 'https://github.githubassets.com/images/modules/open_graph/github-octocat.png',
    nodes: [
        { name: '主站 (GitHub)', url: 'https://junloye.github.io' },
        { name: '备用1 (Vercel)', url: 'https://junloye.vercel.app' },
        { name: '备站2 (Cloudflare)', url: 'https://blog.loyejun.workers.dev' },
        { name: 'API 服务', url: 'https://api.github.com' }
    ]
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

window.addEventListener('popstate', () => {
    const detailArea = document.getElementById('content-area');
    const aboutContent = document.getElementById('about-content');
    const urlParams = new URLSearchParams(window.location.search);
    
    if (!urlParams.has('post') && detailArea?.classList.contains('show')) {
        realClosePost();
    }
    
    if (!window.location.hash && aboutContent?.classList.contains('show')) {
        realCloseAbout();
    }
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
        const manifestRes = await fetch('/manifest.json?t=' + Date.now());
        if (manifestRes.ok) {
            const data = await manifestRes.json();
            allIssues = data.items || [];
        } else {
            const query = encodeURIComponent(`repo:${CONFIG.username}/${CONFIG.repo} is:issue is:open`);
            const res = await fetch(`https://api.github.com/search/issues?q=${query}&sort=created&order=desc`);
            const data = await res.json();
            allIssues = data.items || [];
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data: allIssues }));
        renderPosts(allIssues);
        updateSidebarStats(allIssues.length);
        handleRouting();
    } catch (e) {
        showNotification("文章列表同步失败", 'error');
    }
}

async function handleRouting() {
    if (!templatesLoaded) { 
        setTimeout(handleRouting, 100); 
        return; 
    }

    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    const pathMatch = window.location.pathname.match(/\/post\/(\d+)/);
    
    if (postId) {
        openPost(parseInt(postId), false);
    } else if (pathMatch) {
        openPost(parseInt(pathMatch[1]), false);
    } else {
        const detailArea = document.getElementById('content-area');
        if (detailArea?.classList.contains('show')) {
            realClosePost();
        }
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

async function fetchLatestVersion() {
    const versionEl = document.getElementById('sidebar-version');
    if (!versionEl) return;

    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/commits?per_page=10`);
        if (!res.ok) throw new Error('Network error');
        
        const commits = await res.json();
        const versionRegex = /v?\d+\.\d+/i;
        
        let latestVersion = 'Error';

        for (const commit of commits) {
            const match = commit.commit.message.match(versionRegex);
            if (match) {
                latestVersion = match[0].toLowerCase().startsWith('v') ? match[0] : `v${match[0]}`;
                break;
            }
        }
        versionEl.textContent = latestVersion;
    } catch (e) {
        console.error("Failed to fetch version:", e);
        versionEl.textContent = 'Error';
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

function initCookieBanner() {
    const cookieConsent = localStorage.getItem('cookie-consent');
    const banner = document.getElementById('cookie-banner');
    if (!cookieConsent && banner) {
        setTimeout(() => {
            banner.classList.add('show');
        }, 2000);
    }
}

function setCookiePreference(status) {
    const banner = document.getElementById('cookie-banner');
    localStorage.setItem('cookie-consent', status);
    
    if (banner) {
        banner.classList.remove('show');
    }

    if (status === 'accepted') {
        showNotification('已接受 Cookie 政策', 'success');
    } else {
        showNotification('已拒绝非必要 Cookie', 'warning');
    }
}

function initNodeList() {
    const container = document.getElementById('node-list');
    if (!container) return;
    
    const currentHost = window.location.hostname;

    let html = CONFIG.nodes.map((node, index) => {
        const isApi = node.name.includes('API');
        let isCurrent = false;
        try {
            const nodeUrl = new URL(node.url);
            isCurrent = currentHost === nodeUrl.hostname;
        } catch(e) {
            isCurrent = false;
        }
        
        const clickAttr = (isApi || isCurrent) ? '' : `onclick="window.location.href='${node.url}'"`;
        const extraClass = isApi ? 'node-disabled' : (isCurrent ? 'node-active' : 'node-clickable');

        return `
            <div class="info-item node-item ${extraClass}" ${clickAttr}>
                <span class="info-label">${node.name} ${isCurrent ? '' : ''}</span>
                <span class="info-value node-latency" id="node-${index}">- ms</span>
            </div>
        `;
    }).join('');
    
    html += `
        <div class="info-item node-item node-clickable" style="margin-top: 5px; border-top: 1px dashed var(--line); padding-top: 10px;" onclick="checkLatency()">
            <span class="info-label" style="color: var(--accent)">重新检测</span>
        </div>
    `;
    container.innerHTML = html;
}

async function checkLatency() {
    CONFIG.nodes.forEach(async (node, index) => {
        const el = document.getElementById(`node-${index}`);
        if (el) el.textContent = 'Testing';
        
        const start = Date.now();
        try {
            await fetch(node.url, { mode: 'no-cors', cache: 'no-cache' });
            const latency = Date.now() - start;
            updateLatencyUI(el, latency);
        } catch (e) {
            if (el) {
                el.textContent = 'Timeout';
                el.className = 'info-value node-latency latency-high';
            }
        }
    });
}

function updateLatencyUI(el, ms) {
    if (!el) return;
    el.textContent = `${ms} ms`;
    el.className = 'info-value node-latency';
    if (ms < 200) el.classList.add('latency-low');
    else if (ms < 500) el.classList.add('latency-mid');
    else el.classList.add('latency-high');
}

window.addEventListener('load', () => {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    
    fetchPosts(); 
    initAllTemplates();
    fetchUserIP();
    fetchLatestVersion();
    updateBlogRunTime();
    initCookieBanner();
    
    initNodeList();
    setTimeout(checkLatency, 1000);
});