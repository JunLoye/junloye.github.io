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
    applySiteConfig();

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
    initCopyProtection();


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
        showNotification('网络已恢复', 'success');
    });

    window.addEventListener('offline', () => {
        networkOnline = false;
        if (typeof offlineStorage !== 'undefined') {
            offlineStorage._updateNetworkStatus(false);
            offlineStorage.showOfflineNotice();
        }
        showNotification('网络已断开，正在使用离线内容', 'warning');
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

/**
 * 应用站点配置（从 CONFIG.site 读取站点标识、元信息等）
 */
function applySiteConfig() {
    if (!CONFIG.site) return;

    // 设置页面标题：优先使用完整的 title，否则组合 title_prefix + brand
    if (CONFIG.site.title) {
        document.title = CONFIG.site.title;
    } else if (CONFIG.site.title_prefix && CONFIG.site.brand) {
        document.title = CONFIG.site.title_prefix + ' ' + CONFIG.site.brand;
    } else if (CONFIG.site.brand) {
        document.title = 'Blog | ' + CONFIG.site.brand;
    }

    // 设置 meta description
    if (CONFIG.site.description) {
        let metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.content = CONFIG.site.description;
        }
    }

    // 设置 favicon
    if (CONFIG.site.favicon) {
        let faviconLink = document.querySelector('link[rel="icon"]');
        if (faviconLink) {
            faviconLink.href = CONFIG.site.favicon;
        }
    }

    // 设置 Google 站点验证
    if (CONFIG.site.google_verification) {
        let metaVerify = document.querySelector('meta[name="google-site-verification"]');
        if (!metaVerify) {
            metaVerify = document.createElement('meta');
            metaVerify.name = 'google-site-verification';
            document.head.appendChild(metaVerify);
        }
        metaVerify.content = CONFIG.site.google_verification;
    }

    // 设置品牌名
    if (CONFIG.site.brand) {
        const brandEl = document.querySelector('.brand');
        if (brandEl) brandEl.textContent = CONFIG.site.brand;
    }

    // 更新 footer 版权信息
    if (CONFIG.site.copyright) {
        const footerP = document.querySelector('footer p');
        if (footerP) {
            const year = new Date().getFullYear();
            footerP.innerHTML = `© <span id="year">${year}</span> ${CONFIG.site.copyright}`;
        }
    }

    // 更新上下文菜单"项目源码"链接
    if (CONFIG.site.source_url) {
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            if (item.textContent.includes('项目源码') || item.textContent.includes('项目源碼')) {
                item.onclick = function() { window.open(CONFIG.site.source_url); };
            }
        });
    }

    // 更新搜索框占位符
    if (CONFIG.search) {
        const searchInput = document.getElementById('search-input');
        if (searchInput && CONFIG.search.placeholder) {
            searchInput.placeholder = CONFIG.search.placeholder;
            searchInput.title = `按 Ctrl+K 搜索`;
        }
        const searchKbd = document.querySelector('.search-kbd');
        if (searchKbd && CONFIG.search.kbd_hint) {
            searchKbd.textContent = CONFIG.search.kbd_hint;
        }
    }

    console.log('站点配置已应用');
}

