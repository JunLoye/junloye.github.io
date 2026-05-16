let CONFIG = {};
let allIssues = [];
let templatesLoaded = false;
let lastSelectedText = "";
let currentTagFilter = null;
const ORIGINAL_TITLE = document.title;
let networkOnline = navigator.onLine; // 跟踪网络状态

window.addEventListener('load', async () => {
    const configLoaded = await loadConfig();
    if (!configLoaded) {
        // 配置加载失败时，如果有离线缓存也尝试显示
        if (typeof offlineStorage !== 'undefined') {
            const offlineList = offlineStorage.getPostList();
            if (offlineList && offlineList.length > 0) {
                allIssues = offlineList;
                const displayIssues = filterIssues(allIssues);
                renderPosts(displayIssues);
                updateSidebarStats(displayIssues.length);
                handleRouting();
                initTagCloud();
            }
        }
        return;
    }

    applyFeatureFlags();
    initAnnouncement();

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    
    fetchPosts();
    initAllTemplates();
    fetchGitHubStars();
    fetchLatestVersion();
    updateBlogRunTime();
    initCookieBanner();
    
    initNodeList();
    setTimeout(checkLatency, 1000);
    
    initContextMenu();

    // 网络状态变化时重新加载
    window.addEventListener('online', () => {
        networkOnline = true;
        if (typeof offlineStorage !== 'undefined') {
            offlineStorage._updateNetworkStatus(true);
        }
        // 自动刷新文章列表
        if (allIssues.length === 0) {
            fetchPosts();
        } else {
            // 后台刷新（静默）
            fetchPostsSilent();
        }
        showNotification('网络已恢复，已重新连接', 'success');
    });

    window.addEventListener('offline', () => {
        networkOnline = false;
        if (typeof offlineStorage !== 'undefined') {
            offlineStorage._updateNetworkStatus(false);
            offlineStorage.showOfflineNotice();
        }
        showNotification('网络已断开，正在使用离线缓存', 'warning');
    });

    window.addEventListener('scroll', handleScroll);
    const postOverlay = document.getElementById('post-overlay');
    if (postOverlay) postOverlay.addEventListener('scroll', handleScroll);
});

/**
 * 静默刷新文章列表（不显示加载错误）
 */
async function fetchPostsSilent() {
    if (!CONFIG.username || !CONFIG.repo) return;
    try {
        const query = encodeURIComponent(`repo:${CONFIG.username}/${CONFIG.repo} is:issue`);
        const res = await fetch(`https://api.github.com/search/issues?q=${query}&sort=created&order=desc&per_page=100`);
        const data = await res.json();
        if (data.items && data.items.length > 0) {
            allIssues = data.items;
            const displayIssues = filterIssues(allIssues);
            localStorage.setItem('blog_posts_cache', JSON.stringify({ time: Date.now(), data: data.items }));
            if (typeof offlineStorage !== 'undefined') {
                offlineStorage.cachePostList(data.items);
            }
            renderPosts(displayIssues);
            updateSidebarStats(displayIssues.length);
            initTagCloud();
        }
    } catch (e) {
        // 静默失败，不通知用户
        console.warn('静默刷新文章列表失败:', e);
    }
}

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

function applyFeatureFlags() {
    if (!CONFIG.features) {
        console.warn('CONFIG.features 未定义，使用默认功能开关');
        return;
    }
    
    const features = CONFIG.features;
    
    if (features.share === false) {
        const shareElements = document.querySelectorAll('.share-btn, .share-buttons');
        shareElements.forEach(el => el.style.display = 'none');
    }
    
    if (features.donation === false) {
        const donationElements = document.querySelectorAll('.donation-section, .donation-method');
        donationElements.forEach(el => el.style.display = 'none');
    }
    
    console.log('功能开关已应用:', features);
}

