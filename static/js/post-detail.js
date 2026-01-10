function openPost(num, pushState = true) {
    // 1. 获取基础数据
    const issuesSource = (typeof allIssues !== 'undefined') ? allIssues : [];
    const issue = issuesSource.find(i => i.number === num);
    const area = document.getElementById('detail-content-area');
    const overlay = document.getElementById('post-detail-overlay');

    if (!issue || !area || !overlay) {
        console.error("Critical: DOM elements or Issue data missing.");
        return;
    }
    
    if (pushState) {
        history.pushState({ page: 'detail', id: num }, issue.title, `#post-${num}`);
    }
    document.title = `${issue.title} | Jun Loye`;

    const defaultCover = (typeof CONFIG !== 'undefined' && CONFIG.defaultCover) 
        ? CONFIG.defaultCover 
        : 'https://github.githubassets.com/images/modules/open_graph/github-octocat.png';
    const coverMatch = issue.body?.match(/### 🖼️ 封面图链接\s*(http\S+)/);
    const cover = coverMatch ? coverMatch[1] : defaultCover;

    let cleanBody = (issue.body || "")
                              .replace(/### 🖼️ 封面图链接[\s\S]*?(?=\n---|###|$)/, "")
                              .replace(/### 📖 文章简述[\s\S]*?(?=\n---|###|$)/, "")
                              .replace(/🚀 正文内容|📄 正文内容/g, "")
                              .replace(/💡 发布核对[\s\S]*/, "")
                              .replace(/^\s*---\s*/gm, "").trim();

    let htmlContent = "";
    try {
        if (typeof marked !== 'undefined') {
            htmlContent = marked.parse(cleanBody);
            htmlContent = htmlContent.replace(/<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|AI)\]([\s\S]*?)<\/p>\s*<\/blockquote>/gi, (match, type, content) => {
                const t = type.toUpperCase();
                return `<div class="markdown-alert markdown-alert-${t.toLowerCase()}"><p class="markdown-alert-title">${t === 'AI' ? 'AI Generated' : t}</p><div class="markdown-alert-content">${content.trim()}</div></div>`;
            });
        } else {
            htmlContent = `<pre style="white-space: pre-wrap;">${cleanBody}</pre>`;
        }
    } catch (e) {
        htmlContent = `<p>Markdown parse error.</p>`;
    }

    const date = new Date(issue.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    
    overlay.style.display = 'block'; 
    document.body.style.overflow = 'hidden';

    area.innerHTML = `
        <img src="${cover}" class="detail-hero-img" style="height: 280px; width: 100%; object-fit: cover; margin-bottom: 25px;" onerror="this.onerror=null; this.src='${defaultCover}';">
        <div class="detail-header">
            <div style="display: flex; justify-content: space-between; align-items: center; color:var(--text-soft); font-size:0.85rem;">
                <span>${date}</span>
                <span style="font-size:0.75rem; font-weight:700; color:var(--accent); background:var(--selection-bg); padding:2px 10px; border-radius:4px;">${issue.labels[0]?.name || 'MEMO'}</span>
            </div>
            <h1 style="font-size:2rem; margin:15px 0 15px 0; font-weight:900;">${issue.title}</h1>
        </div>
        <div class="markdown-body">${htmlContent}</div>
        <div id="comments-wrapper" class="comments-section" style="display:none;">
            <div class="comments-header">💬 评论</div>
            
            <div id="quick-reply-area" style="margin-bottom: 40px; display: none;">
                <div style="display: flex; gap: 15px;">
                    <img id="reply-user-avatar" src="" style="width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line);">
                    <div style="flex: 1;">
                        <textarea id="quick-reply-text" placeholder="以此账号发表评论..." style="width: 100%; height: 100px; padding: 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--text); outline: none; font-family: inherit; resize: vertical;"></textarea>
                        <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                            <button id="submit-quick-reply-btn" style="padding: 8px 20px; border-radius: 8px; background: var(--accent); color: white; border: none; font-weight: 600; cursor: pointer;">发表评论</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="comments-list"></div>
        </div>`;
    
    area.classList.remove('show');
    area.style.opacity = "0";
    area.style.transform = "translateY(20px)";

    const editBtn = document.getElementById('edit-post-btn');
    if (editBtn) {
        editBtn.style.display = 'flex';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            showCorrectionModal(num, issue.title);
        };
    }

    setTimeout(() => {
        area.style.transition = "all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)";
        area.style.opacity = "1";
        area.style.transform = "translateY(0)";
        area.classList.add('show');
    }, 50);

    setupReplyArea(num);
    fetchComments(num);
}

async function setupReplyArea(num) {
    const replyArea = document.getElementById('quick-reply-area');
    const avatarImg = document.getElementById('reply-user-avatar');
    const submitBtn = document.getElementById('submit-quick-reply-btn');
    const token = getGithubToken();

    if (!token || !replyArea) return;

    try {
        const res = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${token}` }
        });
        if (res.ok) {
            const userData = await res.json();
            avatarImg.src = userData.avatar_url;
            replyArea.style.display = 'block';
            
            submitBtn.onclick = async () => {
                const text = document.getElementById('quick-reply-text').value.trim();
                if (!text) return;

                submitBtn.innerText = "发送中...";
                submitBtn.disabled = true;

                const success = await postComment(num, text);
                if (success) {
                    document.getElementById('quick-reply-text').value = '';
                    showSuccessToast("评论已发布！");
                    fetchComments(num);
                }
                
                submitBtn.innerText = "发表评论";
                submitBtn.disabled = false;
            };
        }
    } catch (e) {
        console.error("Failed to fetch user for comments", e);
    }
}

async function postComment(num, content) {
    const token = getGithubToken();
    const username = (typeof CONFIG !== 'undefined') ? CONFIG.username : 'JunLoye';
    const repo = (typeof CONFIG !== 'undefined') ? CONFIG.repo : 'junloye.github.io';

    try {
        const res = await fetch(`https://api.github.com/repos/${username}/${repo}/issues/${num}/comments`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ body: content })
        });
        return res.ok;
    } catch (e) {
        console.error(e);
        return false;
    }
}

