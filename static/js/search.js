let searchOverlayCreated = false;

// 本地 escapeXML 确保独立可用
function escapeXML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&' + 'amp;')
        .replace(/</g, '&' + 'lt;')
        .replace(/>/g, '&' + 'gt;')
        .replace(/"/g, '&' + 'quot;')
        .replace(/'/g, '&' + '#x27;');
}

function createSearchOverlay() {
    if (searchOverlayCreated) return;
    searchOverlayCreated = true;

    const overlay = document.createElement('div');
    overlay.id = 'search-overlay';
    overlay.className = 'search-overlay';
    overlay.innerHTML = `
        <div class="search-overlay-panel">
            <div class="search-overlay-header">
                <svg class="search-icon-big" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14z"/>
                </svg>
                <input type="text" id="search-overlay-input" placeholder="搜索文章标题、内容或标签..." autofocus>
                <button class="search-overlay-close" onclick="closeSearchOverlay()">ESC</button>
            </div>
            <div class="search-overlay-body" id="search-overlay-body">
                <div class="search-overlay-empty">
                    <svg viewBox="0 0 24 24">
                        <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14z"/>
                    </svg>
                    <span>输入关键词开始搜索</span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById('search-overlay-input');
    input.addEventListener('input', (e) => {
        performSearchOverlay(e.target.value);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const results = document.querySelectorAll('.search-overlay-result');
            if (results.length > 0) {
                results[0].click();
            }
        }
        if (e.key === 'Escape') {
            closeSearchOverlay();
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const results = document.querySelectorAll('.search-overlay-result');
            if (results.length > 0) results[0].focus();
        }
    });

    const body = document.getElementById('search-overlay-body');
    body.addEventListener('keydown', (e) => {
        const results = Array.from(body.querySelectorAll('.search-overlay-result'));
        if (results.length === 0) return;

        const currentIndex = results.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = (currentIndex + 1) % results.length;
            results[next].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = currentIndex > 0 ? currentIndex - 1 : results.length - 1;
            results[prev].focus();
        } else if (e.key === 'Escape') {
            closeSearchOverlay();
        } else if (e.key === 'Enter' && currentIndex >= 0) {
            results[currentIndex].click();
        }
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeSearchOverlay();
        }
    });
}

function openSearchOverlay() {
    createSearchOverlay();
    const overlay = document.getElementById('search-overlay');
    if (!overlay) return;

    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });

    setTimeout(() => {
        const input = document.getElementById('search-overlay-input');
        if (input) {
            input.value = '';
            input.focus();
        }
        const body = document.getElementById('search-overlay-body');
        if (body) {
            body.innerHTML = `
                <div class="search-overlay-empty">
                    <svg viewBox="0 0 24 24">
                        <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14z"/>
                    </svg>
                    <span>输入关键词开始搜索</span>
                </div>
            `;
        }
    }, 100);

    document.body.style.overflow = 'hidden';
}

function closeSearchOverlay() {
    const overlay = document.getElementById('search-overlay');
    if (!overlay) return;

    overlay.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 300);
}

function performSearchOverlay(term) {
    const body = document.getElementById('search-overlay-body');
    if (!body) return;

    term = term.toLowerCase().trim();
    
    if (!term || typeof allIssues === 'undefined' || !allIssues.length) {
        body.innerHTML = `
            <div class="search-overlay-empty">
                <svg viewBox="0 0 24 24">
                    <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14z"/>
                </svg>
                <span>${term ? '未找到相关文章' : '输入关键词开始搜索'}</span>
            </div>
        `;
        return;
    }

    // 使用 filterIssues 排除反馈/非作者/已关闭后搜索
    const searchPool = typeof filterIssues === 'function' ? filterIssues(allIssues) : allIssues;
    const filtered = searchPool.filter(issue => {
        const titleMatch = issue.title.toLowerCase().includes(term);
        const bodyMatch = (issue.body || "").toLowerCase().includes(term);
        const tagMatch = issue.labels.some(l => l.name.toLowerCase().includes(term));
        return titleMatch || bodyMatch || tagMatch;
    });

    if (filtered.length === 0) {
        body.innerHTML = `
            <div class="search-overlay-empty">
                <svg viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <span>未找到相关文章</span>
                <span style="font-size:0.8rem;color:var(--text-soft);">试试其他关键词</span>
            </div>
        `;
        return;
    }

    const highlightTerm = (text) => {
        if (!text) return '';
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    };

    const sorted = [...filtered].sort((a, b) => {
        const aTitle = a.title.toLowerCase().includes(term);
        const bTitle = b.title.toLowerCase().includes(term);
        if (aTitle !== bTitle) return bTitle - aTitle;
        return b.created_at.localeCompare(a.created_at);
    });

    body.innerHTML = sorted.map(issue => {
        const snippet = getSearchSnippet(issue, term);
        const tags = issue.labels.filter(l => l.name !== '反馈').map(l => {
            const highlightedName = highlightTerm(l.name);
            return `<span class="result-tag" onclick="event.stopPropagation(); closeSearchOverlay(); setTimeout(() => filterByTag('${escapeXML(l.name).replace(/'/g, "\\'")}'), 150);" title="筛选「${l.name}」标签的文章">${highlightedName}</span>`;
        }).join('');
        const date = new Date(issue.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });

        let snippetHtml = '';
        if (snippet) {
            snippetHtml = snippet;
            if (typeof marked !== 'undefined') {
                try {
                    snippetHtml = marked.parse(snippet);
                    snippetHtml = snippetHtml.replace(/<mark>/g, '​<mark>').replace(/<\/mark>/g, '</mark>​');
                } catch (e) {
                    snippetHtml = snippet;
                }
            }
        }

        return `
            <div class="search-overlay-result" tabindex="0" onclick="closeSearchOverlay(); setTimeout(() => openPost(${issue.number}), 100);" onkeydown="if(event.key==='Enter'){this.click()}">
                <h3>${highlightTerm(issue.title)}</h3>
                <div class="result-meta">
                    <span>📅 ${date}</span>
                    <span>#${issue.number}</span>
                </div>
                ${snippet ? `<div class="result-snippet">${snippetHtml}</div>` : ''}
                ${tags ? `<div class="result-tags">${tags}</div>` : ''}
            </div>
        `;
    }).join('');

    const counter = document.createElement('div');
    counter.style.cssText = 'padding: 8px 20px; font-size: 0.75rem; color: var(--text-soft); border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between;';
    
    // 统计有多少个匹配标签被搜索到
    const matchedTags = [...new Set(filtered.flatMap(issue =>
        issue.labels.filter(l => l.name !== '反馈' && l.name.toLowerCase().includes(term)).map(l => l.name)
    ))];
    
    let tagHint = '';
    if (matchedTags.length > 0) {
        tagHint = `<span style="font-size:0.65rem;color:var(--accent);">标签匹配: ${matchedTags.join(', ')}</span>`;
    }
    
    counter.innerHTML = `<span>找到 ${filtered.length} 篇相关文章</span>${tagHint}`;
    body.insertBefore(counter, body.firstChild);
}

