/**
 * 打开 About 界面
 */
async function openAbout(pushState = true) {
    const overlay = document.getElementById('about-overlay');
    if (!overlay) return;

    // 1. 确保内容已加载
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

    // 2. 切换显示状态
    if (pushState) {
        history.pushState({ page: 'about' }, "About | Jun Loye", "#about");
    }
    
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        content.classList.add('show');
    }, 50);

    // 3. 触发获取更新日志
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
        const response = await fetch(`https://api.github.com/repos/${cfg.username}/${cfg.repo}/commits?sha=${cfg.branch}&per_page=15`);
        if (!response.ok) throw new Error("API Limit");
        
        const commits = await response.json();
        if (loadingText) loadingText.style.display = 'none';
        
        listContainer.className = "changelog-wrapper"; 
        listContainer.innerHTML = commits.map(item => {
            const date = new Date(item.commit.author.date).toLocaleDateString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
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

/**
 * 关闭 About 界面
 */
function closeAbout() {
    if (window.location.hash === '#about') {
        history.back();
    } else {
        realCloseAbout();
    }
}

function realCloseAbout() {
    const overlay = document.getElementById('about-overlay');
    const content = document.getElementById('about-content');
    if (!content) return;

    content.classList.remove('show');
    setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
}

// 监听浏览器前进后退
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page === 'about') {
        openAbout(false);
    } else {
        realCloseAbout();
    }
});