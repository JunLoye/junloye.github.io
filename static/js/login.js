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
    try {
        const res = await fetch(CONFIG.proxyUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ code })
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Worker 响应异常: ${res.status}`);
        }

        const data = await res.json();
        
        // 关键修复：同时检查 token (自定义) 和 access_token (GitHub 标准)
        const token = data.token || data.access_token;

        if (token) {
            setCookie('github_token', token);
            showNotification('登录成功！', 'info');
            await updateAuthUI(); 
        } else {
            // 如果 GitHub 返回了错误（如 code 过期），通常在 error_description 字段
            const errorDetail = data.error_description || data.error || 'Worker 未返回有效令牌';
            throw new Error(`登录失败: ${errorDetail}`);
        }
    } catch (e) {
        console.error('Token Exchange Error:', e);
        showNotification(e.message, 'error');
    }
}

async function updateAuthUI() {
    const token = getCookie('github_token');
    const loginBtn = document.getElementById('github-login-btn');
    const userInfoArea = document.getElementById('user-info-display');
    const submitBtn = document.getElementById('submit-btn');

    if (typeof fetchUserIP === 'function') fetchUserIP();
    if (typeof updateBlogRunTime === 'function') updateBlogRunTime();

    if (token) {
        try {
            const res = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${token}` }
            });
            if (!res.ok) throw new Error('Token 已过期');
            const user = await res.json();
            
            if (loginBtn) loginBtn.style.display = 'none';
            if (userInfoArea) {
                userInfoArea.style.display = 'flex';
                const avatar = document.getElementById('user-avatar');
                const name = document.getElementById('user-name');
                if (avatar) avatar.src = user.avatar_url;
                if (name) name.textContent = user.login;
            }
            
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.background = 'var(--accent)';
                submitBtn.style.cursor = 'pointer';
                submitBtn.textContent = 'PUBLISH NOW';
            }
        } catch (e) {
            console.warn("自动登录失败", e);
            logoutGithub();
        }
    } else {
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