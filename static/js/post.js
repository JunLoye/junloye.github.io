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
    document.title = `${issue.title} | Jun Loye`;

    const defaultCover = (typeof CONFIG !== 'undefined' && CONFIG.defaultCover) 
        ? CONFIG.defaultCover 
        : 'https://github.githubassets.com/images/modules/open_graph/github-octocat.png';

    const coverMatch = issue.body?.match(/\[Cover\]\s*(http\S+)/);
    const cover = coverMatch ? coverMatch[1] : defaultCover;

    const hasArgueTag = issue.labels.some(l => l.name.toUpperCase() === 'ARGUE');
    let argueBannerHtml = "";
    if (hasArgueTag) {
        const refRegex = new RegExp(`Ref:\\s*#${num}\\b`);
        const feedbackIssue = issuesSource.find(i => 
            i.labels.some(l => l.name === 'Feedback') && 
            refRegex.test(i.body || "")
        );

        const username = (typeof CONFIG !== 'undefined') ? CONFIG.username : 'JunLoye';
        const repo = (typeof CONFIG !== 'undefined') ? CONFIG.repo : 'junloye.github.io';
        
        const displayId = feedbackIssue ? feedbackIssue.number : num;
        const feedbackUrl = feedbackIssue 
            ? `https://github.com/${username}/${repo}/issues/${feedbackIssue.number}`
            : `https://github.com/${username}/${repo}/issues?q=${encodeURIComponent(`is:issue label:Feedback "Ref: #${num}"`)}`;

        argueBannerHtml = `
            <div class="argue-banner">
                <span class="argue-banner-icon">⚠️</span>
                <div class="argue-banner-text">
                    此文章内容可能存在争议。点击此处查看纠错详情 
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

    cleanBody = cleanBody.replace(/\[(\d+)\]/g, '<a href="#ref-$1" class="ref-link">[$1]</a>');
    cleanBody = cleanBody.replace(/#(\d+)\b/g, '<a href="?post=$1" class="post-ref-link" data-num="$1">#$1</a>');

    let htmlContent = "";
    try {
        if (typeof marked !== 'undefined') {
            htmlContent = marked.parse(cleanBody);
            htmlContent = htmlContent.replace(/<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|AI)\]([\s\S]*?)<\/p>\s*<\/blockquote>/gi, (match, type, content) => {
                const t = type.toUpperCase();
                const title = t === 'AI' ? 'AI Generated' : t;
                return `<div class="markdown-alert markdown-alert-${t.toLowerCase()}"><p class="markdown-alert-title">${title}</p><div class="markdown-alert-content">${content.trim()}</div></div>`;
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

    // 重点：在这里确保 HTML 被注入
    area.innerHTML = `
        <img src="${cover}" class="detail-hero-img" style="height: 280px; width: 100%; object-fit: cover; margin-bottom: 25px;" onerror="this.onerror=null; this.src='${defaultCover}';">
        <div class="detail-header">
            <div style="display: flex; justify-content: space-between; align-items: center; color:var(--text-soft); font-size:0.85rem;">
                <span>${date}</span>
                <span style="font-size:0.75rem; font-weight:700; color:var(--accent); background:var(--selection-bg); padding:2px 10px; border-radius:4px;">${issue.labels[0]?.name || 'MEMO'}</span>
            </div>
            <h1 style="font-size:2rem; margin:15px 0 15px 0; font-weight:900;">${issue.title}</h1>
        </div>
        ${argueBannerHtml}
        <div id="post-body-content" class="markdown-body">${htmlContent}</div>
        <div id="reference-content">${referenceHtml}</div>
        <div class="comments-section">
            <h3 class="comments-title">Comments</h3>
            <div id="waline-container"></div>
        </div>`;
    
    area.classList.remove('show');
    area.style.opacity = "0";
    area.style.transform = "translateY(20px)";

    const editBtn = document.getElementById('edit-post-btn');
    if (editBtn) {
        const username = (typeof CONFIG !== 'undefined') ? CONFIG.username : 'JunLoye';
        const repo = (typeof CONFIG !== 'undefined') ? CONFIG.repo : 'junloye.github.io';
        const issueTitle = encodeURIComponent(`[Feedback] ${issue.title}`);
        const templateFile = "feedback.yml"; 
        const refValue = encodeURIComponent(`Ref: #${num}`);
        editBtn.href = `https://github.com/${username}/${repo}/issues/new?template=${templateFile}&title=${issueTitle}&ref_id=${refValue}`;
        editBtn.style.display = 'inline-block';
    }

    // 动画展示
    setTimeout(() => {
        area.style.transition = "all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)";
        area.style.opacity = "1";
        area.style.transform = "translateY(0)";
        area.classList.add('show');
        generateTOC();
    }, 50);

    // 确保 DOM 稳定后再加载评论系统，修复 Container not found 报错
    setTimeout(() => {
        loadComments(num); 
        setupReferenceHighlighting();
        initLinkPreview();
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

function loadComments(num) {
    const container = document.getElementById('waline-container');
    
    // 如果脚本还没加载好，或者容器还没渲染出来，则重试一次
    if (!container || typeof Waline === 'undefined') {
        console.warn("Waline container not found or Waline script not loaded. Retrying in 500ms...");
        setTimeout(() => loadComments(num), 500);
        return;
    }

    // ⚠️ 请务必在此处填入你真实的 Vercel 部署地址
    const serverURL = 'https://your-real-waline-url.vercel.app'; 
    
    if (serverURL.includes('your-real-waline-url')) {
        container.innerHTML = `<p style="text-align:center; color:var(--text-soft); font-size:0.8rem; padding: 20px;">请在 post.js 中配置真实的 Waline serverURL</p>`;
        return;
    }

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    
    try {
        Waline.init({
            el: '#waline-container',
            serverURL: serverURL,
            path: `post-${num}`,
            dark: 'auto', // 自动适配系统的暗色模式
            reaction: true,
            pageview: true,
            comment: true,
            placeholder: '写下你的评论...',
            imageUploader: false, // 除非配置了图床，否则建议关闭
        });
    } catch (err) {
        console.error("Waline init failed:", err);
    }
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

                let renderedExcerpt = "";
                try {
                    if (typeof marked !== 'undefined') {
                        renderedExcerpt = marked.parse(rawExcerpt);
                        renderedExcerpt = renderedExcerpt.replace(/<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|AI)\]([\s\S]*?)<\/p>\s*<\/blockquote>/gi, (match, type, content) => {
                            const t = type.toUpperCase();
                            const title = t === 'AI' ? 'AI Generated' : t;
                            return `<div class="markdown-alert markdown-alert-${t.toLowerCase()}"><p class="markdown-alert-title">${title}</p><div class="markdown-alert-content">${content.trim()}</div></div>`;
                        });
                    } else {
                        renderedExcerpt = `<p>${rawExcerpt}</p>`;
                    }
                } catch (err) {
                    renderedExcerpt = rawExcerpt;
                }

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
            if (href && (href.startsWith('http') || href.includes('/issues/'))) return;
            
            e.preventDefault();
            const num = parseInt(link.getAttribute('data-num'));
            previewCard.style.display = 'none';
            openPost(num);
        };
    });
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

function closePost() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('post')) {
        history.pushState({}, "Blog | Jun Loye", window.location.pathname);
        realClosePost();
    } else {
        realClosePost();
    }
}

function realClosePost() {
    const area = document.getElementById('content-area');
    const overlay = document.getElementById('post-overlay');
    const progressBar = document.getElementById('reading-progress');
    const toc = document.getElementById('post-toc');
    const editBtn = document.getElementById('edit-post-btn');
    if (!area || !area.classList.contains('show')) return;
    document.title = "Blog | Jun Loye";
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