function getSearchSnippet(issue, term) {
    const body = issue.body || '';
    const lowerBody = body.toLowerCase();
    const idx = lowerBody.indexOf(term);
    
    if (idx === -1) return '';

    const start = Math.max(0, idx - 40);
    const end = Math.min(body.length, idx + term.length + 60);
    let snippet = body.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < body.length) snippet = snippet + '...';
    
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    snippet = snippet.replace(/\[Cover\]\s*http\S+/g, '')
                     .replace(/\[Summary\]|\[Content\]|\[References\]/g, '')
                     .replace(/^[-*]\s+/gm, '')
                     .replace(/#{1,6}\s+/g, '')
                     .replace(/!\[.*?\]\(.*?\)/g, '')
                     .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                     .replace(/```[\s\S]*?```/g, '')
                     .trim();
    
    return snippet.replace(regex, '<mark>$1</mark>');
}

const searchInputEl = document.getElementById('search-input');

if (searchInputEl) {
    const searchContainer = searchInputEl.closest('.search-container');
    const searchKbd = document.querySelector('.search-kbd');

    searchInputEl.addEventListener('focus', (e) => {
        e.preventDefault();
        searchInputEl.blur();
        openSearchOverlay();
    });

    searchContainer?.addEventListener('click', (e) => {
        if (e.target !== searchInputEl && e.target !== searchContainer) return;
        e.preventDefault();
        openSearchOverlay();
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openSearchOverlay();
        }
    });
}

function searchInPage() {
    if (typeof lastSelectedText === 'undefined' || !lastSelectedText) return;
    openSearchOverlay();
    setTimeout(() => {
        const input = document.getElementById('search-overlay-input');
        if (input) {
            input.value = lastSelectedText;
            input.dispatchEvent(new Event('input'));
        }
    }, 200);
}

function filterByTag(tagName) {
    openSearchOverlay();
    setTimeout(() => {
        const input = document.getElementById('search-overlay-input');
        if (input) {
            input.value = tagName;
            input.dispatchEvent(new Event('input'));
        }
    }, 200);
}
