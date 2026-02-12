async function openFriends(pushState = true) {
    const overlay = document.getElementById('friends-overlay');
    if (!overlay) {
        const newOverlay = document.createElement('div');
        newOverlay.id = 'friends-overlay';
        newOverlay.className = 'overlay';
        document.body.appendChild(newOverlay);
        return openFriends(pushState);
    }

    if (overlay.innerHTML.trim() === "") {
        try {
            const resp = await fetch('/components/friends.html');
            if (!resp.ok) throw new Error("无法读取 friends.html");
            overlay.innerHTML = await resp.text();
        } catch (e) {
            console.error(e);
            if (typeof showNotification === 'function') showNotification("加载友链失败", "error");
            return;
        }
    }

    const content = document.getElementById('friends-content');
    if (!content) return;
    
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        content.classList.add('show');
    }, 50);
}

function closeFriends() {
    const overlay = document.getElementById('friends-overlay');
    const content = document.getElementById('friends-content');
    if (!content) return;

    content.classList.remove('show');
    setTimeout(() => {
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
}