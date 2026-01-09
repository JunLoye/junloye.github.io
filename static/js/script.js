const CONFIG = { 
    username: 'JunLoye', 
    repo: 'junloye.github.io', 
    branch: 'main', 
    musicFolder: 'music',
    // --- OAuth 配置 ---
    // 提示：请确保 clientId 与 GitHub OAuth App 页面一致
    clientId: 'Ov23licJrsWm5hKFYAxj', 
    // 提示：proxyUrl 应为您 Cloudflare Worker 的完整地址，建议不带末尾斜杠
    proxyUrl: 'https://github-oauth-worker.loyejun.workers.dev' 
};

const ICON_PLAY = "M8 5v14l11-7z", ICON_PAUSE = "M6 19h4V5H6v14zm8-14v14h4V5h-4z";
const SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
const MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

let allIssues = [];
const ORIGINAL_TITLE = document.title;

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

    // 处理 OAuth 回调：当检测到 URL 中有 code 参数时，触发 Token 交换
    if (code) {
        window.history.replaceState({}, document.title, window.location.pathname); // 立即清除 URL 中的敏感 code
        await exchangeCodeForToken(code);
    }

    if (hash.startsWith('#post-')) {
        const num = parseInt(hash.replace('#post-', ''));
        if (!isNaN(num)) openPost(num, false);
    } else if (hash === '#about') {
        openAbout(false);
    }
}

