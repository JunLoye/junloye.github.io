let CONFIG = {}; 
let allIssues = [];
let templatesLoaded = false;
let lastSelectedText = "";
const ORIGINAL_TITLE = document.title;

window.addEventListener('load', async () => {
    const configLoaded = await loadConfig();
    if (!configLoaded) return;

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
    
    initContextMenu();

    window.addEventListener('scroll', handleScroll);
    const postOverlay = document.getElementById('post-overlay');
    if (postOverlay) postOverlay.addEventListener('scroll', handleScroll);
});

async function loadConfig() {
    try {
        const response = await fetch('/data/config.json');
        if (!response.ok) throw new Error('网络响应异常');
        CONFIG = await response.json();
        console.log('配置加载成功:', CONFIG);
        return true;
    } catch (error) {
        console.error('无法获取配置文件:', error);
        showNotification('配置文件 (config.json) 加载失败', 'error');
        return false;
    }
}

async function fetchPosts() {
    if (!CONFIG.username || !CONFIG.repo) return;

    const CACHE_KEY = 'blog_posts_cache';
    const CACHE_TIME = 5 * 60 * 1000; 
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    
    if (cached && (Date.now() - cached.time < CACHE_TIME)) {
        allIssues = cached.data;
        const displayIssues = filterIssues(allIssues);
        renderPosts(displayIssues);
        updateSidebarStats(displayIssues.length);
        handleRouting();
        return; 
    }

    try {
        const query = encodeURIComponent(`repo:${CONFIG.username}/${CONFIG.repo} is:issue is:open`);
        const res = await fetch(`https://api.github.com/search/issues?q=${query}&sort=created&order=desc`);
        const data = await res.json();
        allIssues = data.items || [];

        const displayIssues = filterIssues(allIssues);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data: allIssues }));
        
        renderPosts(displayIssues);
        updateSidebarStats(displayIssues.length);
        handleRouting();
    } catch (e) {
        showNotification("文章列表同步失败", 'error');
    }
}

function filterIssues(issues) {
    return issues.filter(issue => {
        const isAuthor = issue.user && issue.user.login === CONFIG.username;
        const hasFeedbackTag = issue.labels.some(l => l.name === '反馈');
        return isAuthor && !hasFeedbackTag;
    });
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
        
        const filteredLabels = issue.labels.filter(l => l.name !== '反馈');
        const tagsHtml = filteredLabels.map(l => `<span class="post-tag">${l.name}</span>`).join('');
        
        return `
            <div class="post-card" onclick="openPost(${issue.number})">
                <div class="post-cover"><img src="${cover}" onerror="this.src='${CONFIG.defaultCover}'"></div>
                <h2 class="post-card-title">${displayTitle}</h2>
                <div class="post-card-summary markdown-body">${displaySummary}</div>
                <div class="post-card-tags" style="display: flex; flex-wrap: wrap; gap: 5px;">${tagsHtml}</div>
            </div>`;
    }).join('');
}

function initNodeList() {
    const container = document.getElementById('node-list');
    if (!container || !CONFIG.nodes) return;

    const currentHost = window.location.hostname;
    const nodeIconSvg = `<svg class="node-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`;

    let html = CONFIG.nodes.map((node, index) => {
        let nodeHostname = "";
        try { nodeHostname = new URL(node.url).hostname; } catch(e) {}
        
        const isApi = node.name.includes('API');
        const isCurrent = currentHost === nodeHostname;
        const clickAttr = (isApi || isCurrent) ? '' : `onclick="window.location.href='${node.url}'"`;
        const extraClass = isApi ? 'node-disabled' : (isCurrent ? 'node-active' : 'node-clickable');

        return `
            <div class="info-item node-item ${extraClass}" ${clickAttr}>
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${nodeIconSvg}
                    <span class="info-label">${node.name}</span>
                </div>
                <span class="info-value node-latency" id="node-${index}">- ms</span>
            </div>`;
    }).join('');
    
    html += `
        <div class="info-item node-item node-clickable" style="margin-top: 5px; border-top: 1px dashed var(--line); padding-top: 10px;" onclick="checkLatency()">
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg class="node-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                <span class="info-label" style="color: var(--accent)">重新检测</span>
            </div>
        </div>`;
    container.innerHTML = html;
}