async function fetchComments(num) {
    const wrapper = document.getElementById('comments-wrapper');
    const list = document.getElementById('comments-list');
    if (!wrapper || !list) return;

    wrapper.style.display = 'block';
    
    if (list.innerHTML === "") {
        list.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-soft); font-size:0.9rem;">正在拉取评论...</div>`;
    }

    try {
        const username = (typeof CONFIG !== 'undefined') ? CONFIG.username : 'JunLoye';
        const repo = (typeof CONFIG !== 'undefined') ? CONFIG.repo : 'junloye.github.io';
        
        const res = await fetch(`https://api.github.com/repos/${username}/${repo}/issues/${num}/comments`);
        if (!res.ok) throw new Error("GitHub API unreachable");
        
        const comments = await res.json();
        
        if (comments.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-soft); font-size:0.85rem;">暂无评论。</div>`;
            return;
        }

        list.innerHTML = comments.map(c => {
            const cDate = new Date(c.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            let content = (typeof marked !== 'undefined') ? marked.parse(c.body) : c.body;
            
            const isFeedback = c.body.includes('### 🛠️ 快速反馈');
            const displayContent = isFeedback ? content.replace('### 🛠️ 快速反馈', '<span style="font-size:0.7rem; background:var(--accent); color:white; padding:2px 6px; border-radius:4px; margin-bottom:10px; display:inline-block;">FEEDBACK</span>') : content;

            return `
                <div class="comment-item" style="margin-bottom: 25px; display: flex; gap: 12px; animation: fadeIn 0.4s ease;">
                    <img src="${c.user.avatar_url}" style="width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line);">
                    <div style="flex: 1;">
                        <div style="font-size: 0.8rem; margin-bottom: 4px;">
                            <span style="font-weight: 700; color: var(--text);">${c.user.login}</span>
                            <span style="color: var(--text-soft); margin-left: 8px;">${cDate}</span>
                        </div>
                        <div class="markdown-body comment-body" style="font-size: 0.9rem; background: var(--line); padding: 12px 15px; border-radius: 10px; color: var(--text);">
                            ${displayContent}
                        </div>
                    </div>
                </div>`;
        }).join('');
    } catch (e) {
        list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-soft);">评论加载失败</div>`;
    }
}

