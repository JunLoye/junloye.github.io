const CONFIG = { 
    username: 'JunLoye', 
    repo: 'junloye.github.io', 
    branch: 'main', 
    musicFolder: 'music' 
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
    const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon} ${msg}</span>`;
    container.appendChild(toast);
    
    const dismiss = () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 400);
    };
    
    setTimeout(dismiss, 5000);
    toast.onclick = dismiss;
}

// --- 2. 路由处理 ---
function handleRouting() {
    const hash = window.location.hash;
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
    if (!content.classList.contains('show')) return;
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
    const container = document.getElementById('post-list-container');
    try {
        // 使用 GitHub Search API 筛选特定参与者
        // q 参数含义：指定仓库 + 是 issue + 开启状态 + 参与者(评论或创建)包含 JunLoye
        const query = encodeURIComponent(`repo:${CONFIG.username}/${CONFIG.repo} is:issue is:open involves:${CONFIG.username}`);
        const res = await fetch(`https://api.github.com/search/issues?q=${query}&sort=created&order=desc`);
        
        if (!res.ok) throw new Error(`无法获取文章 (状态码: ${res.status})`);
        
        const data = await res.json();
        // Search API 的结果存放在 items 数组中
        allIssues = data.items.filter(i => !i.pull_request);
        
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
    if (!area?.classList.contains('show')) return;
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
function playMusic() { audio.play().catch(() => showNotification("可能无法播放，请尝试手动点击", "warning")); musicBtn.classList.add('playing'); playerBar.classList.add('is-playing'); iconPath.setAttribute('d', ICON_PAUSE); }
function pauseMusic() { audio.pause(); musicBtn.classList.remove('playing'); playerBar.classList.remove('is-playing'); iconPath.setAttribute('d', ICON_PLAY); playlistMenu.classList.remove('active'); }

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

// --- 8. 运行时间 ---
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
    
    const closePanel = (e) => {
        const trigger = document.getElementById('settings-trigger');
        if (!panel.contains(e.target) && trigger && !trigger.contains(e.target)) {
            panel.classList.remove('active');
            document.removeEventListener('mousedown', closePanel);
        }
    };
    if (panel.classList.contains('active')) {
        document.addEventListener('mousedown', closePanel);
    }
}

function updateFontFamily(family) {
    document.documentElement.style.setProperty('--global-font-family', family);
    localStorage.setItem('pref-font-family', family);
}

// --- Cookie 工具 ---
function setCookie(name, value, days = 30) {
    const d = new Date();
    d.setTime(d.getTime() + days*24*60*60*1000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/`;
}
function getCookie(name) {
    const arr = document.cookie.split(';');
    for (let c of arr) {
        const [k, v] = c.trim().split('=');
        if (k === name) return decodeURIComponent(v || '');
    }
    return '';
}

// --- 上传图片到 GitHub ---
async function uploadCoverToGithub(file, token) {
    if (!file || !token) throw new Error('缺少图片或Token');
    const reader = new FileReader();
    const progressEl = document.getElementById('publish-progress');
    progressEl.style.display = 'block';
    progressEl.textContent = '正在上传封面...';

    // 生成唯一路径
    const timestamp = Date.now();
    const ext = file.name.split('.').pop().toLowerCase();
    const imgPath = `images/blog_${timestamp}/cover.${ext}`;
    const apiUrl = `https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/contents/${imgPath}`;

    return new Promise((resolve, reject) => {
        reader.onload = async () => {
            const base64 = reader.result.split(',')[1];
            try {
                const res = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `上传封面: ${imgPath}`,
                        content: base64
                    })
                });
                if (!res.ok) {
                    const err = await res.json();
                    reject(new Error(err.message || '图片上传失败'));
                    return;
                }
                // 返回原始图片直链
                const rawUrl = `https://github.com/${CONFIG.username}/${CONFIG.repo}/blob/main/${imgPath}?raw=true`;
                progressEl.textContent = '封面上传成功！';
                setTimeout(() => { progressEl.style.display = 'none'; }, 1200);
                resolve(rawUrl);
            } catch (e) {
                progressEl.textContent = '封面上传失败！';
                setTimeout(() => { progressEl.style.display = 'none'; }, 2000);
                reject(e);
            }
        };
        reader.onerror = () => reject(new Error('图片读取失败'));
        reader.readAsDataURL(file);
    });
}