// 显示加载提示
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
    const cacheTtl = (CONFIG.cache && CONFIG.cache.posts_cache_ttl_minutes) || 5;
    const CACHE_TIME = cacheTtl * 60 * 1000;
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

    // 有缓存时立即使用
    if (cached && cached.data && cached.data.length > 0) {
        allIssues = cached.data;
        const displayIssues = filterIssues(allIssues);
        
        // 先渲染缓存数据，标记为缓存模式（黄色）
        renderPosts(displayIssues);
        updateSidebarStats(displayIssues.length);
        handleRouting();
        initTagCloud();
        if (typeof offlineStorage !== 'undefined') {
            offlineStorage._updateNetworkStatus('cache');
        }
        
        // 缓存未过期则直接返回
        if (Date.now() - cached.time < CACHE_TIME) {
            return;
        }
        // 缓存过期则继续向下执行网络请求刷新
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
            // 网络请求成功后恢复为"在线"状态
            offlineStorage._updateNetworkStatus(navigator.onLine);
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
        
        // 同步失败时标记为离线（如果真的是离线）
        if (typeof offlineStorage !== 'undefined') {
            offlineStorage._updateNetworkStatus(navigator.onLine);
            if (!navigator.onLine) {
                offlineStorage.showOfflineNotice();
            }
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
        const tagsHtml = filteredLabels.map(l =>
            `<span class="post-tag" onclick="event.stopPropagation(); filterByTag('${escapeXML(l.name).replace(/'/g, "\\'")}')" title="筛选「${l.name}」标签的文章">${l.name}</span>`
        ).join('');
        
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
        loadTemplate('publish-modal', 'components/publish.html'),
        loadTemplate('settings-overlay', 'components/settings.html'),
        loadTemplate('archive-overlay', 'components/archive.html')
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
        const starsTtl = (CONFIG.cache && CONFIG.cache.stars_cache_ttl_hours) || 1;
        if (Date.now() - time < starsTtl * 3600000) {
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
    const startDate = (CONFIG.site && CONFIG.site.start_date) || '2026-01-01';
    const startTime = new Date(startDate);
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
        if (typeof closeSettings === 'function') closeSettings();
        if (typeof closePublishModal === 'function') closePublishModal();
        if (typeof closeFriends === 'function') closeFriends();
        if (typeof closeArchive === 'function') closeArchive();
        if (typeof hideContextMenu === 'function') hideContextMenu();
    }
};

function hideContextMenu() {
    const menu = document.getElementById('custom-context-menu');
    if (!menu) return;
    menu.classList.add('hiding');
    setTimeout(() => {
        menu.style.display = 'none';
        menu.classList.remove('hiding');
    }, 200);
}

/**
 * 初始化复制保护：除文章界面外禁止复制
 */
function initCopyProtection() {
    document.addEventListener('copy', (e) => {
        const postOverlay = document.getElementById('post-overlay');
        const isPostVisible = postOverlay && postOverlay.style.display === 'block';
        
        // 仅在浏览器默认行为中，非文章区域禁止复制
        // 实际上 CSS user-select 已阻止选择，此事件作为额外保护
        const selection = window.getSelection().toString().trim();
        if (selection && !isPostVisible) {
            e.preventDefault();
            showNotification('仅允许在文章界面内复制内容', 'warning');
        }
    });
}

function initContextMenu() {
    const menu = document.getElementById('custom-context-menu');
    const textGroup = document.getElementById('menu-text-group');
    const quoteAction = document.getElementById('menu-quote-action');
    if (!menu) return;

    // 如果设置了禁用右键菜单，则跳过初始化并阻止自定义菜单出现
    if (window._contextMenuDisabled) {
        menu.style.display = 'none';
        return;
    }

    document.addEventListener('contextmenu', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // 再次检查是否被禁用（可能在运行时被切换）
        if (window._contextMenuDisabled) {
            return; // 不阻止原生菜单
        }

        e.preventDefault();
        // 如果菜单已经显示，先隐藏
        if (menu.style.display === 'block') {
            hideContextMenu();
        }

        lastSelectedText = window.getSelection().toString().trim();
        textGroup.style.display = lastSelectedText.length > 0 ? 'block' : 'none';

        // 检测右键是否发生在文章内容区域内，显示"引用到评论"
        const postBody = document.getElementById('post-body-content');
        const isInPost = postBody && postBody.contains(e.target);
        const isQuotable = e.target.closest && e.target.closest('.quotable-item');
        if (quoteAction) {
            quoteAction.style.display = (lastSelectedText.length > 0 && isInPost && isQuotable) ? 'flex' : 'none';
        }

        let x = e.clientX, y = e.clientY;
        menu.style.display = 'block';
        menu.classList.remove('hiding');
        if (x + menu.offsetWidth > window.innerWidth) x -= menu.offsetWidth;
        if (y + menu.offsetHeight > window.innerHeight) y -= menu.offsetHeight;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
    });

    // 点击菜单项时隐藏菜单
    menu.addEventListener('click', (e) => {
        // 仅当点击的是菜单项（而非分隔符等）时隐藏
        const item = e.target.closest('.menu-item');
        if (item) {
            setTimeout(hideContextMenu, 100);
        }
    });

    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target)) hideContextMenu();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideContextMenu();
    });
}

/**
 * 右键菜单"引用到评论"功能
 * 将选中的文本引用到文章评论区
 */
