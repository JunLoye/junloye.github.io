function openPost(num, pushState = true) {
    const issue = allIssues.find(i => i.number === num);
    const area = document.getElementById('detail-content-area');
    if (!issue || !area) return;
    
    if (pushState) history.pushState({ page: 'detail', id: num }, issue.title, `#post-${num}`);
    document.title = `${issue.title} | Jun Loye`;

    const cover = issue.body?.match(/### 🖼️ 封面图链接\s*(http\S+)/)?.[1] || `https://picsum.photos/seed/${issue.id}/800/450`;
    let cleanBody = (issue.body || "")
                              .replace(/### 🖼️ 封面图链接[\s\S]*?(?=\n---|###|$)/, "")
                              .replace(/### 📖 文章简述[\s\S]*?(?=\n---|###|$)/, "")
                              .replace(/🚀 正文内容|📄 正文内容/g, "")
                              .replace(/💡 发布核对[\s\S]*/, "")
                              .replace(/^\s*---\s*/gm, "").trim();

    let htmlContent = marked.parse(cleanBody);
    htmlContent = htmlContent.replace(/<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|AI)\]([\s\S]*?)<\/p>\s*<\/blockquote>/gi, (match, type, content) => {
        const t = type.toUpperCase();
        return `<div class="markdown-alert markdown-alert-${t.toLowerCase()}"><p class="markdown-alert-title">${t === 'AI' ? 'AI Generated' : t}</p><div class="markdown-alert-content">${content.trim()}</div></div>`;
    });

    const date = new Date(issue.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    
    area.innerHTML = `<img src="${cover}" class="detail-hero-img" style="height: 280px; width: 100%; object-fit: cover; margin-bottom: 25px;">
        <div>
            <div style="display: flex; justify-content: space-between; align-items: center; color:var(--text-soft); font-size:0.85rem;">
                <span>${date}</span>
                <span style="font-size:0.75rem; font-weight:700; color:var(--accent); background:var(--selection-bg); padding:2px 10px; border-radius:4px;">${issue.labels[0]?.name || 'MEMO'}</span>
            </div>
            <h1 style="font-size:2rem; margin:15px 0 15px 0; font-weight:900;">${issue.title}</h1>
        </div>
        <div class="markdown-body">${htmlContent}</div>`;
    
    const editBtn = document.getElementById('edit-post-btn');
    if (editBtn) {
        editBtn.style.display = 'flex';
        editBtn.onclick = () => {
            showCorrectionModal(num, issue.title);
        };
    }

    document.getElementById('post-detail-overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => area.classList.add('show'), 50);
}

function getGithubToken() {
    const name = "github_token=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
    }
    return "";
}

function showCorrectionModal(num, title) {
    const modal = document.getElementById('correction-modal');
    const textarea = document.getElementById('correction-text');
    const commentBtn = document.getElementById('submit-comment-btn');
    const issueBtn = document.getElementById('submit-issue-btn');
    const token = getGithubToken();

    textarea.value = ''; 
    modal.style.display = 'flex';

    if (!token) {
        textarea.disabled = true;
        textarea.placeholder = "🔒 请先在 首页顶部 通过 GitHub 登录后再提交反馈...\n或者直接到项目GitHub地址反馈";
        textarea.style.cursor = "not-allowed";
        textarea.style.background = "var(--bg-soft)";
        
        [commentBtn, issueBtn].forEach(btn => {
            btn.disabled = true;
            btn.style.cursor = "not-allowed";
            btn.style.opacity = "0.5";
        });

        showNotification("请先登录 GitHub 以激活网页端反馈功能", "warning");
    } else {
        textarea.disabled = false;
        textarea.placeholder = "请输入您要反馈的内容...";
        textarea.style.cursor = "auto";
        textarea.style.background = "var(--bg)";
        
        [commentBtn, issueBtn].forEach(btn => {
            btn.disabled = false;
            btn.style.cursor = "pointer";
            btn.style.opacity = "1";
        });
        
        setTimeout(() => textarea.focus(), 100);
    }
    
    commentBtn.onclick = () => submitCorrection(num, title, 'comment');
    issueBtn.onclick = () => submitCorrection(num, title, 'issue');
    document.getElementById('cancel-modal-btn').onclick = () => modal.style.display = 'none';
    
    modal.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
}

async function submitCorrection(num, title, type) {
    const token = getGithubToken();
    const textarea = document.getElementById('correction-text');
    const content = textarea.value.trim();
    const repoPath = "junloye/junloye.github.io";

    if (!token) {
        showNotification("未检测到有效 Token，请重新登录", "error");
        return;
    }

    if (!content) {
        textarea.style.borderColor = "var(--error)";
        setTimeout(() => textarea.style.borderColor = "", 1000);
        return;
    }

    const btnId = type === 'comment' ? 'submit-comment-btn' : 'submit-issue-btn';
    const btn = document.getElementById(btnId);
    const originalText = btn.innerText;
    
    btn.innerText = "SUBMITTING...";
    btn.disabled = true;

    try {
        let response;
        const headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        if (type === 'comment') {
            response = await fetch(`https://api.github.com/repos/${repoPath}/issues/${num}/comments`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ 
                    body: `### 🛠️ [FEEDBACK] 反馈建议\n\n> 来自网页端快速反馈提交：\n\n${content}` 
                })
            });
        } else {
            response = await fetch(`https://api.github.com/repos/${repoPath}/issues`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    title: `[FEEDBACK] ${title}`,
                    body: `## 🔍 反馈报告\n\n- **目标文章**: #${num} (${title})\n- **反馈来源**: 网页端快速反馈提交\n\n---\n\n### 💡 建议内容\n${content}`,
                    labels: ["FEEDBACK"]
                })
            });
        }

        if (response.ok) {
            document.getElementById('correction-modal').style.display = 'none';
            showSuccessToast(type === 'comment' ? "Comment successfully posted!" : "New Issue created!");
        } else {
            const errorData = await response.json();
            showNotification(`提交失败: ${errorData.message || '请检查 Token 权限'}`, "error");
        }
    } catch (e) {
        showNotification("网络请求出错，请检查网络连接", "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function showSuccessToast(message) {
    let toast = document.getElementById('success-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'success-toast';
        toast.className = 'success-toast';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> ${message}`;
    
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function closePost() {
    if (window.location.hash.startsWith('#post-')) history.back();
    else realClosePost();
}

function realClosePost() {
    const area = document.getElementById('detail-content-area');
    const overlay = document.getElementById('post-detail-overlay');
    if (!area || !area.classList.contains('show')) return;
    
    document.title = ORIGINAL_TITLE;
    area.classList.remove('show');
    
    setTimeout(() => {
        overlay.style.display = 'none'; 
        document.body.style.overflow = ''; 
    }, 300);
}

function redirectToEdit() {
    const hash = window.location.hash;
    if (hash.startsWith('#post-')) {
        const num = hash.replace('#post-', '');
        const repoUrl = "https://github.com/junloye/junloye.github.io";
        window.open(`${repoUrl}/issues/${num}`, '_blank');
    }
}