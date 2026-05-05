async function ensureConfig() {
    if (typeof CONFIG === 'undefined' || !CONFIG || Object.keys(CONFIG).length === 0) {
        console.warn("CONFIG 缺失，正在调用 loadConfig()...");
        if (typeof loadConfig === 'function') {
            await loadConfig();
        } else {
            console.error("未找到 loadConfig 函数，无法加载配置。");
        }
    }
}

const GITHUB_SVG = `<svg height="20" viewBox="0 0 16 16" version="1.1" width="20" aria-hidden="true" style="fill: currentColor; vertical-align: middle; margin-right: 8px;"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path></svg>`;

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

    const owner = (typeof CONFIG !== 'undefined') ? CONFIG.owner : 'Blog';
    document.title = `${issue.title} | ` + owner;

    const defaultCover = (typeof CONFIG !== 'undefined' && CONFIG.defaultCover) 
        ? CONFIG.defaultCover 
        : 'https://github.githubassets.com/images/modules/open_graph/github-octocat.png';

    const coverMatch = issue.body?.match(/\[Cover\]\s*(http\S+)/);
    const cover = coverMatch ? coverMatch[1] : defaultCover;

    const hasArgueTag = issue.labels.some(l => l.name.toUpperCase() === '争议');
    let argueBannerHtml = "";
    if (hasArgueTag) {
        const username = (typeof CONFIG !== 'undefined') ? CONFIG.username : '';
        const repo = (typeof CONFIG !== 'undefined') ? CONFIG.repo : '';
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
    
    // 功能开关
    const features = CONFIG.features || {};
    const shareEnabled = features.share !== false; // 默认true
    const donationEnabled = features.donation !== false; // 默认true
    
    // 分享按钮HTML
    let shareButtonsHtml = '';
    if (shareEnabled) {
        shareButtonsHtml = `
            <!-- 分享按钮 -->
            <div class="share-buttons">
                <button class="share-btn weibo" onclick="shareToWeibo('${issue.title}', '${window.location.origin}?post=${num}')" title="分享到微博">
                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M20.194 3.46c-1.802.817-3.73 1.371-5.757 1.617a9.86 9.86 0 0 0 1.923-5.077 19.9 19.9 0 0 1-6.26 2.39A9.86 9.86 0 0 0 4.93 0C2.206 0 0 2.206 0 4.93c0 .77.17 1.5.47 2.17A9.826 9.826 0 0 1 1.35 4.68a9.86 9.86 0 0 0 3.18 8.23 9.78 9.78 0 0 1-4.45-1.23v.12c0 4.78 3.4 8.77 7.92 9.68-.83.22-1.7.34-2.6.34-.64 0-1.26-.06-1.86-.18a9.86 9.86 0 0 0 9.2 6.83 19.76 19.76 0 0 1-12.2 4.23c-.8 0-1.58-.05-2.35-.14A27.9 27.9 0 0 0 15.07 24c18.06 0 27.94-14.96 27.94-27.94 0-.43 0-.85-.03-1.27a19.9 19.9 0 0 0 4.88-5.07l-4.67-2.16z"/></svg>
                    微博
                </button>
                <button class="share-btn wechat" onclick="showWechatShare('${issue.title}', '${window.location.origin}?post=${num}')" title="微信分享">
                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M9.5 4C5.36 4 2 6.69 2 10c0 1.89 1.08 3.56 2.78 4.66L4 17l2.5-1.5c.61.22 1.26.34 1.94.34H12l2-2v-2c1.31-.83 2-2.18 2-3.5C16 6.69 12.64 4 9.5 4zm6 12v2l2.5 1.5 2.5-1.5v-2c1.39-.83 2-2.17 2-3.5C22 6.69 18.64 4 15.5 4S9 6.69 9 10c0 1.89 1.08 3.56 2.78 4.66L11 17l2.5-1.5c.61.22 1.26.34 1.94.34h1.56l.44.44z"/></svg>
                    微信
                </button>
                <button class="share-btn twitter" onclick="shareToTwitter('${issue.title}', '${window.location.origin}?post=${num}')" title="分享到Twitter">
                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/></svg>
                    Twitter
                </button>
                <button class="share-btn facebook" onclick="shareToFacebook('${window.location.origin}?post=${num}')" title="分享到Facebook">
                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m13 2h-2.5A3.5 3.5 0 0 0 12 8.5V11h-2v3h2v7h3v-7h3v-3h-3V9a1 1 0 0 1 1-1h2V5z"/></svg>
                    Facebook
                </button>
                <button class="share-btn copy-link" onclick="copyPostLink('${window.location.origin}?post=${num}')" title="复制链接">
                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                    复制链接
                </button>
            </div>`;
    }
    
    // 打赏部分HTML
    let donationSectionHtml = '';
    if (donationEnabled) {
        donationSectionHtml = `
        <!-- 打赏功能 -->
        <div class="donation-section" style="margin: 40px 0; padding: 25px; background: var(--line); border-radius: 12px; text-align: center;">
            <h3 style="margin-bottom: 15px; color: var(--text);">支持作者</h3>
            <p style="color: var(--text-soft); margin-bottom: 20px; font-size: 0.9rem;">如果这篇文章对您有帮助，欢迎打赏支持作者继续创作</p>
            
            <div class="donation-methods" style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; margin-bottom: 20px;">
                <div class="donation-method">
                    <div class="donation-qr" style="width: 150px; height: 150px; background: white; padding: 10px; border-radius: 8px; margin: 0 auto 10px;">
                        <img src="${typeof CONFIG !== 'undefined' && CONFIG.donation && CONFIG.donation.wechat_qr ? CONFIG.donation.wechat_qr : 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=wechat'}"
                             alt="微信支付" style="width: 100%; height: 100%;">
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text); margin-top: 8px;">微信支付</p>
                </div>
                
                <div class="donation-method">
                    <div class="donation-qr" style="width: 150px; height: 150px; background: white; padding: 10px; border-radius: 8px; margin: 0 auto 10px;">
                        <img src="${typeof CONFIG !== 'undefined' && CONFIG.donation && CONFIG.donation.alipay_qr ? CONFIG.donation.alipay_qr : 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=alipay'}"
                             alt="支付宝" style="width: 100%; height: 100%;">
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text); margin-top: 8px;">支付宝</p>
                </div>
            </div>
            
            <div class="donation-links" style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
                ${typeof CONFIG !== 'undefined' && CONFIG.donation && CONFIG.donation.paypal_url ? `
                <a href="${CONFIG.donation.paypal_url}" target="_blank" class="donation-link" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 15px; background: #0070ba; color: white; border-radius: 6px; text-decoration: none; font-size: 0.85rem;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.522 0-.97.382-1.052.9l-1.12 7.106zm15.147-7.83c-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.522 0-.97.382-1.052.9l-1.12 7.106H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287z"/></svg>
                    PayPal
                </a>
                ` : ''}
                
                ${typeof CONFIG !== 'undefined' && CONFIG.donation && CONFIG.donation.github_sponsors ? `
                <a href="${CONFIG.donation.github_sponsors}" target="_blank" class="donation-link" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 15px; background: #333; color: white; border-radius: 6px; text-decoration: none; font-size: 0.85rem;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2 0 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>
                    GitHub Sponsors
                </a>
                ` : ''}
            </div>
            
            ${typeof CONFIG !== 'undefined' && CONFIG.donation && CONFIG.donation.message ? `
            <p style="margin-top: 15px; font-size: 0.8rem; color: var(--text-soft); font-style: italic;">${CONFIG.donation.message}</p>
            ` : ''}
        </div>`;
    }
    
    overlay.style.display = 'block';
    overlay.scrollTop = 0;
    document.body.style.overflow = 'hidden';

    // 检查是否为反馈贴
    const isFeedback = issue.labels.some(l => l.name === '反馈');
    let feedbackCardHtml = '';
    let coverImgHtml = '';

    if (isFeedback) {
        // 获取作者名和创建时间
        const authorName = issue.user?.login || '匿名用户';
        const createDate = new Date(issue.created_at).toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        feedbackCardHtml = `
            <div class="feedback-banner">
                <div class="feedback-icon">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h10v2H7V9zm0 4h7v2H7v-2z"/>
                    </svg>
                </div>
                <div class="feedback-content">
                    <div class="feedback-title">反馈贴</div>
                    <div class="feedback-meta">作者：${authorName} ｜ 提交于：${createDate}</div>
                    <div class="feedback-notice">该内容为读者反馈或建议，请仔细甄别。</div>
                </div>
            </div>
        `;
        // 反馈贴：不显示封面
        coverImgHtml = '';
    } else {
        // 普通帖子：正常显示封面
        coverImgHtml = `<img src="${cover}" class="detail-hero-img" style="height: 280px; width: 100%; object-fit: cover; margin-bottom: 25px;" onerror="this.onerror=null; this.src='${defaultCover}';">`;
    }

    area.innerHTML = `
        ${coverImgHtml}${feedbackCardHtml}
        <div class="detail-header">
            <div style="display: flex; justify-content: space-between; align-items: center; color:var(--text-soft); font-size:0.85rem;">
                <span>${date}</span>
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    ${issue.labels.filter(label => label.name !== '反馈').map(label =>
                        `<span style="font-size:0.75rem; font-weight:700; color:var(--accent); background:var(--selection-bg); padding:2px 10px; border-radius:4px; white-space: nowrap;">${label.name}</span>`
                    ).join('') || '<span style="font-size:0.75rem; font-weight:700; color:var(--accent); background:var(--selection-bg); padding:2px 10px; border-radius:4px;">MEMO</span>'}
                </div>
            </div>
            <h1 style="font-size:2rem; margin:15px 0; font-weight:900;">${issue.title}</h1>
            
            ${shareButtonsHtml}
        </div>
        ${argueBannerHtml}
        <div id="post-body-content" class="markdown-body">${htmlContent}</div>
        <div id="reference-content">${referenceHtml}</div>
        
        <!-- 打赏功能 -->
        ${donationSectionHtml}
        
        <div class="comments-section">
            <h3 class="comments-title">评论</h3>
            <div id="comment-form-area" class="comment-form"></div>
            <div id="comments-list" style="margin-top: 30px;">加载评论中...</div>
        </div>`;
    
    area.classList.remove('show');
    area.style.opacity = "0";
    area.style.transform = "translateY(20px)";

    const editBtn = document.getElementById('edit-post-btn');
    if (editBtn) {
        const username = (typeof CONFIG !== 'undefined') ? CONFIG.username : '';
        const repo = (typeof CONFIG !== 'undefined') ? CONFIG.repo : '';
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
        showNotification("请先登录 GitHub 以启用评论功能", "error");
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
    if (!list) return;

    await ensureConfig();

    if (typeof CONFIG === 'undefined' || !CONFIG.worker_url) {
        list.innerHTML = `<p style="color:var(--accent)">评论功能未配置 (CONFIG.worker_url 缺失)。</p>`;
        renderCommentForm(title, issueNum);
        return;
    }

    try {
        const res = await fetch(`${CONFIG.worker_url}?action=getComments&title=${encodeURIComponent(title)}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const result = await res.json();
        if (result.error) throw new Error(result.error);

        const discussion = result.data?.search?.nodes?.[0];
        if (discussion) {
            window.currentDiscussionId = discussion.id;
            const comments = discussion.comments?.nodes || [];
            
            list.innerHTML = comments.length ? comments.map(c => {
                let enhancedBody = c.bodyHTML || "";
                enhancedBody = enhancedBody.replace(/#(\d+)\b/g, '<a href="?post=$1" class="post-ref-link" data-num="$1">#$1</a>');
                enhancedBody = enhancedBody.replace(/\[(\d+)\]/g, '<a href="#ref-$1" class="ref-link">[$1]</a>');
                
                return `
                <div class="comment-item">
                    <img src="${c.author?.avatarUrl || ''}" class="comment-avatar">
                    <div class="comment-content">
                        <div class="comment-info"><strong>${c.author?.login || 'Anonymous'}</strong> <small>${new Date(c.createdAt).toLocaleString()}</small></div>
                        <div class="comment-body markdown-body">${enhancedBody}</div>
                    </div>
                </div>`;
            }).join('') : '<p class="empty-tip">还没有评论，快来抢沙发！</p>';
            
            initLinkPreview();
        } else {
            list.innerHTML = `<p class="empty-tip">本文章暂无讨论</p>`;
            window.currentDiscussionId = null;
        }
    } catch (e) {
        console.error("Comments load error:", e);
        list.innerHTML = `<p style="color:var(--accent)">评论加载失败，请稍后再试。</p>`;
    } finally {
        renderCommentForm(title, issueNum);
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

async function renderCommentForm(title, issueNum) {
    const container = document.getElementById('comment-form-area');
    if (!container) return;

    const token = localStorage.getItem('gh_access_token');
    const userLogin = localStorage.getItem('gh_user_login');
    const userAvatar = localStorage.getItem('gh_user_avatar');
    
    if (!token) {
        container.innerHTML = `
            <div style="text-align:center; padding: 25px; background:var(--line); border-radius:12px;">
                <p style="margin-bottom:15px; font-size:0.9rem; color:var(--text-soft);">登录 GitHub 参与讨论</p>
                <button onclick="loginGitHub()" class="login-btn" style="display:inline-flex; align-items:center; justify-content:center;">
                    ${GITHUB_SVG} 使用 GitHub 登录
                </button>
            </div>`;
    } else {
        if (!userLogin) {
            // 这里改为 await 确保获取成功后再渲染
            const userInfo = await fetchUserInfo(token);
            if (!userInfo) {
                // 如果 Token 失效，重置
                localStorage.removeItem('gh_access_token');
                renderCommentForm(title, issueNum);
                return;
            }
            renderCommentForm(title, issueNum);
            return;
        }

        container.innerHTML = `
            <div class="current-user-info" style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                <img src="${userAvatar}" style="width:24px; height:24px; border-radius:50%; border:1px solid var(--line);">
                <span style="font-size:0.85rem; font-weight:600; color:var(--text-soft); display:inline-flex; align-items:center;">
                    ${GITHUB_SVG} 以 <span style="color:var(--text); margin-left:4px;">${userLogin}</span> 的身份评论
                </span>
            </div>
            
            <textarea id="comment-text" placeholder="撰写评论... (支持 Markdown)" oninput="updateCommentPreview()"></textarea>
            
            <div id="comment-preview-container" style="display:none; margin-top:15px; padding:15px; border:1px solid var(--line); border-radius:12px; background:var(--bg);">
                <div style="font-size:0.7rem; color:var(--accent); font-weight:800; text-transform:uppercase; margin-bottom:10px; letter-spacing:1px;">Preview</div>
                <div id="comment-preview" class="markdown-body" style="font-size:0.9rem;"></div>
            </div>

            <div class="form-actions" style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                <button onclick="submitComment('${title.replace(/'/g, "\\'")}', ${issueNum})" class="submit-btn">发表评论</button>
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
    return null;
}

async function loginGitHub() {
    await ensureConfig();
    if (typeof CONFIG === 'undefined' || typeof CONFIG.client_id === 'undefined') {
        alert("CONFIG.client_id 未配置");
        return;
    }
    const currentUrl = window.location.href;
    // 强制清理旧 code
    const cleanUrl = currentUrl.split('&code=')[0].split('?code=')[0];
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${CONFIG.client_id}&scope=public_repo&redirect_uri=${encodeURIComponent(cleanUrl)}`;
}

function logout() {
    localStorage.removeItem('gh_access_token');
    localStorage.removeItem('gh_user_login');
    localStorage.removeItem('gh_user_avatar');
    location.reload();
}

// 核心修复：显式调用的初始化函数
async function handleAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        console.log("检测到登录 Code，正在处理...");
        await ensureConfig();
        
        if (typeof CONFIG !== 'undefined' && CONFIG.worker_url) {
            try {
                const res = await fetch(`${CONFIG.worker_url}?action=login&code=${code}`);
                const data = await res.json();
                
                if (data.access_token) {
                    console.log("Token 获取成功，正在拉取用户信息...");
                    localStorage.setItem('gh_access_token', data.access_token);
                    await fetchUserInfo(data.access_token);
                    
                    // 清理 URL 
                    urlParams.delete('code');
                    const newQuery = urlParams.toString();
                    const newUrl = window.location.pathname + (newQuery ? '?' + newQuery : '');
                    window.history.replaceState({}, "", newUrl);
                    
                    console.log("登录成功，准备刷新页面");
                    location.reload();
                } else {
                    throw new Error(data.error_description || data.error || "登录失败");
                }
            } catch (e) {
                console.error("Auth error:", e);
                alert("登录验证失败，请检查 Worker 配置。");
            }
        } else {
            console.error("无法处理登录：Worker URL 未配置。");
        }
    }
}

// 页面加载后立即启动处理逻辑
window.addEventListener('DOMContentLoaded', () => {
    handleAuthCallback();
});

async function submitComment(title, issueNum) {
    const body = document.getElementById('comment-text').value;
    const token = localStorage.getItem('gh_access_token');
    
    if (!body) return;
    if (!token) {
        alert("请先登录");
        return;
    }

    await ensureConfig();
    const btn = document.querySelector('.submit-btn');
    btn.disabled = true;
    btn.innerText = '发送中...';

    try {
        const res = await fetch(`${CONFIG.worker_url}`, {
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
    const owner = (typeof CONFIG !== 'undefined') ? CONFIG.owner : 'Blog';
    if (urlParams.has('post')) {
        history.pushState({}, "Blog |" + owner, window.location.pathname);
    }
    const area = document.getElementById('content-area');
    const overlay = document.getElementById('post-overlay');
    const progressBar = document.getElementById('reading-progress');
    const toc = document.getElementById('post-toc');
    const editBtn = document.getElementById('edit-post-btn');
    
    if (!area) return;
    document.title = "Blog |" + owner;
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

// 分享功能函数
function shareToWeibo(title, url) {
    const shareUrl = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
}

function showWechatShare(title, url) {
    // 创建微信分享弹窗
    const modal = document.createElement('div');
    modal.className = 'wechat-share-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 10px; text-align: center; max-width: 300px;">
            <h3 style="margin-bottom: 15px;">微信分享</h3>
            <p style="margin-bottom: 15px; color: #666;">请使用微信扫描二维码分享</p>
            <div id="wechat-qrcode" style="margin: 20px auto; width: 200px; height: 200px; background: #f5f5f5; display: flex; align-items: center; justify-content: center;">
                <p>二维码生成中...</p>
            </div>
            <p style="font-size: 12px; color: #999; margin-bottom: 15px;">或复制链接：${url}</p>
            <button onclick="this.parentElement.parentElement.remove()" style="padding: 8px 20px; background: #07c160; color: white; border: none; border-radius: 5px; cursor: pointer;">关闭</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 使用第三方服务生成二维码（这里使用 qrserver.com）
    const qrcodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    const qrcodeDiv = document.getElementById('wechat-qrcode');
    qrcodeDiv.innerHTML = `<img src="${qrcodeUrl}" alt="微信分享二维码" style="width: 100%; height: 100%;">`;
    
    // 点击背景关闭
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
}

function shareToTwitter(title, url) {
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
}

function shareToFacebook(url) {
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
}

function copyPostLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        // 显示成功提示
        showNotification('链接已复制到剪贴板', 'success');
    }).catch(err => {
        console.error('复制失败:', err);
        showNotification('复制失败，请手动复制', 'error');
    });
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        border-radius: 5px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}