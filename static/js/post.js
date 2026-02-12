function openPost(num, pushState = true) {
    const issuesSource = (typeof allIssues !== 'undefined') ? allIssues : [];
    const issue = issuesSource.find(i => i.number === num);
    const area = document.getElementById('content-area');
    const overlay = document.getElementById('post-overlay');

    if (!issue || !area || !overlay) {
        console.error("Critical: DOM elements or Issue data missing.");
        return;
    }
    
    if (pushState) {
        history.pushState({ page: 'detail', id: num }, issue.title, `?post=${num}`);
    }
    document.title = `${issue.title} | `+CONFIG.owner;

    const defaultCover = (typeof CONFIG !== 'undefined' && CONFIG.defaultCover) 
        ? CONFIG.defaultCover 
        : 'https://github.githubassets.com/images/modules/open_graph/github-octocat.png';

    const coverMatch = issue.body?.match(/\[Cover\]\s*(http\S+)/);
    const cover = coverMatch ? coverMatch[1] : defaultCover;

    const hasArgueTag = issue.labels.some(l => l.name.toUpperCase() === '争议');
    let argueBannerHtml = "";
    if (hasArgueTag) {
        const username = (typeof CONFIG !== 'undefined') ? CONFIG.username : CONFIG.username;
        const repo = (typeof CONFIG !== 'undefined') ? CONFIG.repo : CONFIG.repo;
        const refRegex = new RegExp(`Ref:\\s*#${num}\\b`);
        const feedbackIssue = issuesSource.find(i => 
            i.labels.some(l => l.name === '反馈') && 
            refRegex.test(i.body || "")
        );

        const displayId = feedbackIssue ? feedbackIssue.number : num;
        const feedbackUrl = feedbackIssue 
            ? `https://github.com/${username}/${repo}/issues/${feedbackIssue.number}`
            : `https://github.com/${username}/${repo}/issues?q=${encodeURIComponent(`is:issue label:反馈 "Ref: #${num}"`)}`;

        argueBannerHtml = `
            <div class="argue-banner">
                <span class="argue-banner-icon">⚠️</span>
                <div class="argue-banner-text">
                    此文章内容可能存在争议。点击此处查看详情 
                    <a href="${feedbackUrl}" target="_blank" class="post-ref-link" data-num="${displayId}">#${displayId}</a>
                </div>
            </div>`;
    }

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

    let htmlContent = parseEnhancedMarkdown(cleanBody);

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
            <h1 style="font-size:2rem; margin:15px 0; font-weight:900;">${issue.title}</h1>
        </div>
        ${argueBannerHtml}
        <div id="post-body-content" class="markdown-body">${htmlContent}</div>
        <div id="reference-content">${referenceHtml}</div>
        
        <div class="comments-section">
            <h3 class="comments-title">Comments</h3>
            <div id="comment-form-area" class="comment-form"></div>
            <div id="comments-list" style="margin-top: 30px;">加载评论中...</div>
        </div>`;
    
    area.classList.remove('show');
    area.style.opacity = "0";
    area.style.transform = "translateY(20px)";

    const editBtn = document.getElementById('edit-post-btn');
    if (editBtn) {
        const username = (typeof CONFIG !== 'undefined') ? CONFIG.username : CONFIG.username;
        const repo = (typeof CONFIG !== 'undefined') ? CONFIG.repo : CONFIG.repo;
        editBtn.href = `https://github.com/${username}/${repo}/issues/new?template=feedback.yml&title=${encodeURIComponent(`[Feedback] ${issue.title}`)}&ref_id=${encodeURIComponent(`Ref: #${num}`)}`;
        editBtn.style.display = 'inline-block';
    }

    setTimeout(() => {
        area.style.transition = "all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)";
        area.style.opacity = "1";
        area.style.transform = "translateY(0)";
        area.classList.add('show');
        generateTOC();
        setupQuoteAction(num);
    }, 50);

    setTimeout(() => {
        setupReferenceHighlighting();
        initLinkPreview();
        loadComments(issue.title, issue.number);
    }, 400);

    const progressBar = document.getElementById('reading-progress');
    const overlayScroll = document.getElementById('post-overlay'); 
    if (progressBar && overlayScroll) {
        overlayScroll.onscroll = () => {
            const winScroll = overlayScroll.scrollTop;
            const height = overlayScroll.scrollHeight - overlayScroll.clientHeight;
            const scrolled = (winScroll / height) * 100;
            progressBar.style.width = scrolled + "%";
        };
    }
}