// --- 发布新内容弹窗逻辑 ---
function openPublishModal() {
    const modal = document.getElementById('publish-modal');
    const content = document.getElementById('publish-modal-content');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => content.classList.add('show'), 50);

    // 自动填充 token
    const tokenInput = document.getElementById('publish-token');
    if (tokenInput) tokenInput.value = getCookie('github_token') || '';
}

function closePublishModal() {
    const modal = document.getElementById('publish-modal');
    const content = document.getElementById('publish-modal-content');
    if (!content.classList.contains('show')) return;
    content.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
}

// --- 发布新内容 API ---
async function publishNewPost(e) {
    e.preventDefault();
    const title = document.getElementById('publish-title').value.trim();
    const body = document.getElementById('publish-body').value.trim();
    const labels = document.getElementById('publish-labels').value.split(',').map(l => l.trim()).filter(Boolean);
    const token = document.getElementById('publish-token').value.trim();
    let cover = document.getElementById('publish-cover')?.value.trim();
    const summary = document.getElementById('publish-summary')?.value.trim();
    const coverFile = document.getElementById('publish-cover-upload')?.files[0];
    const progressEl = document.getElementById('publish-progress');

    if (!title || !body || !token) {
        showNotification('请填写所有必填项', 'warning');
        return;
    }

    setCookie('github_token', token);

    try {
        // 上传封面图片（如有）
        if (coverFile) {
            progressEl.style.display = 'block';
            progressEl.textContent = '正在上传封面图片...';
            cover = await uploadCoverToGithub(coverFile, token);
            document.getElementById('publish-cover').value = cover;
        }

        progressEl.style.display = 'block';
        progressEl.textContent = '正在发布文章...';

        // 构造正文
        let issueBody = '';
        if (cover) issueBody += `### 🖼️ 封面图链接\n${cover}\n\n`;
        if (summary) issueBody += `### 📖 文章简述\n${summary}\n\n`;
        issueBody += `### 📄 正文内容\n${body}\n`;

        const res = await fetch(`https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/issues`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                body: issueBody,
                labels
            })
        });
        if (!res.ok) {
            const err = await res.json();
            progressEl.textContent = '发布失败: ' + (err.message || '未知错误');
            setTimeout(() => { progressEl.style.display = 'none'; }, 2500);
            throw new Error(err.message || '发布失败');
        }
        progressEl.textContent = '发布成功！正在同步...';
        showNotification('发布成功！正在同步...', 'info');
        closePublishModal();

        // 本地插入新卡片（立即反馈）
        // 可选：fetchPosts()前先插入一条本地数据
        // fetchPosts()延迟执行，避免GitHub同步延迟
        setTimeout(() => {
            fetchPosts();
            progressEl.style.display = 'none';
        }, 2000);
    } catch (err) {
        showNotification('发布失败: ' + err.message, 'error');
        progressEl.textContent = '发布失败: ' + err.message;
        setTimeout(() => { progressEl.style.display = 'none'; }, 2500);
    }
}

// 绑定表单事件
const publishForm = document.getElementById('publish-form');
if (publishForm) {
    publishForm.onsubmit = publishNewPost;
}

// --- 封面上传事件绑定 ---
const coverUploadInput = document.getElementById('publish-cover-upload');
if (coverUploadInput) {
    coverUploadInput.onchange = () => {
        const file = coverUploadInput.files[0];
        if (file) {
            document.getElementById('publish-cover').value = file.name;
        }
    };
}

window.onload = () => {
    const savedFamily = localStorage.getItem('pref-font-family') || "'Inter', sans-serif";
    updateFontFamily(savedFamily);
    const fontSelect = document.getElementById('font-family-select');
    if (fontSelect) fontSelect.value = savedFamily;

    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon();

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    
    updateRunTime(); 
    setInterval(updateRunTime, 3600000); 
    fetchPosts(); 
    loadMusic();
};