window.addEventListener('popstate', () => {
    const postArea = document.getElementById('detail-content-area');
    const aboutContent = document.getElementById('about-content');
    if (!window.location.hash) {
        if (postArea?.classList.contains('show')) realClosePost();
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

// --- 3. 关于页面 ---
function openAbout(pushState = true) {
    if (pushState) history.pushState({ page: 'about' }, "About | Jun Loye", "#about");
    const overlay = document.getElementById('about-overlay');
    const content = document.getElementById('about-content');
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => content.classList.add('show'), 50);
}

function closeAbout() {
    if (window.location.hash === '#about') history.back();
    else realCloseAbout();
}

function realCloseAbout() {
    const overlay = document.getElementById('about-overlay');
    const content = document.getElementById('about-content');
    if (!content || !content.classList.contains('show')) return;
    content.classList.remove('show');
    setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
}

// --- 4. 主题切换逻辑 ---
function updateThemeIcon() {
    const body = document.body;
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    const isDark = body.getAttribute('data-theme') === 'dark';
    btn.innerHTML = isDark ? SUN_SVG : MOON_SVG;
}

function toggleDarkMode() {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon();
}

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
        
        // 存入缓存
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

function renderPosts(posts, highlightTerm = "") {
    const container = document.getElementById('post-list-container');
    if (!container) return;
    
    if (posts.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-soft);">未找到匹配的文章</div>`;
        return;
    }

    container.innerHTML = posts.map(issue => {
        const cover = issue.body?.match(/### 🖼️ 封面图链接\s*(http\S+)/)?.[1] || `https://picsum.photos/seed/${issue.id}/800/450`;
        const summaryRaw = issue.body?.match(/### 📖 文章简述\s*([\s\S]*?)(?=\n---|###|$)/)?.[1]?.trim() || "";
        
        let displayTitle = issue.title;
        let displaySummary = marked.parse(summaryRaw);

        if (highlightTerm) {
            const regex = new RegExp(`(${highlightTerm})`, 'gi');
            displayTitle = displayTitle.replace(regex, `<mark class="search-highlight">$1</mark>`);
            displaySummary = displaySummary.replace(new RegExp(`(>[^<]*)(${highlightTerm})([^>]*<)`, 'gi'), '$1<mark class="search-highlight">$2</mark>$3');
        }

        const tagsHtml = issue.labels.map(l => 
            `<span class="post-tag" onclick="event.stopPropagation(); filterByTag('${l.name}')">${l.name}</span>`
        ).join('');

        return `<div class="post-card" onclick="openPost(${issue.number})">
            <div class="post-cover"><img src="${cover}"></div>
            <h2 class="post-card-title">${displayTitle}</h2>
            <div class="post-card-summary markdown-body" style="font-size: 0.9rem;">${displaySummary}</div>
            <div class="post-card-tags">${tagsHtml}</div>
        </div>`;
    }).join('');

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

function openPost(num, pushState = true) {
    const issue = allIssues.find(i => i.number === num);
    if (!issue) return;
    
    if (pushState) history.pushState({ page: 'detail', id: num }, issue.title, `#post-${num}`);
    document.title = `${issue.title} | Jun Loye`;

    const cover = issue.body?.match(/### 🖼️ 封面图链接\s*(http\S+)/)?.[1] || `https://picsum.photos/seed/${issue.id}/800/450`;
    let cleanBody = (issue.body || "")
                              .replace(/### 🖼️ 封面图链接[\s\S]*?(?=\n---|###|$)/, "")
                              .replace(/### 📖 文章简述[\s\S]*?(?=\n---|###|$)/, "")
                              .replace(/🚀 正文内容|📄 正文内容/g, "")
                              .replace(/💡 发布核对[\s\S]*/, "")
                              .replace(/^\s*---\s*/gm, "").trim();

    let htmlContent = marked.parse(cleanBody);
    htmlContent = htmlContent.replace(/<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|AI)\]([\s\S]*?)<\/p>\s*<\/blockquote>/gi, (match, type, content) => {
        const t = type.toUpperCase();
        return `<div class="markdown-alert markdown-alert-${t.toLowerCase()}"><p class="markdown-alert-title">${t === 'AI' ? 'AI Generated' : t}</p><div class="markdown-alert-content">${content.trim()}</div></div>`;
    });

    const date = new Date(issue.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    const area = document.getElementById('detail-content-area');
    
    area.innerHTML = `<img src="${cover}" class="detail-hero-img" style="height: 280px; width: 100%; object-fit: cover; margin-bottom: 25px;">
        <div>
            <div style="display: flex; justify-content: space-between; align-items: center; color:var(--text-soft); font-size:0.85rem;">
                <span>${date}</span>
                <span style="font-size:0.75rem; font-weight:700; color:var(--accent); background:var(--selection-bg); padding:2px 10px; border-radius:4px;">${issue.labels[0]?.name || 'MEMO'}</span>
            </div>
            <h1 style="font-size:2rem; margin:15px 0 15px 0; font-weight:900;">${issue.title}</h1>
        </div>
        <div class="markdown-body">${htmlContent}</div>`;
    
    document.getElementById('post-detail-overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => area.classList.add('show'), 50);
}

function closePost() {
    if (window.location.hash.startsWith('#post-')) history.back();
    else realClosePost();
}

function realClosePost() {
    const area = document.getElementById('detail-content-area');
    if (!area || !area.classList.contains('show')) return;
    document.title = ORIGINAL_TITLE;
    area.classList.remove('show');
    setTimeout(() => {
        document.getElementById('post-detail-overlay').style.display = 'none'; 
        document.body.style.overflow = ''; 
    }, 300);
}

// --- 6. 音乐播放逻辑 ---
const audio = document.getElementById('bg-audio'), musicBtn = document.getElementById('music-btn'), 
      playerBar = document.getElementById('player-bar'), trackName = document.getElementById('track-name'),
      iconPath = document.getElementById('btn-icon-path'), playlistMenu = document.getElementById('playlist-menu');
let playlist = [], currentIdx = 0;

async function loadMusic() {
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/contents/${CONFIG.musicFolder}?ref=${CONFIG.branch}`);
        if (!res.ok) throw new Error("音乐库加载失败");
        const files = await res.json();
        playlist = files.filter(f => f.name.endsWith('.mp3')).map(f => ({
            name: f.name.replace('.mp3', ''),
            url: `https://raw.githubusercontent.com/${CONFIG.username}/${CONFIG.repo}/${CONFIG.branch}/${f.path}`
        }));
        if (playlist.length) {
            playlist.sort(() => Math.random() - 0.5);
            audio.src = playlist[0].url; 
            trackName.textContent = playlist[0].name; 
            renderPlaylist(); 
        }
    } catch (e) {
        showNotification(e.message, 'warning');
    }
}

function renderPlaylist() { 
    if (playlistMenu) {
        playlistMenu.innerHTML = playlist.map((s, i) => `<div class="playlist-item ${i === currentIdx ? 'playing' : ''}" onclick="selectTrack(${i})">${s.name}</div>`).join(''); 
    }
}

function selectTrack(i) { 
    currentIdx = i; 
    audio.src = playlist[i].url; 
    trackName.textContent = playlist[i].name; 
    renderPlaylist(); 
    playMusic(); 
    playlistMenu.classList.remove('active'); 
}

function togglePlaylist() { playlistMenu.classList.toggle('active'); }
function playMusic() { audio.play().catch(() => showNotification("可能无法播放，请尝试手动点击", "warning")); musicBtn?.classList.add('playing'); playerBar?.classList.add('is-playing'); iconPath?.setAttribute('d', ICON_PAUSE); }
function pauseMusic() { audio.pause(); musicBtn?.classList.remove('playing'); playerBar?.classList.remove('is-playing'); iconPath?.setAttribute('d', ICON_PLAY); playlistMenu?.classList.remove('active'); }

function nextTrack() {
    if (playlist.length === 0) return;
    currentIdx = (currentIdx + 1) % playlist.length;
    selectTrack(currentIdx);
}

if (musicBtn) {
    musicBtn.onclick = (e) => { e.stopPropagation(); audio.paused ? playMusic() : pauseMusic(); };
    musicBtn.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); nextTrack(); };
}
if (audio) audio.onended = () => { nextTrack(); };

// --- 7. 搜索逻辑 ---
function filterByTag(tagName) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = tagName;
        searchInput.dispatchEvent(new Event('input')); 
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

const searchInputEl = document.getElementById('search-input');
if (searchInputEl) {
    searchInputEl.oninput = (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) {
            renderPosts(allIssues);
            const countEl = document.getElementById('search-count-hint');
            if (countEl) countEl.remove();
            return;
        }
        const filtered = allIssues.filter(issue => {
            const titleMatch = issue.title.toLowerCase().includes(term);
            const bodyMatch = (issue.body || "").toLowerCase().includes(term);
            const tagMatch = issue.labels.some(l => l.name.toLowerCase().includes(term));
            return titleMatch || bodyMatch || tagMatch;
        });
        renderPosts(filtered, term);
    };
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

function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;
    panel.classList.toggle('active');
}