// 显示缓存加载提示
function showCacheLoadingNotice() {
    const container = document.getElementById('post-list-container');
    if (!container || container.querySelector('.post-card')) return;
    container.innerHTML = `
        <div class="cache-loading-notice">
            <div class="cache-loading-spinner">
                <svg viewBox="0 0 24 24" width="32" height="32">
                    <path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
            </div>
            <div class="cache-loading-text">
                <span class="cache-loading-title">正在加载文章列表</span>
                <span class="cache-loading-subtitle">请稍候...</span>
            </div>
        </div>
    `;
}

// 增强的 fetchPosts 函数
async function fetchPosts() {
    if (!CONFIG.username || !CONFIG.repo) return;

    const CACHE_KEY = 'blog_posts_cache';
    const CACHE_TIME = 5 * 60 * 1000;
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    
    // 离线时立即使用任何可用缓存
    if (!navigator.onLine) {
        if (cached && cached.data && cached.data.length > 0) {
            allIssues = cached.data;
            const displayIssues = filterIssues(allIssues);
            renderPosts(displayIssues);
            updateSidebarStats(displayIssues.length);
            handleRouting();
            initTagCloud();
            if (typeof offlineStorage !== 'undefined') {
                offlineStorage.showOfflineNotice();
            }
            return;
        }
        // 尝试离线存储
        if (typeof offlineStorage !== 'undefined') {
            const offlineList = offlineStorage.getPostList();
            if (offlineList && offlineList.length > 0) {
                allIssues = offlineList;
                const displayIssues = filterIssues(allIssues);
                renderPosts(displayIssues);
                updateSidebarStats(displayIssues.length);
                handleRouting();
                initTagCloud();
                offlineStorage.showOfflineNotice();
                return;
            }
        }
        // 完全离线且无缓存
        const container = document.getElementById('post-list-container');
        if (container) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 80px 20px; color: var(--text-soft);">
                    <svg viewBox="0 0 24 24" width="64" height="64" style="opacity: 0.2; margin-bottom: 20px;">
                        <path fill="currentColor" d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
                    </svg>
                    <h2 style="font-weight: 400; margin-bottom: 10px;">您当前处于离线状态</h2>
                    <p style="font-size: 0.9rem;">请联网后可浏览完整博客内容</p>
                </div>
            `;
        }
        return;
    }

    // 有缓存时立即使用，同时显示提示
    if (cached && cached.data && cached.data.length > 0) {
        allIssues = cached.data;
        const displayIssues = filterIssues(allIssues);
        
        // 如果缓存未过期，直接渲染并返回
        if (Date.now() - cached.time < CACHE_TIME) {
            renderPosts(displayIssues);
            updateSidebarStats(displayIssues.length);
            handleRouting();
            initTagCloud();
            showNotification('📦 已加载缓存版本', 'info');
            return;
        }
        
        // 缓存过期但有网络，先渲染缓存再异步刷新
        renderPosts(displayIssues);
        updateSidebarStats(displayIssues.length);
        handleRouting();
        initTagCloud();
        showNotification('📦 正在刷新文章列表...', 'info');
    } else {
        // 无缓存，显示加载提示
        showCacheLoadingNotice();
    }

    try {
        const query = encodeURIComponent(`repo:${CONFIG.username}/${CONFIG.repo} is:issue`);
        const res = await fetch(`https://api.github.com/search/issues?q=${query}&sort=created&order=desc&per_page=100`);
        const data = await res.json();
        allIssues = data.items || [];

        const displayIssues = filterIssues(allIssues);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data: allIssues }));
        
        if (typeof offlineStorage !== 'undefined') {
            offlineStorage.cachePostList(allIssues);
        }
        
        renderPosts(displayIssues);
        updateSidebarStats(displayIssues.length);
        handleRouting();
        initTagCloud();
    } catch (e) {
        showNotification("文章列表同步失败，已加载缓存版本", 'warning');
        
        // 回退到任何可用缓存
        let fallbackData = null;
        
        if (typeof offlineStorage !== 'undefined') {
            const offlineList = offlineStorage.getPostList();
            if (offlineList && offlineList.length > 0) {
                fallbackData = offlineList;
            }
        }
        
        if (!fallbackData && cached && cached.data) {
            fallbackData = cached.data;
        }
        
        if (fallbackData) {
            allIssues = fallbackData;
            const displayIssues = filterIssues(allIssues);
            renderPosts(displayIssues);
            updateSidebarStats(displayIssues.length);
            handleRouting();
            initTagCloud();
        }
        
        // 显示离线提示
        if (typeof offlineStorage !== 'undefined' && !navigator.onLine) {
            offlineStorage.showOfflineNotice();
        }
    }
}

