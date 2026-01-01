const CONFIG = { username: 'JunLoye', repo: 'junloye.github.io', branch: 'main', musicFolder: 'music' };
const ICON_PLAY = "M8 5v14l11-7z", ICON_PAUSE = "M6 19h4V5H6v14zm8-14v14h4V5h-4z";
const SUN_SVG = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
const MOON_SVG = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';

let allIssues = [];
window.onkeydown = (e) => { if (e.key === 'Escape') closePost(); };

function showError(msg) {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; setTimeout(() => toast.remove(), 400); }, 5000);
}

function toggleDarkMode() {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('theme-icon').innerHTML = isDark ? MOON_SVG : SUN_SVG;
}

async function fetchPosts() {
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/issues?state=open&sort=created`);
        if (res.status === 403) throw new Error("API 请求已达上限，请稍后再试。");
        allIssues = (await res.json()).filter(i => !i.pull_request);
        renderPosts(allIssues);
    } catch (e) { showError(e.message); }
}

function renderPosts(posts) {
    document.getElementById('post-list-container').innerHTML = posts.map(issue => {
        const cover = issue.body.match(/### 🖼️ 封面图链接\s*(http\S+)/)?.[1] || `https://picsum.photos/seed/${issue.id}/800/450`;
        const summary = issue.body.match(/### 📖 文章简述\s*([\s\S]*?)(?=\n---|###|$)/)?.[1]?.trim() || "点击阅读更多细节...";
        return `<div class="post-card" onclick="openPost(${issue.number})">
            <div class="post-cover"><img src="${cover}"></div>
            <h2 class="post-card-title">${issue.title}</h2>
            <div class="post-card-summary">${summary}</div>
        </div>`;
    }).join('');
}

function openPost(num) {
    const issue = allIssues.find(i => i.number === num);
    const cover = issue.body.match(/### 🖼️ 封面图链接\s*(http\S+)/)?.[1] || `https://picsum.photos/seed/${issue.id}/800/450`;
    let cleanBody = issue.body.replace(/### 🖼️ 封面图链接[\s\S]*?(?=\n---|###|$)/, "").replace(/### 📖 文章简述[\s\S]*?(?=\n---|###|$)/, "").replace(/🚀 正文内容/g, "").replace(/💡 发布核对[\s\S]*/, "").replace(/^\s*---\s*/gm, "").trim();
    const date = new Date(issue.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const area = document.getElementById('detail-content-area');
    // 调小了这里的标题字号：font-size 从 2.8rem 降至 2rem
    area.innerHTML = `<img src="${cover}" class="detail-hero-img"><div><div style="color:var(--text-soft); font-size:0.85rem; letter-spacing:1px;">${date}</div><h1 style="font-size:2rem; margin:15px 0; font-weight:900;">${issue.title}</h1><div style="font-size:0.75rem; font-weight:700; color:var(--accent); text-transform:uppercase; margin-bottom:40px; background:var(--selection-bg); display:inline-block; padding:2px 10px; border-radius:4px;">${issue.labels[0]?.name || 'MEMO'}</div></div><div class="markdown-body">${marked.parse(cleanBody)}</div>`;
    
    document.getElementById('post-detail-overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = '6px';
    
    setTimeout(() => area.classList.add('show'), 50);
    document.getElementById('theme-toggle-btn').style.display = 'flex';
}

function closePost() { 
    const area = document.getElementById('detail-content-area');
    area.classList.remove('show');
    setTimeout(() => {
        document.getElementById('post-detail-overlay').style.display = 'none'; 
        document.getElementById('theme-toggle-btn').style.display = 'none';
        document.body.style.overflow = ''; 
        document.body.style.paddingRight = '';
    }, 300);
}

// --- 音乐逻辑 ---
const audio = document.getElementById('bg-audio'), musicBtn = document.getElementById('music-btn'), 
      playerBar = document.getElementById('player-bar'), trackName = document.getElementById('track-name'),
      iconPath = document.getElementById('btn-icon-path'), playlistMenu = document.getElementById('playlist-menu');
let playlist = [], currentIdx = 0;

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

async function loadMusic() {
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/contents/${CONFIG.musicFolder}?ref=${CONFIG.branch}`);
        const files = await res.json();
        playlist = files.filter(f => f.name.endsWith('.mp3')).map(f => ({
            name: f.name.replace('.mp3', ''),
            url: `https://raw.githubusercontent.com/${CONFIG.username}/${CONFIG.repo}/${CONFIG.branch}/${f.path}`
        }));
        
        if (playlist.length) {
            shuffleArray(playlist);
            audio.src = playlist[0].url; 
            trackName.textContent = playlist[0].name; 
            renderPlaylist(); 
        }
    } catch (e) {}
}

function renderPlaylist() { 
    playlistMenu.innerHTML = playlist.map((s, i) => 
        `<div class="playlist-item ${i === currentIdx ? 'playing' : ''}" onclick="selectTrack(${i})">${s.name}</div>`
    ).join(''); 
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
function playMusic() { audio.play().catch(e => {}); musicBtn.classList.add('playing'); playerBar.classList.add('is-playing'); iconPath.setAttribute('d', ICON_PAUSE); }
function pauseMusic() { audio.pause(); musicBtn.classList.remove('playing'); playerBar.classList.remove('is-playing'); iconPath.setAttribute('d', ICON_PLAY); playlistMenu.classList.remove('active'); }

function nextTrack() {
    currentIdx = (currentIdx + 1) % playlist.length;
    selectTrack(currentIdx);
}

musicBtn.onclick = (e) => { e.stopPropagation(); audio.paused ? playMusic() : pauseMusic(); };
musicBtn.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); nextTrack(); };
audio.onended = () => { nextTrack(); };

// --- 初始化 ---
document.getElementById('theme-icon').innerHTML = MOON_SVG;
document.getElementById('year').textContent = new Date().getFullYear();
fetchPosts(); 
loadMusic();

document.getElementById('search-input').oninput = (e) => {
    const filtered = allIssues.filter(i => i.title.toLowerCase().includes(e.target.value.toLowerCase()));
    renderPosts(filtered);
};