function updateFontFamily(family) {
    document.documentElement.style.setProperty('--global-font-family', family);
    localStorage.setItem('pref-font-family', family);
}

// --- 9. OAuth 登录核心逻辑 (修复与合并) ---

// Cookie 工具函数
function setCookie(name, value, days = 30) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return '';
}

function loginWithGithub() {
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${CONFIG.clientId}&scope=public_repo&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

async function exchangeCodeForToken(code) {
    showNotification('正在获取登录令牌...', 'info');
    console.log('--- 发起令牌交换请求 ---');
    console.log('中转服务器:', CONFIG.proxyUrl);

    try {
        const res = await fetch(CONFIG.proxyUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });

        if (!res.ok) {
            console.error('Worker 响应状态:', res.status);
            throw new Error(`连接验证服务器失败 (状态码: ${res.status})`);
        }

        const data = await res.json();
        console.log('Worker 返回原始数据:', data);

        // 注意：Worker 返回的可能是 { access_token: "..." } 或 { token: "..." }，取决于 Worker 代码
        const token = data.access_token || data.token;

        if (token) {
            setCookie('github_token', token);
            await updateAuthUI();
            showNotification('登录成功！', 'info');
        } else {
            console.error('GitHub 详细错误:', data);
            throw new Error(data.error_description || data.error || 'GitHub 未能成功颁发令牌');
        }
    } catch (e) {
        console.error('--- OAuth 错误详情 ---');
        console.error(e);
        showNotification(`登录失败: ${e.message}`, 'error');
    }
}