function setupQuoteAction(postNum) {
    const postBody = document.getElementById('post-body-content');
    if (!postBody) return;

    const targets = postBody.querySelectorAll('p, li, blockquote, pre');
    targets.forEach(el => {
        el.style.position = 'relative';
        el.classList.add('quotable-item');

        const quoteBtn = document.createElement('button');
        quoteBtn.className = 'quote-this-btn';
        quoteBtn.innerHTML = '引用';
        quoteBtn.title = '引用此段内容到评论';
        
        quoteBtn.onclick = () => {
            const text = el.innerText.replace('引用', '').trim();
            quoteToComment(text, postNum);
        };

        el.appendChild(quoteBtn);
    });
}

function quoteToComment(text, postNum) {
    const textarea = document.getElementById('comment-text');
    if (!textarea) {
        alert("请先登录 GitHub 以便进行评论引用");
        document.getElementById('comment-form-area').scrollIntoView({ behavior: 'smooth' });
        return;
    }

    const quoteText = `> ${text}\n> #${postNum}\n\n`;
    const currentText = textarea.value;
    
    textarea.value = currentText ? (currentText + "\n\n" + quoteText) : quoteText;
    
    updateCommentPreview();
    
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    textarea.focus();
}

function parseEnhancedMarkdown(rawMarkdown) {
    let content = rawMarkdown;
    content = content.replace(/\[(\d+)\]/g, '<a href="#ref-$1" class="ref-link">[$1]</a>');
    content = content.replace(/#(\d+)\b/g, '<a href="?post=$1" class="post-ref-link" data-num="$1">#$1</a>');

    let html = "";
    try {
        if (typeof marked !== 'undefined') {
            html = marked.parse(content);
            html = html.replace(/<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|AI)\]([\s\S]*?)<\/p>\s*<\/blockquote>/gi, (match, type, contentText) => {
                const t = type.toUpperCase();
                const title = t === 'AI' ? 'AI Generated' : t;
                return `<div class="markdown-alert markdown-alert-${t.toLowerCase()}"><p class="markdown-alert-title">${title}</p><div class="markdown-alert-content">${contentText.trim()}</div></div>`;
            });
        } else {
            html = `<pre style="white-space: pre-wrap;">${content}</pre>`;
        }
    } catch (e) {
        html = `<p>Markdown 解析错误</p>`;
    }
    return html;
}

async function loadComments(title, issueNum) {
    const list = document.getElementById('comments-list');
    try {
        const res = await fetch(`${WORKER_URL}?action=getComments&title=${encodeURIComponent(title)}`);
        const result = await res.json();
        
        if (result.error) throw new Error(result.error);

        const discussion = result.data?.search?.nodes[0];
        if (discussion) {
            window.currentDiscussionId = discussion.id;
            const comments = discussion.comments.nodes;
            
            list.innerHTML = comments.length ? comments.map(c => {
                let enhancedBody = c.bodyHTML;
                enhancedBody = enhancedBody.replace(/#(\d+)\b/g, '<a href="?post=$1" class="post-ref-link" data-num="$1">#$1</a>');
                enhancedBody = enhancedBody.replace(/\[(\d+)\]/g, '<a href="#ref-$1" class="ref-link">[$1]</a>');
                
                return `
                <div class="comment-item">
                    <img src="${c.author.avatarUrl}" class="comment-avatar">
                    <div class="comment-content">
                        <div class="comment-info"><strong>${c.author.login}</strong> <small>${new Date(c.createdAt).toLocaleString()}</small></div>
                        <div class="comment-body markdown-body">${enhancedBody}</div>
                    </div>
                </div>`;
            }).join('') : '<p class="empty-tip">还没有评论，快来抢沙发！</p>';
            
            initLinkPreview();
        } else {
            list.innerHTML = `<p class="empty-tip">暂无讨论。点击上方“发表评论”将自动在 GitHub 发起讨论并添加 #${issueNum} 指向。</p>`;
            window.currentDiscussionId = null;
        }
        renderCommentForm(title, issueNum);
    } catch (e) {
        list.innerHTML = `<p style="color:var(--accent)">评论加载失败。</p>`;
    }
}

function updateCommentPreview() {
    const textarea = document.getElementById('comment-text');
    const previewArea = document.getElementById('comment-preview');
    const previewContainer = document.getElementById('comment-preview-container');
    
    if (!textarea || !previewArea) return;
    
    const content = textarea.value.trim();
    if (content) {
        previewContainer.style.display = 'block';
        previewArea.innerHTML = parseEnhancedMarkdown(content);
        initLinkPreview();
    } else {
        previewContainer.style.display = 'none';
        previewArea.innerHTML = '';
    }
}

function renderCommentForm(title, issueNum) {
    const container = document.getElementById('comment-form-area');
    const token = localStorage.getItem('gh_access_token');
    const userLogin = localStorage.getItem('gh_user_login');
    const userAvatar = localStorage.getItem('gh_user_avatar');
    
    if (!token) {
        container.innerHTML = `
            <div style="text-align:center; padding: 20px; background:var(--line); border-radius:12px;">
                <p style="margin-bottom:15px; font-size:0.9rem;">登录 GitHub 参与讨论</p>
                <button onclick="loginGitHub()" class="login-btn">GitHub 登录</button>
            </div>`;
    } else {
        if (!userLogin) {
            fetchUserInfo(token).then(() => renderCommentForm(title, issueNum));
            return;
        }

        container.innerHTML = `
            <div class="current-user-info" style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                <img src="${userAvatar}" style="width:24px; height:24px; border-radius:50%; border:1px solid var(--line);">
                <span style="font-size:0.85rem; font-weight:600; color:var(--text-soft);">以 <span style="color:var(--text)">${userLogin}</span> 的身份评论</span>
            </div>
            
            <textarea id="comment-text" placeholder="撰写评论... (支持 Markdown)" oninput="updateCommentPreview()"></textarea>
            
            <div id="comment-preview-container" style="display:none; margin-top:15px; padding:15px; border:1px solid var(--line); border-radius:12px; background:var(--bg);">
                <div style="font-size:0.7rem; color:var(--accent); font-weight:800; text-transform:uppercase; margin-bottom:10px; letter-spacing:1px;">Preview</div>
                <div id="comment-preview" class="markdown-body" style="font-size:0.9rem;"></div>
            </div>

            <div class="form-actions" style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                <button onclick="submitComment('${title}', ${issueNum})" class="submit-btn">发表评论</button>
                <button onclick="logout()" class="logout-link" style="background:none; border:none; color:var(--text-soft); cursor:pointer; font-size:0.8rem;">注销登录</button>
            </div>`;
    }
}

async function fetchUserInfo(token) {
    try {
        const res = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('gh_user_login', data.login);
            localStorage.setItem('gh_user_avatar', data.avatar_url);
            return data;
        }
    } catch (e) {
        console.error("Failed to fetch user info", e);
    }
}