function getGithubToken() {
    const name = "github_token=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(name) === 0) return decodeURIComponent(c.substring(name.length, c.length));
    }
    return "";
}

function showCorrectionModal(num, title) {
    const modal = document.getElementById('correction-modal');
    const textarea = document.getElementById('correction-text');
    if (!modal || !textarea) return;

    modal.style.display = 'flex';
    textarea.value = '';
    
    const token = getGithubToken();
    const cBtn = document.getElementById('submit-comment-btn');
    const iBtn = document.getElementById('submit-issue-btn');

    if (!token) {
        textarea.disabled = true;
        textarea.placeholder = "请先登录 GitHub 后再提交反馈...";
        if(cBtn) cBtn.style.opacity = "0.4";
        if(iBtn) iBtn.style.opacity = "0.4";
    } else {
        textarea.disabled = false;
        textarea.placeholder = "发现错别字或有建议？请告诉我们...";
        if(cBtn) cBtn.style.opacity = "1";
        if(iBtn) iBtn.style.opacity = "1";
    }

    if (cBtn) cBtn.onclick = () => submitCorrection(num, title, 'comment');
    if (iBtn) iBtn.onclick = () => submitCorrection(num, title, 'issue');
    document.getElementById('cancel-modal-btn').onclick = () => modal.style.display = 'none';
}

async function submitCorrection(num, title, type) {
    const token = getGithubToken();
    const text = document.getElementById('correction-text').value.trim();
    if (!token || !text) return;

    const btn = document.getElementById(type === 'comment' ? 'submit-comment-btn' : 'submit-issue-btn');
    const originalText = btn.innerText;
    btn.innerText = "SUBMITTING...";
    btn.disabled = true;

    try {
        const username = (typeof CONFIG !== 'undefined') ? CONFIG.username : 'JunLoye';
        const repo = (typeof CONFIG !== 'undefined') ? CONFIG.repo : 'junloye.github.io';
        const headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
        
        let url = `https://api.github.com/repos/${username}/${repo}/issues`;
        let body = {};
        if (type === 'comment') {
            url += `/${num}/comments`;
            body = { body: `### 🛠️ 快速反馈\n\n${text}` };
        } else {
            // 在提交新 Issue 时增加 assignees 字段，分配给 JunLoye
            body = { 
                title: `[FEEDBACK] ${title}`, 
                body: text, 
                labels: ["FEEDBACK"],
                assignees: ["JunLoye"] 
            };
        }

        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        if (res.ok) {
            document.getElementById('correction-modal').style.display = 'none';
            showSuccessToast("提交成功！");
            if (type === 'comment') fetchComments(num);
        }
    } catch (e) {
        console.error(e);
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
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function closePost() {
    if (window.location.hash.startsWith('#post-')) history.back();
    else realClosePost();
}

function realClosePost() {
    const area = document.getElementById('detail-content-area');
    const overlay = document.getElementById('post-detail-overlay');
    if (!area || !area.classList.contains('show')) return;
    
    document.title = (typeof ORIGINAL_TITLE !== 'undefined') ? ORIGINAL_TITLE : "Jun Loye";
    area.classList.remove('show');
    area.style.opacity = "0";
    area.style.transform = "translateY(20px)";
    
    setTimeout(() => {
        if (overlay) overlay.style.display = 'none'; 
        document.body.style.overflow = ''; 
    }, 300);
}