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
            const errorBody = await res.text();
            throw new Error(`代理请求失败 (${res.status}): ${errorBody}`);
        }

        const data = await res.json();
        
        // 核心检查：如果 data 中没有 token 字段，则抛出详细的后端错误
        if (data.token) {
            setCookie('github_token', data.token);
            showNotification('登录成功！', 'info');
            await updateAuthUI(); 
        } else {
            // 尝试提取 GitHub 或 Worker 返回的具体错误详情
            const detail = data.error_description || data.error || data.message || '返回数据格式不正确';
            throw new Error(`获取 Token 失败: ${detail}`);
        }
    } catch (e) {
        console.error('Token Exchange Error:', e);
        showNotification(e.message, 'error');
    }
}

/**
 * 统一处理所有 UI 状态切换
 */
async function updateAuthUI() {
    const token = getCookie('github_token');
    const loginBtn = document.getElementById('github-login-btn');
    const userInfoArea = document.getElementById('user-info-display');
    const submitBtn = document.getElementById('submit-btn');

    // 1. 同步非登录相关的基础信息
    if (typeof fetchUserIP === 'function') fetchUserIP();
    if (typeof updateBlogRunTime === 'function') updateBlogRunTime();
    
    // 2. 处理登录状态 UI
    if (token) {
        try {
            const res = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${token}` }
            });
            if (!res.ok) throw new Error('Token 已过期');
            const user = await res.json();
            
            // 隐藏登录按钮，显示用户信息
            if (loginBtn) loginBtn.style.display = 'none';
            if (userInfoArea) {
                userInfoArea.style.display = 'flex';
                const avatar = document.getElementById('user-avatar');
                const name = document.getElementById('user-name');
                if (avatar) avatar.src = user.avatar_url;
                if (name) name.textContent = user.login;
            }
            
            // 启用发布按钮
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.background = 'var(--accent)';
                submitBtn.style.cursor = 'pointer';
                submitBtn.textContent = 'PUBLISH NOW';
            }
        } catch (e) {
            console.warn("自动登录失败，清除无效 Token", e);
            logoutGithub();
        }
    } else {
        // 未登录状态 UI 重置
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