// 修改后的 filterIssues 函数：增加了 state === 'open' 条件
function filterIssues(issues) {
    return issues.filter(issue => {
        const isAuthor = issue.user && issue.user.login === CONFIG.username;
        const hasFeedbackTag = issue.labels.some(l => l.name === '反馈');
        const isOpen = issue.state === 'open';   // 新增：只显示打开的 Issue
        return isAuthor && !hasFeedbackTag && isOpen;
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
    
    // 限制最多同时显示3条通知
    const existingToasts = container.querySelectorAll('.toast-message');
    if (existingToasts.length >= 3) {
        existingToasts[0].classList.add('hide');
        setTimeout(() => existingToasts[0].remove(), 400);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    
    const iconMap = {
        'error': '❌',
        'warning': '⚠️',
        'success': '✅',
        'info': 'ℹ️'
    };
    const icon = iconMap[type] || 'ℹ️';
    
    toast.innerHTML = `<span>${icon} ${msg}</span>`;
    container.appendChild(toast);
    
    const dismiss = () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 400);
    };
    
    // 不同消息类型不同显示时长
    const durations = { 'error': 6000, 'warning': 5000, 'success': 3500, 'info': 3000 };
    setTimeout(dismiss, durations[type] || 5000);
    
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

async function fetchGitHubStars() {
    const starsEl = document.getElementById('sidebar-stars');
    if (!starsEl || !CONFIG.username || !CONFIG.repo) return;
    // 优先使用缓存
    const cached = localStorage.getItem('github_stars_cache');
    if (cached) {
        const { count, time } = JSON.parse(cached);
        if (Date.now() - time < 3600000) { // 1小时缓存
            starsEl.textContent = `${count} ★`;
            return;
        }
    }
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}`);
        if (res.ok) {
            const data = await res.json();
            const count = data.stargazers_count || 0;
            starsEl.textContent = `${count} ★`;
            localStorage.setItem('github_stars_cache', JSON.stringify({ count, time: Date.now() }));
        } else {
            starsEl.textContent = '- ★';
        }
    } catch (e) {
        starsEl.textContent = '- ★';
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

    // 仅支持 ?post=NUM 格式
    const urlParams = new URLSearchParams(window.location.search);
    let postId = urlParams.get('post');

    // 兼容 ?=post=NUM 旧格式变体
    if (!postId) {
        const legacyMatch = window.location.search.match(/[?&]=?post=(\d+)/);
        if (legacyMatch) {
            postId = legacyMatch[1];
        }
    }

    if (postId) {
        const num = parseInt(postId);
        if (!isNaN(num)) {
            if (typeof openPost === 'function') {
                openPost(num, false);
            }
        }
    }
}

window.onkeydown = (e) => {
    if (e.key === 'Escape') {
        // 搜索覆盖层优先关闭
        const searchOverlay = document.getElementById('search-overlay');
        if (searchOverlay && searchOverlay.classList.contains('active')) {
            if (typeof closeSearchOverlay === 'function') {
                closeSearchOverlay();
                return;
            }
        }
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

    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target)) menu.style.display = 'none';
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') menu.style.display = 'none';
    });
}

async function copySelectedText() {
    if (!lastSelectedText) return;
    try {
        await navigator.clipboard.writeText(lastSelectedText);
        showNotification('已复制选中内容', 'success');
    } catch (err) {
        showNotification('复制失败', 'error');
    }
}

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
        setTimeout(() => banner.classList.add('show'), 1000);
    }
}

function setCookiePreference(status) {
    localStorage.setItem('cookie-consent', status);
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.classList.remove('show');
}

async function updateAuthUI() {
    const token = localStorage.getItem('gh_access_token');
    const userLogin = localStorage.getItem('gh_user_login');
    const loginBtn = document.getElementById('github-login-btn');
    const loginText = document.getElementById('login-text');
    
    if (!loginBtn || !loginText) return;
    
    if (token && userLogin) {
        loginText.textContent = userLogin;
        loginBtn.title = `已登录为 ${userLogin}，点击注销`;
        loginBtn.classList.add('logged-in');
    } else {
        loginText.textContent = 'GitHub 登录';
        loginBtn.title = '使用 GitHub 登录';
        loginBtn.classList.remove('logged-in');
    }
}

function toggleGitHubLogin() {
    const token = localStorage.getItem('gh_access_token');
    const userLogin = localStorage.getItem('gh_user_login');
    
    if (token && userLogin) {
        if (confirm(`确定要注销 ${userLogin} 吗？`)) {
            localStorage.removeItem('gh_access_token');
            localStorage.removeItem('gh_user_login');
            localStorage.removeItem('gh_user_avatar');
            updateAuthUI();
            showNotification('已注销 GitHub 登录', 'info');
        }
    } else {
        if (typeof loginGitHub === 'function') {
            loginGitHub();
        } else {
            const clientId = CONFIG.client_id || 'Ov23liNHVCD2Mdupm4U4';
            const currentUrl = window.location.href.split('&code=')[0].split('?code=')[0];
            window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=public_repo&redirect_uri=${encodeURIComponent(currentUrl)}`;
        }
    }
}

