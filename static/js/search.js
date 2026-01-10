const searchInputEl = document.getElementById('search-input');

function filterByTag(tagName) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = tagName;
        searchInput.dispatchEvent(new Event('input')); 
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

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