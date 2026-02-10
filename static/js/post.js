function openPost(num, pushState = true) {
    const issuesSource = (typeof allIssues !== 'undefined') ? allIssues : [];
    const issue = issuesSource.find(i => i.number === num);
    const area = document.getElementById('content-area');
    const overlay = document.getElementById('post-overlay');

    if (!issue || !area || !overlay) {
        console.error("Critical: DOM elements or Issue data missing.");
        return;
    }
    
    // 修改：使用美化的路径 /post/num
    if (pushState) {
        history.pushState({ page: 'detail', id: num }, issue.title, `/post/${num}`);
    }
    document.title = `${issue.title} | Jun Loye`;

    const defaultCover = (typeof CONFIG !== 'undefined' && CONFIG.defaultCover) 
        ? CONFIG.defaultCover 
        : 'https://github.githubassets.com/images/modules/open_graph/github-octocat.png';

    const coverMatch = issue.body?.match(/\[Cover\]\s*(http\S+)/);
    const cover = coverMatch ? coverMatch[1] : defaultCover;

    const hasArgue = issue.labels.some(l => l.name.toLowerCase() === 'argue');
    const argueBannerHtml = hasArgue ? `
        <div class="argue-banner">
            <span class="argue-banner-icon">⚠️</span>
            <div class="argue-banner-text">
                <strong>内容审议中</strong><br>
                此文章已收到反馈，部分内容可能正在修正或存在争议，请谨慎参考。
            </div>
        </div>
    ` : '';

    const refMatch = issue.body?.match(/\[References\]([\s\S]*?)(?=\[Content\]|---|$)/);
    const referenceRaw = refMatch ? refMatch[1].trim() : "";
    let referenceHtml = "";

    if (referenceRaw) {
        const refLines = referenceRaw.split('\n').filter(line => line.trim() !== "");
        const formattedRefs = refLines.map((line, index) => {
            const refId = index + 1;
            const content = typeof marked !== 'undefined' ? marked.parse(line) : line;
            return `<div id="ref-${refId}" class="reference-item">${content}</div>`;
        }).join('');

        referenceHtml = `
            <div class="post-references">
                <h3 class="references-title">References</h3>
                <div class="references-list">${formattedRefs}</div>
            </div>`;
    }

    let bodyRaw = (issue.body || "");
    let cleanBody = bodyRaw
        .replace(/\[Cover\]\s*http\S*/g, "")
        .replace(/\[Summary\][\s\S]*?(?=\[Content\]|---|$)/, "")
        .replace(/\[References\][\s\S]*?(?=\[Content\]|---|$)/, "")
        .replace(/\[Content\]/g, "")
        .replace(/^\s*---\s*/gm, "")
        .trim();

    cleanBody = cleanBody.replace(/\[(\d+)\]/g, '<a href="#ref-$1" class="ref-link">[$1]</a>');

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
        ${argueBannerHtml}
        <img src="${cover}" class="detail-hero-img" style="height: 280px; width: 100%; object-fit: cover; margin-bottom: 25px;" onerror="this.onerror=null; this.src='${defaultCover}';">
        <div class="detail-header">
            <div style="display: flex; justify-content: space-between; align-items: center; color:var(--text-soft); font-size:0.85rem;">
                <span>${date}</span>
                <span style="font-size:0.75rem; font-weight:700; color:var(--accent); background:var(--selection-bg); padding:2px 10px; border-radius:4px;">${issue.labels[0]?.name || 'MEMO'}</span>
            </div>
            <h1 style="font-size:2rem; margin:15px 0 15px 0; font-weight:900;">${issue.title}</h1>
        </div>
        <div class="markdown-body">${htmlContent}</div>
        ${referenceHtml} 
        <div id="comments-wrapper" class="comments-section" style="display:none;">
            <div class="comments-header">💬 Comments</div>
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
    setupReferenceHighlighting(); 
}