window.addEventListener('load', () => {
    setTimeout(updateAuthUI, 500);
});

window.onerror = (msg) => showNotification(`代码错误: ${msg}`, 'error');
window.onunhandledrejection = (event) => showNotification(`异步请求失败: ${event.reason}`, 'error');


function generateTagCloud(issues) {
    const tagCloudContainer = document.getElementById('tag-cloud');
    if (!tagCloudContainer) return;
    
    // 使用过滤后的 issues 生成标签云（排除非作者、反馈标签、已关闭的 issue）
    const filteredIssues = typeof filterIssues === 'function' ? filterIssues(issues) : issues;
    
    const tagCount = {};
    filteredIssues.forEach(issue => {
        issue.labels.forEach(label => {
            if (label.name !== '反馈') {
                tagCount[label.name] = (tagCount[label.name] || 0) + 1;
            }
        });
    });
    
    const sortedTags = Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25);
    
    if (sortedTags.length === 0) {
        tagCloudContainer.innerHTML = '<div class="tag-cloud-empty">✨ 暂无标签，发布文章时添加标签吧</div>';
        return;
    }
    
    // 计算字体大小范围（基于文章数量）
    const maxCount = sortedTags[0][1];
    const minCount = sortedTags[sortedTags.length - 1][1];
    const minFontSize = 0.8;
    const maxFontSize = 1.6;
    
    // 生成标签HTML
    const tagsHtml = sortedTags.map(([tag, count]) => {
        // 根据文章数量计算字体大小
        let fontSize = minFontSize;
        if (maxCount !== minCount) {
            fontSize = minFontSize + (maxFontSize - minFontSize) * (count - minCount) / (maxCount - minCount);
        }
        
        // 是否为当前激活的标签
        const isActive = currentTagFilter === tag;
        const activeClass = isActive ? 'active' : '';
        
        // 使用标签名称生成稳定的颜色（柔和色调）
        const hue = (tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360);
        const color = `hsl(${hue}, 65%, 55%)`;
        
        return `
            <span class="tag-cloud-item ${activeClass}"
                  style="font-size: ${fontSize}rem;"
                  data-tag="${escapeXML(tag)}"
                  onclick="filterByTag('${escapeXML(tag).replace(/'/g, "\\'")}')"
                  title="点击筛选「${tag}」标签的文章">
                ${escapeXML(tag)}
                <span class="tag-count">(${count})</span>
            </span>
        `;
    }).join('');
    
    // 添加重置按钮和筛选指示器
    const filterIndicator = currentTagFilter ? `
        <div class="filter-indicator">
            <span>📌 当前筛选：</span>
            <span class="tag-name">${escapeXML(currentTagFilter)}</span>
            <span class="clear-filter" onclick="clearTagFilter()" title="清除筛选">✕</span>
        </div>
    ` : '';
    
    tagCloudContainer.innerHTML = `
        <div class="tag-cloud-reset" onclick="clearTagFilter()" title="显示全部文章">
            全部文章
        </div>
        ${filterIndicator}
        <div class="tag-cloud-items">
            ${tagsHtml}
        </div>
    `;
}