function quoteSelectedText() {
    if (!lastSelectedText || typeof window._currentQuotePostNum === 'undefined') return;
    
    const cleanedText = lastSelectedText
        .replace(/\s+/g, ' ')
        .replace(/^引用\s*/g, '')
        .trim();
    
    const maxQuoteLen = 500;
    const finalText = cleanedText.length > maxQuoteLen
        ? cleanedText.substring(0, maxQuoteLen) + '...'
        : cleanedText;
    
    const quotedLine = `> ${finalText}`;
    const refLine = `> #${window._currentQuotePostNum}`;
    const quoteBlock = `${quotedLine}\n${refLine}\n\n`;
    
    const textarea = document.getElementById('comment-text');
    
    if (!textarea) {
        const formArea = document.getElementById('comment-form-area');
        if (formArea) {
            formArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        showNotification("请先登录 GitHub 以启用引用评论功能", "error");
        return;
    }
    
    const currentText = textarea.value;
    if (currentText.trim()) {
        textarea.value = currentText + '\n\n' + quoteBlock;
    } else {
        textarea.value = quoteBlock;
    }
    
    if (typeof updateCommentPreview === 'function') {
        updateCommentPreview();
    }
    
    setTimeout(() => {
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        textarea.focus();
        
        const inputEvent = new Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);
    }, 100);
    
    showNotification('已引用选中内容到评论框', 'success');
}

/**
 * 应用右键菜单设置（由 settings 调用）
 * @param {boolean} enabled - 是否启用自定义右键菜单
 */
function applyContextMenuSetting(enabled) {
    window._contextMenuDisabled = !enabled;
    const menu = document.getElementById('custom-context-menu');
    if (menu && !enabled) {
        menu.style.display = 'none';
    }
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
        .slice(0, 30); // 增加显示数量到30个
    
    if (sortedTags.length === 0) {
        tagCloudContainer.innerHTML = '<div class="tag-cloud-empty">✨ 暂无标签，发布文章时添加标签吧</div>';
        return;
    }
    
    // 是否为当前激活的标签
    const isFiltering = currentTagFilter !== null;
    
    // 生成标签HTML - 统一 pill 风格，不再使用字体大小变化
    const tagsHtml = sortedTags.map(([tag, count]) => {
        const isActive = currentTagFilter === tag;
        const activeClass = isActive ? 'active' : '';
        
        // 使用标签名称生成稳定的柔和色调（用于非 active 状态下的 hover 辅助）
        const hue = (tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360);
        const hslColor = `hsl(${hue}, 55%, 50%)`;
        
        return `
            <span class="tag-cloud-item ${activeClass}"
                  data-tag="${escapeXML(tag)}"
                  onclick="filterByTag('${escapeXML(tag).replace(/'/g, "\\'")}')"
                  title="点击筛选「${tag}」标签的文章（${count}篇）">
                <span class="tag-label">${escapeXML(tag)}</span>
                <span class="tag-count">${count}</span>
            </span>
        `;
    }).join('');
    
    // 筛选指示器 + 控制按钮行
    let controlHtml = '';
    if (isFiltering) {
        controlHtml = `
            <div class="tag-cloud-header">
                <div class="filter-indicator">
                    <span class="tag-name">${escapeXML(currentTagFilter)}</span>
                    <span class="clear-filter" onclick="clearTagFilter()" title="清除筛选">✕</span>
                </div>
                <button class="tag-cloud-reset" onclick="clearTagFilter()" title="显示全部文章">
                    全部文章
                </button>
            </div>
        `;
    } else {
        controlHtml = `
            <div class="tag-cloud-header">
                <span style="font-size:0.7rem;color:var(--text-soft);font-weight:600;">点击标签筛选文章</span>
                <span style="font-size:0.65rem;color:var(--text-soft);opacity:0.6;">${sortedTags.length} 个标签</span>
            </div>
        `;
    }
    
    tagCloudContainer.innerHTML = `
        ${controlHtml}
        <div class="tag-cloud-items">
            ${tagsHtml}
        </div>
    `;
}

function filterByTag(tagName) {
    if (!allIssues || allIssues.length === 0) return;
    
    // 如果点击已经激活的标签，取消筛选
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
    updateSidebarStats(filteredIssues.length);
    
    // 平滑滚动到文章列表
    const container = document.getElementById('post-list-container');
    if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
    // 文章列表刷新时同步清除归档缓存，确保数据始终最新
    if (typeof clearArchiveCache === 'function') {
        clearArchiveCache();
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