function loginGitHub() {
    const currentUrl = window.location.href;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=public_repo&redirect_uri=${encodeURIComponent(currentUrl)}`;
}

function logout() {
    localStorage.removeItem('gh_access_token');
    localStorage.removeItem('gh_user_login');
    localStorage.removeItem('gh_user_avatar');
    location.reload();
}

(async function handleAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        try {
            const res = await fetch(`${WORKER_URL}?action=login&code=${code}`);
            const data = await res.json();
            
            if (data.access_token) {
                localStorage.setItem('gh_access_token', data.access_token);
                await fetchUserInfo(data.access_token);
                urlParams.delete('code');
                const newQuery = urlParams.toString();
                const newUrl = window.location.pathname + (newQuery ? '?' + newQuery : '');
                window.history.replaceState({}, "", newUrl);
                location.reload();
            } else {
                throw new Error(data.error_description || data.error || "登录失败");
            }
        } catch (e) {
            console.error("Auth error:", e);
        }
    }
})();

async function submitComment(title, issueNum) {
    const body = document.getElementById('comment-text').value;
    const token = localStorage.getItem('gh_access_token');
    
    if (!body) return;
    if (!token) {
        alert("请先登录");
        return;
    }

    const btn = document.querySelector('.submit-btn');
    btn.disabled = true;
    btn.innerText = '发送中...';

    try {
        const res = await fetch(`${WORKER_URL}`, {
            method: 'POST',
            headers: { 
                'Authorization': token, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                action: 'postComment',
                title: title, 
                issueNum: issueNum, 
                body: body, 
                discussionId: window.currentDiscussionId,
                postUrl: window.location.href
            })
        });

        const result = await res.json();
        if (res.ok && !result.errors) {
            location.reload(); 
        } else {
            throw new Error(result.errors ? result.errors[0].message : "提交失败");
        }
    } catch (e) {
        alert("评论发表失败: " + e.message);
        btn.disabled = false;
        btn.innerText = '发表评论';
    }
}

function generateTOC() {
    const postBody = document.getElementById('post-body-content');
    const tocContainer = document.getElementById('post-toc');
    if (!postBody || !tocContainer) return;
    tocContainer.innerHTML = '';
    const headings = postBody.querySelectorAll('h1, h2, h3');
    if (headings.length === 0) {
        tocContainer.classList.remove('show');
        return;
    }
    const titleEl = document.createElement('div');
    titleEl.className = 'post-toc-title';
    titleEl.textContent = 'CONTENTS';
    tocContainer.appendChild(titleEl);
    headings.forEach((heading, index) => {
        const id = `heading-${index}`;
        heading.setAttribute('id', id);
        const link = document.createElement('a');
        link.href = `#${id}`;
        link.className = `toc-link toc-${heading.tagName.toLowerCase()}`;
        link.textContent = heading.textContent;
        link.onclick = (e) => {
            e.preventDefault();
            const overlay = document.getElementById('post-overlay');
            overlay.scrollTo({ top: heading.offsetTop - 20, behavior: 'smooth' });
        };
        tocContainer.appendChild(link);
    });
    tocContainer.classList.add('show');
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

