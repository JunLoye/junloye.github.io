async function openAbout(pushState = true) {
    const overlay = document.getElementById('about-overlay');
    const content = document.getElementById('about-content');
    if (!content) return;

    if (pushState) history.pushState({ page: 'about' }, "About | Jun Loye", "#about");
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => content.classList.add('show'), 50);

    // 触发获取更新日志
    fetchGitHubCommits();
}

async function fetchGitHubCommits() {
    const listContainer = document.getElementById('changelog-list');
    const loadingText = document.getElementById('changelog-loading');
    if (!listContainer || listContainer.children.length > 0) return;

    try {
        const response = await fetch(`https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/commits?sha=${CONFIG.branch}&per_page=15`);
        if (!response.ok) throw new Error();
        
        const commits = await response.json();
        loadingText.style.display = 'none';
        
        listContainer.innerHTML = commits.map(item => {
            const date = new Date(item.commit.author.date).toLocaleDateString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // 处理多行消息：保留换行符并转换为 <br>
            const fullMsg = item.commit.message
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, '<br>');

            const hash = item.sha.substring(0, 7);
            const commitUrl = `https://github.com/${CONFIG.username}/${CONFIG.repo}/commit/${item.sha}`;

            return `
                <div class="changelog-item">
                    <div class="changelog-date">
                        ${date} 
                        <a href="${commitUrl}" target="_blank" class="changelog-link">#${hash}</a>
                    </div>
                    <div class="changelog-msg">${fullMsg}</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        loadingText.textContent = "暂时无法获取记录";
    }
}