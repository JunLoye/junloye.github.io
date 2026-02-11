async function openAbout(pushState = true) {
    const overlay = document.getElementById('about-overlay');
    if (!overlay) return;

    if (overlay.innerHTML.trim() === "") {
        try {
            const resp = await fetch('/about.html');
            if (!resp.ok) throw new Error("无法读取 about.html");
            overlay.innerHTML = await resp.text();
        } catch (e) {
            console.error(e);
            if (typeof showNotification === 'function') showNotification("加载 About 失败", "error");
            return;
        }
    }

    const content = document.getElementById('about-content');
    if (!content) return;
    
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        content.classList.add('show');
    }, 50);

    fetchGitHubCommits();
}

async function fetchGitHubCommits() {
    const listContainer = document.getElementById('changelog-list');
    const loadingText = document.getElementById('changelog-loading');
    if (!listContainer) return;

    const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {
        username: 'JunLoye',
        repo: 'junloye.github.io',
        branch: 'main'
    };

    try {
        const response = await fetch(`https://api.github.com/repos/${cfg.username}/${cfg.repo}/commits?sha=${cfg.branch}&per_page=30`); 
        if (!response.ok) throw new Error("API Limit");
        
        const commits = await response.json();
        if (loadingText) loadingText.style.display = 'none';
        
        listContainer.className = "changelog-wrapper"; 

        const displayCommits = commits.filter((item, index) => {
            if (index === 0) return true; 
            return item.commit.message.includes('\n');
        });

        if (displayCommits.length === 0) {
            if (loadingText) {
                loadingText.style.display = 'block';
                loadingText.textContent = "暂无更新记录";
            }
            return;
        }

        listContainer.innerHTML = displayCommits.map(item => {
            const date = new Date(item.commit.author.date).toLocaleDateString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // 处理消息：转义 HTML 字符并保留换行符
            const fullMsg = item.commit.message
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, '<br>');

            const hash = item.sha.substring(0, 7);
            const commitUrl = `https://github.com/${cfg.username}/${cfg.repo}/commit/${item.sha}`;

            return `
                <div class="changelog-item">
                    <div class="changelog-date">
                        <span class="commit-date-text">${date}</span>
                        <a href="${commitUrl}" target="_blank" class="git-version-tag">
                            <svg class="git-icon" viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0z"></path></svg>
                            ${hash}
                        </a>
                    </div>
                    <div class="changelog-msg">${fullMsg}</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        if (loadingText) loadingText.textContent = "暂时无法获取记录";
    }
}

function closeAbout() {
    const overlay = document.getElementById('about-overlay');
    const content = document.getElementById('about-content');
    if (!content) return;

    content.classList.remove('show');
    setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
}

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page === 'about') {
        openAbout(false);
    } else {
        closeAbout();
    }
});