function initLinkPreview() {
    let previewCard = document.getElementById('link-preview-card');
    if (!previewCard) {
        previewCard = document.createElement('div');
        previewCard.id = 'link-preview-card';
        document.body.appendChild(previewCard);
    }

    const links = document.querySelectorAll('.post-ref-link');
    const issuesSource = (typeof allIssues !== 'undefined') ? allIssues : [];

    links.forEach(link => {
        if (link.dataset.previewBound) return;
        link.dataset.previewBound = "true";

        link.onmouseenter = (e) => {
            const num = parseInt(link.getAttribute('data-num'));
            const targetIssue = issuesSource.find(i => i.number === num);
            
            if (targetIssue) {
                let rawExcerpt = "";
                const feedbackSummaryMatch = targetIssue.body?.match(/### 🔍 错误描述与建议\s*([\s\S]*?)(?=###|$)/);
                const contentMatch = targetIssue.body?.match(/\[Content\]\s*([\s\S]*?)(?=\[References\]|---|$)/);
                const summaryMatch = targetIssue.body?.match(/\[Summary\]\s*([\s\S]*?)(?=\[Content\]|---|$)/);
                
                if (feedbackSummaryMatch) {
                    rawExcerpt = feedbackSummaryMatch[1].trim().substring(0, 500);
                } else if (contentMatch && contentMatch[1].trim()) {
                    rawExcerpt = contentMatch[1].trim().substring(0, 800);
                } else if (summaryMatch) {
                    rawExcerpt = summaryMatch[1].trim();
                } else {
                    rawExcerpt = targetIssue.body?.substring(0, 200);
                }

                const renderedExcerpt = parseEnhancedMarkdown(rawExcerpt);

                const date = new Date(targetIssue.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
                const label = targetIssue.labels[0]?.name || 'MEMO';
                const avatar = targetIssue.user?.avatar_url || 'https://github.com/github.png';

                previewCard.innerHTML = `
                    <div class="preview-header">
                        <img src="${avatar}" class="preview-avatar">
                        <div class="preview-meta">
                            <span class="preview-author">${targetIssue.user?.login || 'Author'}</span>
                            <span class="preview-date">发布于 ${date}</span>
                        </div>
                    </div>
                    <div class="preview-title">${targetIssue.title}</div>
                    <div class="preview-excerpt markdown-body">${renderedExcerpt}</div>
                    <div class="preview-footer">
                        <span class="preview-label">${label}</span>
                    </div>
                `;

                previewCard.style.display = 'block';
                const rect = link.getBoundingClientRect();
                const cardHeight = previewCard.offsetHeight;
                
                let top = rect.top - cardHeight - 15;
                if (top < 10) top = rect.bottom + 15;
                
                let left = rect.left;
                if (left + 420 > window.innerWidth) left = window.innerWidth - 440;

                previewCard.style.top = `${top}px`;
                previewCard.style.left = `${left}px`;
                setTimeout(() => previewCard.classList.add('active'), 10);
            }
        };

        link.onmouseleave = () => {
            previewCard.classList.remove('active');
            setTimeout(() => {
                if (!previewCard.classList.contains('active')) previewCard.style.display = 'none';
            }, 200);
        };

        link.onclick = (e) => {
            const href = link.getAttribute('href');
            
            if (href && (href.includes('github.com') || href.startsWith('http'))) {
                return;
            }
            
            e.preventDefault();
            const num = parseInt(link.getAttribute('data-num'));
            if (!isNaN(num)) {
                previewCard.style.display = 'none';
                openPost(num);
            }
        };
    });
}

function closePost() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('post')) {
        history.pushState({}, "Blog |"+CONFIG.owner, window.location.pathname);
    }
    const area = document.getElementById('content-area');
    const overlay = document.getElementById('post-overlay');
    const progressBar = document.getElementById('reading-progress');
    const toc = document.getElementById('post-toc');
    const editBtn = document.getElementById('edit-post-btn');
    
    if (!area) return;
    document.title = "Blog |"+CONFIG.owner;
    area.classList.remove('show');
    area.style.opacity = "0";
    area.style.transform = "translateY(20px)";
    if (progressBar) progressBar.style.width = "0%";
    if (toc) toc.classList.remove('show');
    if (editBtn) editBtn.style.display = 'none';
    
    setTimeout(() => {
        if (overlay) overlay.style.display = 'none'; 
        document.body.style.overflow = ''; 
    }, 300);
}