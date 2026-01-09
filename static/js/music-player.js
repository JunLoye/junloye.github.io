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