/**
 * 搜索模块 - 支持全屏搜索覆盖层
 * 使用 Ctrl+K / Cmd+K 或点击搜索框触发
 */

// ===== 搜索覆盖层 =====
let searchOverlayCreated = false;

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

    // 输入事件
    const input = document.getElementById('search-overlay-input');
    input.addEventListener('input', (e) => {
        performSearchOverlay(e.target.value);
    });

    // 键盘事件
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

    // 结果导航（上/下箭头）
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

    // 点击overlay背景关闭
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
    // 触发动画
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });

    // 聚焦输入框
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
                <span>${term ? '未找到相关文章 😅' : '输入关键词开始搜索'}</span>
            </div>
        `;
        return;
    }

    // 过滤文章
    const filtered = allIssues.filter(issue => {
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
                <span>未找到相关文章 😅</span>
                <span style="font-size:0.8rem;">试试其他关键词</span>
            </div>
        `;
        return;
    }

    // 高亮关键词
    const highlightTerm = (text) => {
        if (!text) return '';
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    };

    // 生成结果列表 - 优先标题匹配和标签匹配
    const sorted = [...filtered].sort((a, b) => {
        const aTitle = a.title.toLowerCase().includes(term);
        const bTitle = b.title.toLowerCase().includes(term);
        if (aTitle !== bTitle) return bTitle - aTitle;
        return b.created_at.localeCompare(a.created_at);
    });

    body.innerHTML = sorted.map(issue => {
        const snippet = getSearchSnippet(issue, term);
        const tags = issue.labels.filter(l => l.name !== '反馈').map(l =>
            `<span class="result-tag">${highlightTerm(l.name)}</span>`
        ).join('');
        const date = new Date(issue.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });

        // 使用 marked 渲染 markdown 片段
        let snippetHtml = '';
        if (snippet) {
            snippetHtml = snippet;
            if (typeof marked !== 'undefined') {
                try {
                    snippetHtml = marked.parse(snippet);
                    // 保留高亮标记
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

    // 显示结果计数
    const counter = document.createElement('div');
    counter.style.cssText = 'padding: 8px 20px; font-size: 0.75rem; color: var(--text-soft); border-bottom: 1px solid var(--line);';
    counter.textContent = `找到 ${filtered.length} 篇相关文章`;
    body.insertBefore(counter, body.firstChild);
}

function getSearchSnippet(issue, term) {
    const body = issue.body || '';
    const lowerBody = body.toLowerCase();
    const idx = lowerBody.indexOf(term);
    
    if (idx === -1) return '';

    // 提取匹配位置周围的文本（约100个字符）
    const start = Math.max(0, idx - 40);
    const end = Math.min(body.length, idx + term.length + 60);
    let snippet = body.substring(start, end);
    
    // 添加省略号
    if (start > 0) snippet = '...' + snippet;
    if (end < body.length) snippet = snippet + '...';
    
    // 高亮关键词
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    // Strip markdown-ish formatting for snippet
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

// ===== 导航栏搜索框（保持原有行为，但点击聚焦时打开覆盖层） =====
const searchInputEl = document.getElementById('search-input');

if (searchInputEl) {
    const searchContainer = searchInputEl.closest('.search-container');
    const searchKbd = document.querySelector('.search-kbd');

    // 直接点击导航栏搜索框改为打开覆盖层
    searchInputEl.addEventListener('focus', (e) => {
        e.preventDefault();
        searchInputEl.blur();
        openSearchOverlay();
    });

    // 点击搜索容器也打开覆盖层
    searchContainer?.addEventListener('click', (e) => {
        if (e.target !== searchInputEl && e.target !== searchContainer) return;
        e.preventDefault();
        openSearchOverlay();
    });

    // Ctrl+K / Cmd+K 快捷键打开覆盖层
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openSearchOverlay();
        }
    });
}

// ===== 内联搜索功能（从右键菜单调用） =====
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

// ===== 标签筛选跳转到搜索 =====
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
