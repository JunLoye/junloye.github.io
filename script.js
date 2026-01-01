const CONFIG = { 
    username: 'JunLoye', 
    repo: 'junloye.github.io', 
    branch: 'main', 
    musicFolder: 'music' 
};

const ICON_PLAY = "M8 5v14l11-7z", ICON_PAUSE = "M6 19h4V5H6v14zm8-14v14h4V5h-4z";
const SUN_SVG = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
const MOON_SVG = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';

let allIssues = [];
const ORIGINAL_TITLE = document.title; // 记录网站初始标题

// --- 1. 全局错误与通知系统 ---
window.onerror = (msg) => showNotification(`代码错误: ${msg}`, 'error');
window.onunhandledrejection = (event) => showNotification(`异步请求失败: ${event.reason}`, 'error');

function showNotification(msg, type = 'error') {
    const container = document.getElementById('notification-container');
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

// --- 2. 路由与历史记录处理 ---
function handleRouting() {
    const hash = window.location.hash;
    // 如果 URL 包含 #post-数字，自动打开对应文章
    if (hash.startsWith('#post-')) {
        const num = parseInt(hash.replace('#post-', ''));
        if (!isNaN(num)) openPost(num, false);
    } 
    // 如果 URL 包含 #about，自动打开关于页面
    else if (hash === '#about') {
        openAbout(false);
    }
}

window.addEventListener('popstate', (event) => {
    const postArea = document.getElementById('detail-content-area');
    const aboutContent = document.getElementById('about-content');
    
    // 浏览器后退时，如果弹窗是在开着的，则关闭它们
    if (!window.location.hash) {
        if (postArea.classList.contains('show')) realClosePost();
        if (aboutContent.classList.contains('show')) realCloseAbout();
    } else {
        handleRouting();
    }
});

window.onkeydown = (e) => { 
    if (e.key === 'Escape') {
        closePost();
        closeAbout();
    }
};

// --- 3. 关于页面 (About) 逻辑 ---
function openAbout(pushState = true) {
    if (pushState) history.pushState({ page: 'about' }, "About | Jun Loye", "#about");
    const overlay = document.getElementById('about-overlay');
    const content = document.getElementById('about-content');
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => content.classList.add('show'), 50);
}

function closeAbout() {
    // 如果当前在 about 路由，点击关闭按钮应触发后退
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
function toggleDarkMode() {
    const body = document.body;
    const icon = document.getElementById('theme-icon');
    
    // 获取当前是否为暗色
    const isDark = body.getAttribute('data-theme') === 'dark';
    
    if (isDark) {
        // 切换到亮色
        body.setAttribute('data-theme', 'light');
        icon.innerHTML = MOON_SVG; // 显示月亮图标
    } else {
        // 切换到暗色
        body.setAttribute('data-theme', 'dark');
        icon.innerHTML = SUN_SVG;  // 显示太阳图标
    }
}

// --- 5. 文章列表与详情逻辑 ---
async function fetchPosts() {
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/issues?state=open&sort=created`);
        if (!res.ok) throw new Error(`无法获取文章 (状态码: ${res.status})`);
        allIssues = (await res.json()).filter(i => !i.pull_request);
        renderPosts(allIssues);
        // 数据加载完毕后，解析路由以支持刷新跳转
        handleRouting();
    } catch (e) {
        showNotification(e.message, 'error');
    }
}

function renderPosts(posts) {
    const container = document.getElementById('post-list-container');
    if (posts.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-soft);">未找到匹配的文章</div>`;
        return;
    }
    container.innerHTML = posts.map(issue => {
        const cover = issue.body.match(/### 🖼️ 封面图链接\s*(http\S+)/)?.[1] || `https://picsum.photos/seed/${issue.id}/800/450`;
        const summary = issue.body.match(/### 📖 文章简述\s*([\s\S]*?)(?=\n---|###|$)/)?.[1]?.trim() || "阅读更多详情...";
        const tagsHtml = issue.labels.map(l => `<span class="post-tag">${l.name}</span>`).join('');

        return `<div class="post-card" onclick="openPost(${issue.number})">
            <div class="post-cover"><img src="${cover}"></div>
            <h2 class="post-card-title">${issue.title}</h2>
            <div class="post-card-summary">${summary}</div>
            <div class="post-card-tags">${tagsHtml}</div>
        </div>`;
    }).join('');
}

function openPost(num, pushState = true) {
    const issue = allIssues.find(i => i.number === num);
    if (!issue) return;
    
    // 注入历史记录和网页标题
    if (pushState) history.pushState({ page: 'detail', id: num }, issue.title, `#post-${num}`);
    document.title = `${issue.title} | Jun Loye`;

    const cover = issue.body.match(/### 🖼️ 封面图链接\s*(http\S+)/)?.[1] || `https://picsum.photos/seed/${issue.id}/800/450`;
    let cleanBody = issue.body.replace(/### 🖼️ 封面图链接[\s\S]*?(?=\n---|###|$)/, "")
                              .replace(/### 📖 文章简述[\s\S]*?(?=\n---|###|$)/, "")
                              .replace(/🚀 正文内容|📄 正文内容/g, "")
                              .replace(/💡 发布核对[\s\S]*/, "")
                              .replace(/^\s*---\s*/gm, "").trim();

    let htmlContent = marked.parse(cleanBody);
    // 处理 Markdown Alert 样式
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
    if (!area.classList.contains('show')) return;
    
    document.title = ORIGINAL_TITLE; // 恢复原始标题
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
    playlistMenu.innerHTML = playlist.map((s, i) => `<div class="playlist-item ${i === currentIdx ? 'playing' : ''}" onclick="selectTrack(${i})">${s.name}</div>`).join(''); 
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
function playMusic() { audio.play().catch(e => showNotification("无法播放，请尝试手动点击", "warning")); musicBtn.classList.add('playing'); playerBar.classList.add('is-playing'); iconPath.setAttribute('d', ICON_PAUSE); }
function pauseMusic() { audio.pause(); musicBtn.classList.remove('playing'); playerBar.classList.remove('is-playing'); iconPath.setAttribute('d', ICON_PLAY); playlistMenu.classList.remove('active'); }

function nextTrack() {
    if (playlist.length === 0) return;
    currentIdx = (currentIdx + 1) % playlist.length;
    selectTrack(currentIdx);
}

musicBtn.onclick = (e) => { e.stopPropagation(); audio.paused ? playMusic() : pauseMusic(); };
musicBtn.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); nextTrack(); };
audio.onended = () => { nextTrack(); };

// --- 7. 搜索逻辑 ---
document.getElementById('search-input').oninput = (e) => {
    const term = e.target.value.toLowerCase().trim();
    const filtered = allIssues.filter(i => i.title.toLowerCase().includes(term) || i.labels.some(l => l.name.toLowerCase().includes(term)));
    renderPosts(filtered);
};

// --- 8. 初始化执行 ---
window.onload = () => {
    const body = document.body;
    const icon = document.getElementById('theme-icon');
    
    // 根据当前 body 的 data-theme 初始化图标
    const currentTheme = body.getAttribute('data-theme');
    icon.innerHTML = currentTheme === 'dark' ? SUN_SVG : MOON_SVG;
    
    // 这里的 stroke 样式建议写在 CSS 里，JS 保持简洁
    icon.style.fill = "currentColor"; 
    
    document.getElementById('year').textContent = new Date().getFullYear();
    fetchPosts(); 
    loadMusic();
};