function filterByTag(tagName) {
    if (!allIssues || allIssues.length === 0) return;
    
    if (currentTagFilter === tagName) {
        clearTagFilter();
        return;
    }
    currentTagFilter = tagName;
    
    // 仅在已过滤的文章（排除反馈、非作者、已关闭）中按标签筛选
    const displayIssues = typeof filterIssues === 'function' ? filterIssues(allIssues) : allIssues;
    const filteredIssues = displayIssues.filter(issue => {
        return issue.labels.some(label => label.name === tagName);
    });
    
    renderPosts(filteredIssues, tagName);
    
    generateTagCloud(allIssues);
    
    const container = document.getElementById('post-list-container');
    if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    updateSidebarStats(filteredIssues.length);
}

function clearTagFilter() {
    if (!currentTagFilter) return;
    
    currentTagFilter = null;
    
    const displayIssues = filterIssues(allIssues);
    renderPosts(displayIssues);
    
    generateTagCloud(allIssues);
    
    updateSidebarStats(displayIssues.length);
    
    const container = document.getElementById('post-list-container');
    if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function initTagCloud() {
    if (allIssues && allIssues.length > 0) {
        generateTagCloud(allIssues);
    }
}

function escapeXML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const originalLoadAndRender = window.loadAndRender;
if (typeof originalLoadAndRender === 'function') {
    window.loadAndRender = async function(...args) {
        const result = await originalLoadAndRender.apply(this, args);
        initTagCloud();
        return result;
    };
}


function initAnnouncement() {
    const banner = document.getElementById('announcement-banner');
    if (!banner) return;
    
    const announcementClosed = localStorage.getItem('announcement_closed');
    if (announcementClosed === 'true') {
        banner.style.display = 'none';
        return;
    }
    
    if (CONFIG.features && CONFIG.features.announcement === false) {
        banner.style.display = 'none';
        return;
    }
    
    if (typeof CONFIG === 'undefined' || !CONFIG.announcement || !CONFIG.announcement.enabled) {
        banner.style.display = 'none';
        return;
    }
    
    const announcement = CONFIG.announcement;
    
    if (announcement.expires) {
        const expireDate = new Date(announcement.expires);
        const now = new Date();
        if (now > expireDate) {
            banner.style.display = 'none';
            return;
        }
    }
    
    const titleEl = document.getElementById('announcement-title');
    const contentEl = document.getElementById('announcement-content');
    const iconEl = document.getElementById('announcement-icon');
    
    if (titleEl && announcement.title) {
        titleEl.textContent = announcement.title + ': ';
    }
    
    if (contentEl && announcement.content) {
        contentEl.textContent = announcement.content;
    }
    
    if (iconEl) {
        const type = announcement.type || 'info';
        const icons = {
            'info': '📢',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'maintenance': '🔧',
            'new': '🆕'
        };
        iconEl.textContent = icons[type] || '📢';
        
        const colors = {
            'info': '#2196f3',
            'success': '#4caf50',
            'warning': '#ff9800',
            'error': '#f44336',
            'maintenance': '#9c27b0',
            'new': '#ff4081'
        };
        banner.style.backgroundColor = colors[type] || '#2196f3';
    }
    
    banner.style.display = 'block';
    
    const closeBtn = document.getElementById('announcement-close');
    if (closeBtn && announcement.show_close !== false) {
        closeBtn.onclick = () => {
            banner.style.display = 'none';
            localStorage.setItem('announcement_closed', 'true');
        };
    } else if (closeBtn) {
        closeBtn.style.display = 'none';
    }
}