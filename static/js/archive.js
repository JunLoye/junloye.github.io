/**
 * 归档页面 (Archive) 模块
 * 按年份和月份对文章进行归档展示
 */

/**
 * 打开归档页面
 * @param {boolean} pushState - 是否推送浏览器历史记录
 */
async function openArchive(pushState = true) {
    const overlay = document.getElementById('archive-overlay');
    if (!overlay) return;

    // 加载模板内容
    if (overlay.innerHTML.trim() === "") {
        try {
            const resp = await fetch('/components/archive.html');
            if (!resp.ok) throw new Error("无法读取 archive.html");
            overlay.innerHTML = await resp.text();
        } catch (e) {
            console.error(e);
            if (typeof showNotification === 'function') {
                showNotification("加载归档页面失败", "error");
            }
            return;
        }
    }

    const content = document.getElementById('archive-content');
    if (!content) return;

    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        content.classList.add('show');
    }, 50);

    // 渲染归档数据
    renderArchive();

    // 推送历史状态
    if (pushState) {
        window.history.pushState({ page: 'archive' }, '');
    }
}

/**
 * 从归档页面打开文章（先关闭归档，再打开文章）
 * @param {number} num - 文章编号
 */
function openPostFromArchive(num) {
    closeArchive();
    // 等关闭动画完成后打开文章
    setTimeout(() => {
        if (typeof openPost === 'function') {
            openPost(num);
        } else {
            console.error('openPost 函数未定义');
        }
    }, 350);
}

/**
 * 关闭归档页面
 */
function closeArchive() {
    const overlay = document.getElementById('archive-overlay');
    const content = document.getElementById('archive-content');
    if (!content) return;

    content.classList.remove('show');
    setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
}

/**
 * 清除归档模板缓存，下次打开时重新加载
 * 在文章列表刷新时调用，确保归档数据始终最新
 */
function clearArchiveCache() {
    const overlay = document.getElementById('archive-overlay');
    if (!overlay) return;
    // 清除 innerHTML 使得下次 openArchive 时重新 fetch 模板
    overlay.innerHTML = '';
}

/**
 * 渲染归档内容
 */
function renderArchive() {
    if (!allIssues || allIssues.length === 0) {
        showArchiveEmpty();
        return;
    }

    // 使用与主站相同的过滤逻辑
    const displayIssues = typeof filterIssues === 'function'
        ? filterIssues(allIssues)
        : allIssues;

    if (displayIssues.length === 0) {
        showArchiveEmpty();
        return;
    }

    // 更新统计信息
    updateArchiveStats(displayIssues);

    // 构建归档时间轴
    const timelineHtml = buildArchiveTimeline(displayIssues);
    const timelineContainer = document.getElementById('archive-timeline');
    if (timelineContainer) {
        timelineContainer.innerHTML = timelineHtml;
    }
}

/**
 * 显示归档空状态
 */
function showArchiveEmpty() {
    const timelineContainer = document.getElementById('archive-timeline');
    if (!timelineContainer) return;

    timelineContainer.innerHTML = `
        <div class="archive-empty">
            <svg viewBox="0 0 24 24" width="64" height="64">
                <path fill="currentColor" d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM6.24 5h11.52l.81.97H5.44l.8-.97zM5 19V8h14v11H5z"/>
            </svg>
            <h3>暂无归档内容</h3>
            <p>文章加载完成后将在此处展示</p>
        </div>
    `;

    // 重置统计数据
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    setText('archive-total-posts', '0');
    setText('archive-total-tags', '0');
    setText('archive-total-years', '0');
}

/**
 * 更新归档统计信息
 * @param {Array} issues - 过滤后的文章列表
 */
function updateArchiveStats(issues) {
    // 统计标签数
    const tagSet = new Set();
    issues.forEach(issue => {
        (issue.labels || []).forEach(label => {
            if (label.name !== '反馈') tagSet.add(label.name);
        });
    });

    // 统计覆盖年份
    const yearSet = new Set();
    issues.forEach(issue => {
        if (issue.created_at) {
            const year = new Date(issue.created_at).getFullYear();
            if (!isNaN(year)) yearSet.add(year);
        }
    });

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setText('archive-total-posts', issues.length);
    setText('archive-total-tags', tagSet.size);
    setText('archive-total-years', yearSet.size);
}

/**
 * 构建文章归档时间轴 HTML
 * @param {Array} issues - 过滤后的文章列表
 * @returns {string} HTML 字符串
 */
function buildArchiveTimeline(issues) {
    // 按时间排序（旧的在前，便于归档展示）
    const sorted = [...issues].sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
    );

    // 按年份 -> 月份分组
    const grouped = {};
    sorted.forEach(issue => {
        if (!issue.created_at) return;
        const date = new Date(issue.created_at);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 1-12

        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = [];
        grouped[year][month].push(issue);
    });

    // 年份排序：降序（最新的年份在前）
    const years = Object.keys(grouped).sort((a, b) => b - a);

    // 月份名称
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    let html = '';

    years.forEach(year => {
        const months = Object.keys(grouped[year]).sort((a, b) => b - a); // 月份降序
        const yearTotal = Object.values(grouped[year]).reduce((sum, arr) => sum + arr.length, 0);

        html += `<div class="archive-year-group">`;
        html += `
            <div class="archive-year-header">
                <span class="archive-year-badge">${year}</span>
                <span class="archive-year-count">${yearTotal} 篇</span>
            </div>
        `;

        months.forEach(month => {
            const posts = grouped[year][month];
            // 月份内按创建时间降序
            posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            html += `<div class="archive-month-group">`;
            html += `
                <div class="archive-month-header">
                    <span class="archive-month-dot"></span>
                    <span>${monthNames[month - 1]}（${posts.length} 篇）</span>
                </div>
            `;

            posts.forEach(issue => {
                const date = new Date(issue.created_at);
                const day = String(date.getDate()).padStart(2, '0');
                const monthStr = String(date.getMonth() + 1).padStart(2, '0');

                // 获取标签（排除反馈标签）
                const tags = (issue.labels || [])
                    .filter(l => l.name !== '反馈')
                    .slice(0, 3); // 最多显示3个标签

                const tagsHtml = tags.map(t =>
                    `<span class="archive-post-tag">${escapeXML(t.name)}</span>`
                ).join('');

                html += `
                    <div class="archive-post-item" onclick="openPostFromArchive(${issue.number})" title="${escapeXML(issue.title)}">
                        <span class="archive-post-date">${monthStr}-${day}</span>
                        <span class="archive-post-title">${escapeXML(issue.title)}</span>
                        ${tags.length > 0 ? `<span class="archive-post-tags">${tagsHtml}</span>` : ''}
                    </div>
                `;
            });

            html += `</div>`; // .archive-month-group
        });

        html += `</div>`; // .archive-year-group
    });

    return html;
}

// 监听浏览器前进/后退事件以支持归档页面的历史导航
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page === 'archive') {
        openArchive(false);
    } else {
        closeArchive();
    }
});
