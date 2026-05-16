/**
 * 文章编辑历史记录模块
 * 通过GitHub Timeline API获取Issue编辑历史，支持缓存和diff对比展示
 * 
 * Timeline API (比Events API更详细):
 * - `/issues/{number}/timeline` 返回 `issue_edit` 事件，包含完整的前一版本body/title
 * - `/issues/{number}/events` 返回 `edited` 事件，但body.from可能被截断
 */
const postHistory = {
    CACHE_KEY: 'post_history_cache',
    CACHE_TTL: 30 * 24 * 60 * 60 * 1000, // 30天过期
    ALLOWED_EVENTS: ['edited', 'issue_edit', 'created', 'labeled', 'unlabeled', 'closed', 'reopened'],

    /**
     * 获取事件标签文本和颜色
     */
    getEventBadge(eventType) {
        const badges = {
            'edited': { label: '编辑', color: '#0366d6', bg: '#ddeeff' },
            'issue_edit': { label: '编辑', color: '#0366d6', bg: '#ddeeff' },
            'created': { label: '创建', color: '#28a745', bg: '#d4edda' },
            'labeled': { label: '添加标签', color: '#6f42c1', bg: '#e8dfff' },
            'unlabeled': { label: '移除标签', color: '#e36209', bg: '#ffe0cc' },
            'closed': { label: '关闭', color: '#cb2431', bg: '#fde8e8' },
            'reopened': { label: '重新打开', color: '#28a745', bg: '#d4edda' }
        };
        return badges[eventType] || { label: eventType, color: '#586069', bg: '#f0f0f0' };
    },

    /**
     * 从缓存获取历史记录
     */
    getCache(owner, repo, issueNumber) {
        try {
            const cacheKey = `${owner}/${repo}/${issueNumber}`;
            const cached = JSON.parse(localStorage.getItem(this.CACHE_KEY));
            if (!cached || !cached.data) return null;

            const item = cached.data[cacheKey];
            if (!item) return null;

            // 检查是否过期
            if (Date.now() - item.timestamp > this.CACHE_TTL) {
                delete cached.data[cacheKey];
                localStorage.setItem(this.CACHE_KEY, JSON.stringify(cached));
                return null;
            }

            return item.events;
        } catch (e) {
            console.warn('历史记录缓存读取失败:', e);
            return null;
        }
    },

    /**
     * 保存历史记录到缓存
     */
    setCache(owner, repo, issueNumber, events) {
        try {
            const cacheKey = `${owner}/${repo}/${issueNumber}`;
            const cached = JSON.parse(localStorage.getItem(this.CACHE_KEY)) || { data: {} };

            cached.data[cacheKey] = {
                events: events,
                timestamp: Date.now()
            };

            // 清理过期缓存
            this.cleanExpiredCache(cached);
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(cached));
        } catch (e) {
            console.warn('历史记录缓存写入失败:', e);
        }
    },

    /**
     * 清理过期缓存
     */
    cleanExpiredCache(cacheObj) {
        const now = Date.now();
        Object.keys(cacheObj.data).forEach(key => {
            if (now - cacheObj.data[key].timestamp > this.CACHE_TTL) {
                delete cacheObj.data[key];
            }
        });
    },

    /**
     * 获取缓存统计信息
     */
    getCacheStats() {
        try {
            const cached = JSON.parse(localStorage.getItem(this.CACHE_KEY));
            if (!cached || !cached.data) {
                return { count: 0, size: 0, lastUpdate: null };
            }

            const size = new Blob([JSON.stringify(cached)]).size;
            const timestamps = Object.values(cached.data).map(v => v.timestamp);
            const lastUpdate = timestamps.length > 0 ? Math.max(...timestamps) : null;

            return {
                count: Object.keys(cached.data).length,
                size: size,
                lastUpdate: lastUpdate
            };
        } catch (e) {
            return { count: 0, size: 0, lastUpdate: null };
        }
    },

    /**
     * 清空所有历史记录缓存
     */
    clearAllCache() {
        try {
            localStorage.removeItem(this.CACHE_KEY);
            return true;
        } catch (e) {
            console.error('清除历史记录缓存失败:', e);
            return false;
        }
    },

    /**
     * 从Timeline API获取Issue的编辑历史
     * Timeline API返回issue_edit事件，包含完整的before编辑前内容
     * 这是获取编辑历史的最佳来源
     * 注意: Timeline API (mocked) 在某些仓库/场景下可能不被支持，
     * 此时会回退到Events API
     */
    async fetchIssueTimeline(issueNumber, owner, repo) {
        const timelineEvents = [];
        let page = 1;
        const perPage = 100;
        // 尝试使用已登录用户的 token 进行认证请求，提高限流配额
        const token = localStorage.getItem('gh_access_token');
        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        try {
            while (true) {
                const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/timeline?per_page=${perPage}&page=${page}`;
                const response = await fetch(url, { headers });

                if (response.status === 404) {
                    console.warn('Timeline API 返回404，该Issue可能不存在');
                    break;
                }
                if (response.status === 410) {
                    // 410 Gone 是常见情况 - Timeline API 对旧事件不可用
                    console.warn('Timeline API 返回410（已不可用），将回退到Events API');
                    break;
                }
                if (response.status === 403 || response.status === 429) {
                    // 403/429 限流，无需重试直接放弃，避免耗尽配额影响Events API
                    console.warn('Timeline API 限流(' + response.status + ')，跳过Timeline，使用Events API');
                    break;
                }
                if (!response.ok) {
                    console.warn('获取Timeline历史失败:', response.status);
                    break;
                }

                const data = await response.json();
                if (!data || !Array.isArray(data) || data.length === 0) break;

                // 过滤出issue_edit事件以及其他有用事件
                const filteredEvents = data.filter(event =>
                    event && this.ALLOWED_EVENTS.includes(event.event)
                );

                // 格式化事件数据
                const formattedEvents = filteredEvents.map(event => ({
                    id: event.id,
                    type: event.event,
                    actor: event.actor ? {
                        login: event.actor.login,
                        avatar_url: event.avatar_url || event.actor.avatar_url,
                        html_url: event.actor.html_url
                    } : null,
                    created_at: event.created_at,
                    // issue_edit事件包含完整的变更前内容 (Timeline API)
                    // 注意: GitHub Timeline API 的 issue_edit 事件将变更数据放在 changes 字段中
                    issue_edit: event.issue_edit || null,
                    // changes字段: issue_edit事件也使用此字段存储 {title:{from}, body:{from}}
                    changes: event.changes || null,
                    // label事件包含标签信息
                    label: event.label ? {
                        name: event.label.name,
                        color: event.label.color
                    } : null,
                    // rename事件包含重命名信息
                    rename: event.rename || null
                }));

                timelineEvents.push(...formattedEvents);
                page++;

                if (data.length < perPage) break;
            }

            return timelineEvents;
        } catch (e) {
            console.error('获取Timeline编辑历史出错:', e);
            return [];
        }
    },

    /**
     * 从Events API获取Issue事件历史（作为补充）
     * Events API对公开仓库无需认证即可访问
     */
    async fetchIssueEvents(issueNumber, owner, repo) {
        const events = [];
        let page = 1;
        const perPage = 30;
        const maxEvents = 100;
        // 尝试使用已登录用户的 token 进行认证请求
        const token = localStorage.getItem('gh_access_token');
        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        try {
            while (events.length < maxEvents) {
                const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/events?per_page=${perPage}&page=${page}`;
                const response = await fetch(url, { headers });

                if (response.status === 404) {
                    console.warn('Events API 返回404，Issue可能不存在或已被删除');
                    break;
                }
                if (response.status === 410) {
                    console.warn('Events API 返回410，事件已过期不可用');
                    break;
                }
                if (response.status === 403 || response.status === 429) {
                    // 限流时直接放弃，避免连锁限流
                    console.warn('Events API 限流(' + response.status + ')，跳过Events API');
                    break;
                }
                if (!response.ok) {
                    console.warn('获取事件历史失败:', response.status);
                    break;
                }

                const data = await response.json();
                if (!data || !Array.isArray(data) || data.length === 0) break;

                // 过滤相关事件类型
                const filteredEvents = data.filter(event =>
                    event && this.ALLOWED_EVENTS.includes(event.event)
                );

                const formattedEvents = filteredEvents.map(event => ({
                    id: event.id,
                    type: event.event,
                    actor: event.actor ? {
                        login: event.actor.login,
                        avatar_url: event.actor.avatar_url,
                        html_url: event.actor.html_url
                    } : null,
                    created_at: event.created_at,
                    changes: event.changes || null,
                    label: event.label ? {
                        name: event.label.name,
                        color: event.label.color
                    } : null,
                    rename: event.rename || null
                }));

                events.push(...formattedEvents);
                page++;

                if (data.length < perPage) break;
            }

            return events;
        } catch (e) {
            console.error('获取事件历史出错:', e);
            return [];
        }
    },

    /**
     * 获取Issue编辑历史（综合Timeline API和Events API）
     * Timeline API优先，Events API补充
     * @param {number} issueNumber - Issue编号
     * @param {string} owner - 仓库所有者
     * @param {string} repo - 仓库名
     * @param {object} [issueData] - 可选的Issue数据，用于在API限流时生成兜底事件，避免额外API请求
     */
    async fetchIssueHistory(issueNumber, owner, repo, issueData) {
        // 先检查缓存（仅当缓存非空时使用）
        const cached = this.getCache(owner, repo, issueNumber);
        if (cached && cached.length > 0) {
            return cached;
        }

        // 1. 先从Timeline API获取（包含完整的编辑前后内容）
        const timelineEvents = await this.fetchIssueTimeline(issueNumber, owner, repo);

        // 2. 再从Events API获取（可能包含一些Timeline没有的事件）
        const eventsEvents = await this.fetchIssueEvents(issueNumber, owner, repo);

        // 3. 合并事件 - 以Timeline为主，Events补充
        const mergedMap = new Map();

        // 先添加Timeline事件（优先级高）
        timelineEvents.forEach(event => {
            mergedMap.set(event.id, event);
        });

        // 再添加Events事件，但跳过已经在Timeline中存在的
        eventsEvents.forEach(event => {
            if (!mergedMap.has(event.id)) {
                mergedMap.set(event.id, event);
            }
        });

        // 转回数组并按时间排序（最新的在前）
        const mergedEvents = Array.from(mergedMap.values());
        mergedEvents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // 仅在获取到事件时才缓存，避免空缓存导致后续不再请求
        if (mergedEvents.length > 0) {
            this.setCache(owner, repo, issueNumber, mergedEvents);
        }

        // 4. 即使API没有返回历史事件，也生成一条"创建"事件作为兜底
        //    这样任何已发布的文章至少会显示一条创建记录
        //    优先使用传入的issueData，避免额外API请求(可能被限流)
        if (mergedEvents.length === 0) {
            const syntheticEvent = this.generateLocalCreatedEvent(issueNumber, issueData);
            if (syntheticEvent) {
                mergedEvents.push(syntheticEvent);
                this.setCache(owner, repo, issueNumber, mergedEvents);
            }
        }

        return mergedEvents;
    },

    /**
     * 根据已有的Issue数据生成兜底的"创建"事件（无需额外API调用）
     * 当所有API都无法获取到编辑历史时，使用已有数据生成一条创建事件
     */
    generateLocalCreatedEvent(issueNumber, issueData) {
        // 优先使用传入的issueData
        if (issueData && issueData.created_at) {
            return {
                id: `created-${issueNumber}-local`,
                type: 'created',
                actor: issueData.user ? {
                    login: issueData.user.login,
                    avatar_url: issueData.user.avatar_url,
                    html_url: issueData.user.html_url
                } : null,
                created_at: issueData.created_at,
                issue_edit: null,
                changes: null,
                label: null,
                rename: null
            };
        }

        // 其次尝试从全局 allIssues 中查找
        if (typeof allIssues !== 'undefined' && Array.isArray(allIssues)) {
            const found = allIssues.find(i => i.number === issueNumber);
            if (found && found.created_at) {
                return {
                    id: `created-${issueNumber}-local`,
                    type: 'created',
                    actor: found.user ? {
                        login: found.user.login,
                        avatar_url: found.user.avatar_url,
                        html_url: found.user.html_url
                    } : null,
                    created_at: found.created_at,
                    issue_edit: null,
                    changes: null,
                    label: null,
                    rename: null
                };
            }
        }

        // 无法获取任何数据，返回null
        console.warn('无法生成兜底创建事件: 缺少Issue数据');
        return null;
    },

    /**
     * 简单的文本差异分析，返回增删行
     */
    computeLineDiff(oldText, newText) {
        if (!oldText || !newText) return null;
        
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        
        const additions = [];
        const removals = [];
        
        // 简化版行级diff：找出新增和删除的行
        const oldSet = new Set();
        oldLines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed) oldSet.add(trimmed);
        });
        
        const newSet = new Set();
        newLines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed) newSet.add(trimmed);
        });
        
        // 在新但不在旧 = 新增
        newLines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !oldSet.has(trimmed)) {
                additions.push(line);
            }
        });
        
        // 在旧但不在新 = 删除
        oldLines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !newSet.has(trimmed)) {
                removals.push(line);
            }
        });
        
        return { additions, removals };
    },

    /**
     * 渲染Markdown内容为HTML
     */
    renderMarkdown(text) {
        if (!text) return '';
        if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
            try {
                return marked.parse(text);
            } catch (e) {
                return this.escapeHtml(text);
            }
        }
        return this.escapeHtml(text);
    },

    /**
     * 生成编辑内容diff的HTML片段（支持Markdown渲染）
     */
    generateDiffHTML(titleChanges, bodyChanges) {
        const parts = [];
        
        // 标题变更
        if (titleChanges && titleChanges.from) {
            parts.push(`
                <div class="history-diff-section">
                    <div class="history-diff-label">标题变更</div>
                    <div class="history-diff-removed">${this.escapeHtml(titleChanges.from)}</div>
                </div>
            `);
        }
        
        // 内容变更
        if (bodyChanges) {
            const diff = this.computeLineDiff(bodyChanges.from, bodyChanges.to || '');
            if (diff && (diff.additions.length > 0 || diff.removals.length > 0)) {
                parts.push(`<div class="history-diff-section">`);
                parts.push(`<div class="history-diff-label">内容变更</div>`);
                
                if (diff.removals.length > 0) {
                    const removedMd = diff.removals.slice(0, 10).join('\n');
                    parts.push(`<div class="history-diff-removed"><span class="history-diff-marker">-</span><div class="history-diff-md-content">${this.renderMarkdown(removedMd)}</div></div>`);
                    if (diff.removals.length > 10) {
                        parts.push(`<div class="history-diff-more">...还有其他 ${diff.removals.length - 10} 行被删除</div>`);
                    }
                }
                
                if (diff.additions.length > 0) {
                    const addedMd = diff.additions.slice(0, 10).join('\n');
                    parts.push(`<div class="history-diff-added"><span class="history-diff-marker">+</span><div class="history-diff-md-content">${this.renderMarkdown(addedMd)}</div></div>`);
                    if (diff.additions.length > 10) {
                        parts.push(`<div class="history-diff-more">...还有其他 ${diff.additions.length - 10} 行被添加</div>`);
                    }
                }
                
                parts.push(`</div>`);
            } else if (bodyChanges.from) {
                // 无法做行级diff时，显示字符数变化
                const fromLen = (bodyChanges.from || '').length;
                const toLen = (bodyChanges.to || '').length;
                parts.push(`
                    <div class="history-diff-section">
                        <div class="history-diff-label">内容大小变化</div>
                        <div class="history-diff-size">${this.formatDiffSize(fromLen, toLen)}</div>
                    </div>
                `);
            }
        }
        
        return parts.join('');
    },

    /**
     * 转义HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 格式化大小变化
     */
    formatDiffSize(from, to) {
        const diff = to - from;
        const sign = diff >= 0 ? '+' : '';
        return `${from} 字符 → ${to} 字符 (${sign}${diff})`;
    },

    /**
     * 生成历史记录HTML
     */
    generateHistoryHTML(events) {
        if (!events || events.length === 0) {
            return `<div class="history-empty">
                <svg viewBox="0 0 24 24" width="48" height="48"><path fill="currentColor" d="M13 3a9 9 0 0 0-9 9H1l4 3.99L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.25 2.52.77-1.28-3.52-2.09V8H12z"/></svg>
                <p>暂无编辑记录</p>
            </div>`;
        }

        const timelineHtml = events.map((event, index) => {
            const badge = this.getEventBadge(event.type);
            const date = new Date(event.created_at).toLocaleString('zh-CN', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            const actorName = event.actor ? event.actor.login : '未知用户';
            const actorAvatar = event.actor ? event.actor.avatar_url : '';
            const actorUrl = event.actor ? event.actor.html_url : '#';

            // 构建事件描述和扩展内容
            let description = '';
            let diffHtml = '';
            
            switch (event.type) {
                case 'issue_edit':
                    // Timeline/Events API的issue_edit事件
                    // 注意: GitHub Timeline API返回的issue_edit事件将编辑前后内容
                    // 放在 event.changes 字段中，而不是 event.issue_edit
                    // event.issue_edit 字段始终为空，需要从 changes 读取
                    {
                        const editData = event.changes || event.issue_edit || null;
                        if (editData) {
                            const changeDesc = [];
                            const titleChanges = editData.title;
                            const bodyChanges = editData.body;
                            
                            if (titleChanges && titleChanges.from) {
                                changeDesc.push(`标题已修改`);
                            }
                            if (bodyChanges && bodyChanges.from) {
                                changeDesc.push('文章内容已编辑');
                            }
                            description = changeDesc.join('；') || '文章已编辑';
                            
                            // 生成diff展示
                            diffHtml = this.generateDiffHTML(titleChanges, bodyChanges);
                        } else {
                            description = '文章已编辑';
                        }
                    }
                    break;
                    
                case 'edited':
                    // Events API的edited事件 - 包含changes摘要
                    if (event.changes) {
                        const changes = [];
                        if (event.changes.title) {
                            changes.push(`标题从「${event.changes.title.from}」修改`);
                        }
                        if (event.changes.body) {
                            changes.push('文章内容已编辑');
                        }
                        description = changes.join('；') || '文章已编辑';
                        
                        // Event API的body.from可能被截断，但我们可以显示标题变更
                        if (event.changes.title && event.changes.title.from) {
                            diffHtml = `
                                <div class="history-diff-section">
                                    <div class="history-diff-label">原标题</div>
                                    <div class="history-diff-removed">${this.escapeHtml(event.changes.title.from)}</div>
                                </div>
                            `;
                        }
                    } else {
                        description = '文章已编辑';
                    }
                    break;
                    
                case 'created':
                    description = '文章已创建';
                    break;
                case 'labeled':
                    description = event.label ? `添加标签「${event.label.name}」` : '添加标签';
                    break;
                case 'unlabeled':
                    description = event.label ? `移除标签「${event.label.name}」` : '移除标签';
                    break;
                case 'closed':
                    description = '文章已关闭';
                    break;
                case 'reopened':
                    description = '文章已重新打开';
                    break;
                default:
                    description = event.type;
            }

            // 重命名事件特殊处理
            if (event.rename) {
                description = `标题从「${event.rename.from}」重命名为「${event.rename.to}」`;
            }

            const isLast = index === events.length - 1;

            return `
                <div class="history-timeline-item${isLast ? ' last' : ''}">
                    <div class="history-timeline-dot" style="border-color: ${badge.color};">
                        <span class="history-event-badge" style="background: ${badge.bg}; color: ${badge.color}; border: 1px solid ${badge.color};">
                            ${badge.label}
                        </span>
                    </div>
                    <div class="history-timeline-content">
                        <div class="history-event-header">
                            <a href="${actorUrl}" target="_blank" class="history-actor" title="${actorName}">
                                <img src="${actorAvatar}" alt="${actorName}" class="history-avatar" onerror="this.style.display='none'">
                                <span class="history-actor-name">${actorName}</span>
                            </a>
                            <span class="history-event-time">${date}</span>
                        </div>
                        <div class="history-event-desc">${description}</div>
                        ${diffHtml ? `<div class="history-event-diff">${diffHtml}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="history-timeline">
                ${timelineHtml}
            </div>
        `;
    },

    /**
     * 加载并显示历史记录，返回事件数组
     */
    async loadAndDisplay(issueNumber, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return [];

        // 显示加载状态
        container.innerHTML = '<div class="history-loading"><div class="history-spinner"></div><span>加载编辑历史...</span></div>';

        // 获取配置
        await ensureConfig();
        const owner = typeof CONFIG !== 'undefined' ? CONFIG.username : '';
        const repo = typeof CONFIG !== 'undefined' ? CONFIG.repo : '';

        if (!owner || !repo) {
            container.innerHTML = '<div class="history-error">无法加载历史记录：配置缺失</div>';
            return [];
        }

        // 离线时先尝试从缓存加载
        if (!navigator.onLine) {
            const cached = this.getCache(owner, repo, issueNumber);
            if (cached && cached.length > 0) {
                container.innerHTML = this.generateHistoryHTML(cached);
                return cached;
            }
            container.innerHTML = `
                <div class="history-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48"><path fill="currentColor" d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
                    <p>离线状态下无法加载编辑历史</p>
                    <p style="font-size:0.8rem; margin-top:4px;">联网后将自动获取</p>
                </div>`;
            return [];
        }

        // 从已加载的数据中获取Issue信息，用于兜底事件生成（避免额外API请求）
        let issueData = null;
        if (typeof allIssues !== 'undefined' && Array.isArray(allIssues)) {
            issueData = allIssues.find(i => i.number === issueNumber);
        }
        // 如果allIssues中没有，尝试从offlineStorage获取
        if (!issueData && typeof offlineStorage !== 'undefined') {
            issueData = offlineStorage.getIssueData(issueNumber);
        }

        // 使用综合方法获取历史（Timeline API + Events API）
        // 传入issueData用于API限流时的兜底创建事件
        const events = await this.fetchIssueHistory(issueNumber, owner, repo, issueData);
        container.innerHTML = this.generateHistoryHTML(events);
        return events;
    }
};
