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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });

        if (!res.ok) throw new Error(`连接验证服务器失败 (状态码: ${res.status})`);

        const data = await res.json();
        const token = data.access_token || data.token;

        if (token) {
            setCookie('github_token', token);
            await updateAuthUI();
            showNotification('登录成功！', 'info');
        } else {
            throw new Error(data.error_description || data.error || 'GitHub 未能成功颁发令牌');
        }
    } catch (e) {
        showNotification(`登录失败: ${e.message}`, 'error');
    }
}

async function updateAuthUI() {
    // 如果组件还没加载，等下再更新 UI，因为需要操作里面的 submit-btn
    if (!templatesLoaded) {
        setTimeout(updateAuthUI, 200);
        return;
    }

    const token = getCookie('github_token');
    const loginBtn = document.getElementById('github-login-btn');
    const userInfoArea = document.getElementById('user-info-display');
    const submitBtn = document.getElementById('submit-btn');

    if (token) {
        try {
            const res = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${token}` }
            });
            if (!res.ok) throw new Error('Token 已过期或无效');
            const user = await res.json();
            
            if (loginBtn) loginBtn.style.display = 'none';
            if (userInfoArea) {
                userInfoArea.style.display = 'flex';
                document.getElementById('user-avatar').src = user.avatar_url;
                document.getElementById('user-name').textContent = user.login;
            }
            
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.background = 'var(--accent)';
                submitBtn.style.cursor = 'pointer';
                submitBtn.textContent = '发布文章';
            }
        } catch (e) {
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