function setupReferenceHighlighting() {
    const handleHash = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#ref-')) {
            document.querySelectorAll('.reference-item').forEach(el => el.classList.remove('highlight'));
            const target = document.querySelector(hash);
            if (target) {
                target.classList.add('highlight');
                setTimeout(() => target.classList.remove('highlight'), 3000);
            }
        }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
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
    } catch (e) { console.error(e); }
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
    } catch (e) { return false; }
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
        const comments = await res.json();
        if (comments.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-soft); font-size:0.85rem;">暂无评论</div>`;
            return;
        }
        list.innerHTML = comments.map(c => {
            const cDate = new Date(c.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            let content = (typeof marked !== 'undefined') ? marked.parse(c.body) : c.body;
            const isFeedback = c.body.includes('### [Feedback]');
            const displayContent = isFeedback ? content.replace('### [Feedback]', '<span style="font-size:0.7rem; background:var(--accent); color:white; padding:2px 6px; border-radius:4px; margin-bottom:10px; display:inline-block;">FEEDBACK</span>') : content;
            return `
                <div class="comment-item" style="margin-bottom: 25px; display: flex; gap: 12px; animation: fadeIn 0.4s ease;">
                    <img src="${c.user.avatar_url}" style="width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line);">
                    <div style="flex: 1;">
                        <div style="font-size: 0.8rem; margin-bottom: 4px;">
                            <span style="font-weight: 700; color: var(--text);">${c.user.login}</span>
                            <span style="color: var(--text-soft); margin-left: 8px;">${cDate}</span>
                        </div>
                        <div class="markdown-body comment-body" style="font-size: 0.9rem; background: var(--line); padding: 12px 15px; border-radius: 10px; color: var(--text);">${displayContent}</div>
                    </div>
                </div>`;
        }).join('');
    } catch (e) { list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-soft);">评论加载失败</div>`; }
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
    const token = getGithubToken(), text = document.getElementById('correction-text').value.trim();
    if (!token || !text) return;
    const btn = document.getElementById(type === 'comment' ? 'submit-comment-btn' : 'submit-issue-btn');
    const originalText = btn.innerText;
    btn.innerText = "SUBMITTING...";
    btn.disabled = true;
    try {
        const username = (typeof CONFIG !== 'undefined') ? CONFIG.username : 'JunLoye', repo = (typeof CONFIG !== 'undefined') ? CONFIG.repo : 'junloye.github.io';
        let url = `https://api.github.com/repos/${username}/${repo}/issues`;
        let bodyContent = {};
        if (type === 'comment') {
            url += `/${num}/comments`;
            bodyContent = { body: `### [Feedback]\n\n${text}` };
        } else {
            bodyContent = { title: `[Feedback] ${title}`, body: `Ref: #${num}\n\n---\n\n${text}`, labels: ["FEEDBACK"] };
        }
        const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }, body: JSON.stringify(bodyContent) });
        if (res.ok) {
            document.getElementById('correction-modal').style.display = 'none';
            showSuccessToast("提交成功！");
            if (type === 'comment') fetchComments(num);
        }
    } catch (e) { alert("提交失败"); } finally { btn.innerText = originalText; btn.disabled = false; }
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
    // 修改：如果当前在 /post/ID 路径下，关闭时需返回首页
    if (window.location.pathname.includes('/post/')) {
        history.pushState({}, "Blog | Jun Loye", "/");
        realClosePost();
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('post')) {
            history.back();
        } else {
            realClosePost();
        }
    }
}

function realClosePost() {
    const area = document.getElementById('content-area');
    const overlay = document.getElementById('post-overlay');
    if (!area || !area.classList.contains('show')) return;
    document.title = "Blog | Jun Loye";
    area.classList.remove('show');
    area.style.opacity = "0";
    area.style.transform = "translateY(20px)";
    setTimeout(() => {
        if (overlay) overlay.style.display = 'none'; 
        document.body.style.overflow = ''; 
    }, 300);
}