async function checkLatency() {
    if (!CONFIG.nodes) return;
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
    if (!versionEl || !CONFIG.username) return;
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/commits?per_page=10`);
        const commits = await res.json();
        const versionRegex = /v?\d+\.\d+/i;
        let latestVersion = 'v1.0';
        for (const commit of commits) {
            const match = commit.commit.message.match(versionRegex);
            if (match) {
                latestVersion = match[0].toLowerCase().startsWith('v') ? match[0] : `v${match[0]}`;
                break;
            }
        }
        versionEl.textContent = latestVersion;
    } catch (e) { versionEl.textContent = 'Error'; }
}

function updateBlogRunTime() {
    const startTime = new Date('2026-01-01');
    const now = new Date();
    const days = Math.floor((now - startTime) / (1000 * 60 * 60 * 24));
    const sidebarEl = document.getElementById('sidebar-run-time');
    if (sidebarEl) sidebarEl.textContent = `${days} 天`;
}

async function handleRouting() {
    if (!templatesLoaded) { 
        setTimeout(handleRouting, 100); 
        return; 
    }
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    if (postId) {
        if (typeof openPost === 'function') openPost(parseInt(postId), false);
    }
}

window.onkeydown = (e) => { 
    if (e.key === 'Escape') {
        if (typeof closePost === 'function') closePost();
        if (typeof closeAbout === 'function') closeAbout();
        if (typeof closePublishModal === 'function') closePublishModal();
        if (typeof closeFriends === 'function') closeFriends();
        const menu = document.getElementById('custom-context-menu');
        if (menu) menu.style.display = 'none';
    }
};

function initContextMenu() {
    const menu = document.getElementById('custom-context-menu');
    const textGroup = document.getElementById('menu-text-group');
    if (!menu) return;

    document.addEventListener('contextmenu', (e) => {
        // 如果是在输入框内点击，使用原生菜单
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        e.preventDefault();
        lastSelectedText = window.getSelection().toString().trim();
        textGroup.style.display = lastSelectedText.length > 0 ? 'block' : 'none';

        let x = e.clientX, y = e.clientY;
        menu.style.display = 'block';
        if (x + menu.offsetWidth > window.innerWidth) x -= menu.offsetWidth;
        if (y + menu.offsetHeight > window.innerHeight) y -= menu.offsetHeight;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
    });

    document.addEventListener('click', () => menu.style.display = 'none');
}

/** 复制选中内容 **/
async function copySelectedText() {
    if (!lastSelectedText) return;
    try {
        await navigator.clipboard.writeText(lastSelectedText);
        showNotification('已复制选中内容', 'success');
    } catch (err) {
        showNotification('复制失败', 'error');
    }
}

/** 谷歌搜索选中内容 **/
function searchSelectedText() {
    if (!lastSelectedText) return;
    const url = `https://www.google.com/search?q=${encodeURIComponent(lastSelectedText)}`;
    window.open(url, '_blank');
}

function handleScroll() {
    const btn = document.getElementById('back-to-top');
    const postOverlay = document.getElementById('post-overlay');
    const scrollTop = (postOverlay && postOverlay.style.display === 'block') 
        ? postOverlay.scrollTop 
        : (window.pageYOffset || document.documentElement.scrollTop);

    if (btn) {
        scrollTop > 300 ? btn.classList.add('show') : btn.classList.remove('show');
    }
}

function scrollToTop() {
    const postOverlay = document.getElementById('post-overlay');
    const target = (postOverlay && postOverlay.style.display === 'block') ? postOverlay : window;
    target.scrollTo({ top: 0, behavior: 'smooth' });
}

function initCookieBanner() {
    const consent = localStorage.getItem('cookie-consent');
    const banner = document.getElementById('cookie-banner');
    if (!consent && banner) {
        setTimeout(() => banner.classList.add('show'), 2000);
    }
}

function setCookiePreference(status) {
    localStorage.setItem('cookie-consent', status);
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.classList.remove('show');
    showNotification(status === 'accepted' ? '已接受 Cookie' : '已拒绝非必要 Cookie', status === 'accepted' ? 'success' : 'warning');
}

window.onerror = (msg) => showNotification(`代码错误: ${msg}`, 'error');
window.onunhandledrejection = (event) => showNotification(`异步请求失败: ${event.reason}`, 'error');