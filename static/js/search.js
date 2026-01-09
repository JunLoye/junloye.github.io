function renderPosts(posts, highlightTerm = "") {
    const container = document.getElementById('post-list-container');
    if (!container) return;
    
    if (posts.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-soft);">未找到匹配的文章</div>`;
        return;
    }

    container.innerHTML = posts.map(issue => {
        const cover = issue.body?.match(/### 🖼️ 封面图链接\s*(http\S+)/)?.[1] || `https://picsum.photos/seed/${issue.id}/800/450`;
        const summaryRaw = issue.body?.match(/### 📖 文章简述\s*([\s\S]*?)(?=\n---|###|$)/)?.[1]?.trim() || "";
        
        let displayTitle = issue.title;
        let displaySummary = marked.parse(summaryRaw);

        if (highlightTerm) {
            const regex = new RegExp(`(${highlightTerm})`, 'gi');
            displayTitle = displayTitle.replace(regex, `<mark class="search-highlight">$1</mark>`);
            displaySummary = displaySummary.replace(new RegExp(`(>[^<]*)(${highlightTerm})([^>]*<)`, 'gi'), '$1<mark class="search-highlight">$2</mark>$3');
        }

        const tagsHtml = issue.labels.map(l => 
            `<span class="post-tag" onclick="event.stopPropagation(); filterByTag('${l.name}')">${l.name}</span>`
        ).join('');

        return `<div class="post-card" onclick="openPost(${issue.number})">
            <div class="post-cover"><img src="${cover}"></div>
            <h2 class="post-card-title">${displayTitle}</h2>
            <div class="post-card-summary markdown-body" style="font-size: 0.9rem;">${displaySummary}</div>
            <div class="post-card-tags">${tagsHtml}</div>
        </div>`;
    }).join('');

    if (highlightTerm) {
        let countEl = document.getElementById('search-count-hint');
        if (!countEl) {
            countEl = document.createElement('div');
            countEl.id = 'search-count-hint';
            countEl.style = 'grid-column: 1/-1; font-size: 0.85rem; color: var(--text-soft); margin-bottom: -20px;';
            container.prepend(countEl);
        }
        countEl.textContent = `找到 ${posts.length} 篇相关内容：`;
    }
}
function filterByTag(tagName) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = tagName;
        searchInput.dispatchEvent(new Event('input')); 
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

const searchInputEl = document.getElementById('search-input');
if (searchInputEl) {
    searchInputEl.oninput = (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) {
            renderPosts(allIssues);
            const countEl = document.getElementById('search-count-hint');
            if (countEl) countEl.remove();
            return;
        }
        const filtered = allIssues.filter(issue => {
            const titleMatch = issue.title.toLowerCase().includes(term);
            const bodyMatch = (issue.body || "").toLowerCase().includes(term);
            const tagMatch = issue.labels.some(l => l.name.toLowerCase().includes(term));
            return titleMatch || bodyMatch || tagMatch;
        });
        renderPosts(filtered, term);
    };
}