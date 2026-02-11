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
            // 核心解析：处理正文中的 > [!NOTE] 和 > [!AI]
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

    area.innerHTML = `
        <img src="${cover}" class="detail-hero-img" style="height: 280px; width: 100%; object-fit: cover; margin-bottom: 25px;" onerror="this.onerror=null; this.src='${defaultCover}';">
        <div class="detail-header">
            <div style="display: flex; justify-content: space-between; align-items: center; color:var(--text-soft); font-size:0.85rem;">
                <span>${date}</span>
                <span style="font-size:0.75rem; font-weight:700; color:var(--accent); background:var(--selection-bg); padding:2px 10px; border-radius:4px;">${issue.labels[0]?.name || 'MEMO'}</span>
            </div>
            <h1 style="font-size:2rem; margin:15px 0 15px 0; font-weight:900;">${issue.title}</h1>
        </div>
        <div id="post-body-content" class="markdown-body">${htmlContent}</div>
        <div id="reference-content">${referenceHtml+'<br>'} 
        <div id="comments-wrapper" class="comments-section">
            <div id="comments-list"></div>
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

    setTimeout(() => {
        area.style.transition = "all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)";
        area.style.opacity = "1";
        area.style.transform = "translateY(0)";
        area.classList.add('show');
        generateTOC();
    }, 50);

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

    fetchComments(num);
    setupReferenceHighlighting();
    initLinkPreview(); // 初始化预览
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
        link.onmouseenter = (e) => {
            const num = parseInt(link.getAttribute('data-num'));
            const targetIssue = issuesSource.find(i => i.number === num);
            
            if (targetIssue) {
                // 1. 根据文章模板提取预览文本
                let rawExcerpt = "";
                const contentMatch = targetIssue.body?.match(/\[Content\]\s*([\s\S]*?)(?=\[References\]|---|$)/);
                const summaryMatch = targetIssue.body?.match(/\[Summary\]\s*([\s\S]*?)(?=\[Content\]|---|$)/);
                
                if (contentMatch && contentMatch[1].trim()) {
                    rawExcerpt = contentMatch[1].trim().substring(0, 800); // 截取前500字以保证 MD 结构完整
                } else if (summaryMatch) {
                    rawExcerpt = summaryMatch[1].trim();
                } else {
                    rawExcerpt = targetIssue.body?.substring(0, 200);
                }

                // 2. 渲染 Markdown 并处理预览中的 Alert (含 AI)
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
                
                // 计算位置
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

async function fetchComments(num) {
    const wrapper = document.getElementById('comments-wrapper');
    const list = document.getElementById('comments-list');
    if (!wrapper || !list) return;
    wrapper.style.display = 'block';
    list.innerHTML = ''; 
    const script = document.createElement('script');
    script.src = "https://giscus.app/client.js";
    script.setAttribute('data-repo', "JunLoye/junloye.github.io");
    script.setAttribute('data-repo-id', "R_kgDOPi0ylw");
    script.setAttribute('data-category', "General");
    script.setAttribute('data-category-id', "DIC_kwDOPi0yl84C2H9l");
    script.setAttribute('data-mapping', "pathname"); 
    script.setAttribute('data-strict', "0");
    script.setAttribute('data-reactions-enabled', "0");
    script.setAttribute('data-emit-metadata', "0");
    script.setAttribute('data-input-position', "top");
    const currentTheme = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    script.setAttribute('data-theme', currentTheme);
    script.setAttribute('data-lang', "zh-CN");
    script.crossOrigin = "anonymous";
    script.async = true;
    list.appendChild(script);
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