async function updateAuthUI() {
    const token = getCookie('github_token');
    const loginBtn = document.getElementById('github-login-btn');
    const userInfoArea = document.getElementById('user-info-display');
    const submitBtn = document.getElementById('submit-btn');

    if (token) {
        try {
            const res = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${token}` }
            });
            if (!res.ok) throw new Error('Token 已过期或无效');
            const user = await res.json();
            
            // 更新 UI 状态
            if (loginBtn) loginBtn.style.display = 'none';
            if (userInfoArea) {
                userInfoArea.style.display = 'flex';
                document.getElementById('user-avatar').src = user.avatar_url;
                document.getElementById('user-name').textContent = user.login;
            }
            
            // 激活发布权限
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.background = 'var(--accent)';
                submitBtn.style.cursor = 'pointer';
                submitBtn.textContent = '发布文章';
            }
        } catch (e) {
            console.warn('用户信息拉取失败，尝试重新登录:', e.message);
            logoutGithub();
        }
    } else {
        // 未登录状态还原 UI
        if (loginBtn) loginBtn.style.display = 'flex';
        if (userInfoArea) userInfoArea.style.display = 'none';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.background = 'var(--line)';
            submitBtn.style.cursor = 'not-allowed';
            submitBtn.textContent = '请先登录';
        }
    }
}

function logoutGithub() {
    setCookie('github_token', '', -1);
    updateAuthUI();
}

// --- 10. 上传图片与发布内容 ---
async function uploadCoverToGithub(file, token) {
    if (!file || !token) throw new Error('缺少图片或登录已失效');
    const timestamp = Date.now();
    const ext = file.name.split('.').pop().toLowerCase();
    const imgPath = `images/blog_${timestamp}/cover.${ext}`;
    const apiUrl = `https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/contents/${imgPath}`;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result.split(',')[1];
            try {
                const res = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message: `Upload cover: ${imgPath}`, content: base64 })
                });
                if (!res.ok) throw new Error('图片上传失败');
                resolve(`https://github.com/${CONFIG.username}/${CONFIG.repo}/blob/main/${imgPath}?raw=true`);
            } catch (e) { reject(e); }
        };
        reader.readAsDataURL(file);
    });
}

function openPublishModal() {
    const modal = document.getElementById('publish-modal');
    const content = document.getElementById('publish-modal-content');
    if (!modal || !content) return;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => content.classList.add('show'), 50);
    updateAuthUI();
}

function closePublishModal() {
    const modal = document.getElementById('publish-modal');
    const content = document.getElementById('publish-modal-content');
    if (!content || !content.classList.contains('show')) return;
    content.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
}

async function publishNewPost(e) {
    e.preventDefault();
    const token = getCookie('github_token');
    const title = document.getElementById('publish-title').value.trim();
    const body = document.getElementById('publish-body').value.trim();
    const labels = document.getElementById('publish-labels').value.split(',').map(l => l.trim()).filter(Boolean);
    const summary = document.getElementById('publish-summary').value.trim();
    let cover = document.getElementById('publish-cover').value.trim();
    const coverFile = document.getElementById('publish-cover-upload').files[0];
    const progressEl = document.getElementById('publish-progress');

    if (!token) return showNotification('请先登录', 'warning');

    try {
        if (progressEl) progressEl.style.display = 'block';
        if (coverFile) {
            if (progressEl) progressEl.textContent = '正在上传封面...';
            cover = await uploadCoverToGithub(coverFile, token);
        }

        if (progressEl) progressEl.textContent = '正在发布到 GitHub Issues...';
        let issueBody = '';
        if (cover) issueBody += `### 🖼️ 封面图链接\n${cover}\n\n`;
        if (summary) issueBody += `### 📖 文章简述\n${summary}\n\n`;
        issueBody += `### 📄 正文内容\n${body}\n`;

        const res = await fetch(`https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/issues`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, body: issueBody, labels })
        });

        if (!res.ok) throw new Error('发布请求被 GitHub 拒绝，请检查权限');
        
        showNotification('发布成功！', 'info');
        closePublishModal();
        // 清空表单
        e.target.reset();
        if (document.getElementById('md-preview')) document.getElementById('md-preview').innerHTML = '';
        
        setTimeout(fetchPosts, 2000);
    } catch (err) {
        showNotification(err.message, 'error');
    } finally {
        if (progressEl) progressEl.style.display = 'none';
    }
}

// --- 11. 初始化与监听绑定 ---
const publishForm = document.getElementById('publish-form');
if (publishForm) publishForm.onsubmit = publishNewPost;

const publishBody = document.getElementById('publish-body');
const mdPreview = document.getElementById('md-preview');
if (publishBody && mdPreview) {
    publishBody.oninput = () => {
        mdPreview.innerHTML = marked.parse(publishBody.value || '预览区域...');
    };
}

window.onload = () => {
    // 恢复偏好设置
    const savedFamily = localStorage.getItem('pref-font-family') || "'Inter', sans-serif";
    updateFontFamily(savedFamily);
    const fontSelect = document.getElementById('font-family-select');
    if (fontSelect) fontSelect.value = savedFamily;

    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon();

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    
    // 启动核心模块
    updateRunTime(); 
    fetchPosts(); 
    loadMusic();
    updateAuthUI(); // 初始化时同步登录状态
};