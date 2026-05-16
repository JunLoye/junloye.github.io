/**
 * 离线阅读模块
 * 自动缓存已读文章，支持离线访问和网络状态监听
 */
const offlineStorage = {
    POST_CACHE_KEY: 'blog_post_content_cache',
    LIST_CACHE_KEY: 'blog_posts_list_cache',
    ISSUE_CACHE_KEY: 'blog_post_issue_cache', // 原始Issue数据缓存
    MAX_SIZE: 3 * 1024 * 1024, // 3MB
    EXPIRY_TIME: 30 * 24 * 60 * 60 * 1000, // 30天
    _cachePref: localStorage.getItem('settings_cache_pref') || 'auto',

    /**
     * 估算数据大小
     */
    _getSize(data) {
        try {
            return new Blob([JSON.stringify(data)]).size;
        } catch (e) {
            return 0;
        }
    },

    /**
     * 获取所有缓存键
     */
    _getCacheKeys(cacheObj) {
        return Object.keys(cacheObj).sort((a, b) =>
            (cacheObj[a].timestamp || 0) - (cacheObj[b].timestamp || 0)
        );
    },

    /**
     * 清理过期缓存
     */
    _cleanExpired(cacheObj) {
        const now = Date.now();
        let changed = false;
        Object.keys(cacheObj).forEach(key => {
            if (now - (cacheObj[key].timestamp || 0) > this.EXPIRY_TIME) {
                delete cacheObj[key];
                changed = true;
            }
        });
        return changed;
    },

    /**
     * 清理最旧的缓存直到低于大小限制
     */
    _cleanBySize(cacheObj, targetSize) {
        const currentSize = this._getSize(cacheObj);
        if (currentSize <= targetSize) return;

        const keys = this._getCacheKeys(cacheObj);
        for (const key of keys) {
            if (this._getSize(cacheObj) <= targetSize) break;
            delete cacheObj[key];
        }
    },

    /**
     * 缓存原始Issue数据（用于离线时无需列表即可打开文章）
     */
    cacheIssueData(issueNumber, issue) {
        // 检查缓存偏好：disabled 时不缓存
        if (this._cachePref === 'off') return false;
        try {
            const cached = JSON.parse(localStorage.getItem(this.ISSUE_CACHE_KEY)) || {};
            this._cleanExpired(cached);
            cached[issueNumber] = {
                issue: issue,
                timestamp: Date.now()
            };
            this._cleanBySize(cached, this.MAX_SIZE);
            localStorage.setItem(this.ISSUE_CACHE_KEY, JSON.stringify(cached));
            return true;
        } catch (e) {
            console.warn('Issue数据缓存失败:', e);
            return false;
        }
    },

    /**
     * 获取缓存的原始Issue数据
     */
    getIssueData(issueNumber) {
        // 禁用离线时禁止读取缓存
        if (this._cachePref === 'off') return null;
        try {
            const cached = JSON.parse(localStorage.getItem(this.ISSUE_CACHE_KEY));
            if (!cached) return null;
            const item = cached[issueNumber];
            if (!item) return null;
            if (Date.now() - (item.timestamp || 0) > this.EXPIRY_TIME) {
                delete cached[issueNumber];
                localStorage.setItem(this.ISSUE_CACHE_KEY, JSON.stringify(cached));
                return null;
            }
            return item.issue;
        } catch (e) {
            console.warn('读取Issue缓存失败:', e);
            return null;
        }
    },

    /**
     * 从GitHub API获取单个Issue并缓存
     */
    async fetchAndCacheIssue(issueNumber, owner, repo) {
        // 禁用离线时跳过缓存，直接在线获取
        if (this._cachePref === 'off') {
            if (!navigator.onLine) return null;
            try {
                const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
                const response = await fetch(url);
                if (!response.ok) return null;
                return await response.json();
            } catch (e) {
                console.error('获取Issue出错:', e);
                return null;
            }
        }
        // 先检查缓存
        const cached = this.getIssueData(issueNumber);
        if (cached) return cached;

        // 检查是否在线
        if (!navigator.onLine) return null;

        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
            const response = await fetch(url);
            if (!response.ok) {
                console.warn('获取Issue失败:', response.status);
                return null;
            }
            const issue = await response.json();
            if (issue && issue.number) {
                this.cacheIssueData(issueNumber, issue);
            }
            return issue;
        } catch (e) {
            console.error('获取Issue出错:', e);
            return null;
        }
    },

    /**
     * 缓存文章内容
     */
    cachePost(issueNumber, issue, htmlContent, metadata) {
        // 检查缓存偏好：disabled 时不缓存
        if (this._cachePref === 'off') return false;
        try {
            const cached = JSON.parse(localStorage.getItem(this.POST_CACHE_KEY)) || {};

            // 清理过期缓存
            this._cleanExpired(cached);

            cached[issueNumber] = {
                issue: issue,
                htmlContent: htmlContent,
                metadata: metadata || {},
                timestamp: Date.now()
            };

            // 检查大小限制
            this._cleanBySize(cached, this.MAX_SIZE);

            localStorage.setItem(this.POST_CACHE_KEY, JSON.stringify(cached));
            return true;
        } catch (e) {
            console.warn('文章缓存失败:', e);
            return false;
        }
    },

    /**
     * 获取缓存的文章
     */
    getPost(issueNumber) {
        // 禁用离线时禁止读取缓存
        if (this._cachePref === 'off') return null;
        try {
            const cached = JSON.parse(localStorage.getItem(this.POST_CACHE_KEY));
            if (!cached) return null;

            const post = cached[issueNumber];
            if (!post) return null;

            // 检查过期
            if (Date.now() - (post.timestamp || 0) > this.EXPIRY_TIME) {
                delete cached[issueNumber];
                localStorage.setItem(this.POST_CACHE_KEY, JSON.stringify(cached));
                return null;
            }

            return post;
        } catch (e) {
            console.warn('读取文章缓存失败:', e);
            return null;
        }
    },

    /**
     * 检查文章是否已缓存
     */
    hasPost(issueNumber) {
        return this.getPost(issueNumber) !== null;
    },

    /**
     * 缓存文章列表
     */
    cachePostList(issues) {
        // 检查缓存偏好：disabled 时不缓存
        if (this._cachePref === 'off') return false;
        try {
            const cacheData = {
                issues: issues,
                timestamp: Date.now()
            };
            localStorage.setItem(this.LIST_CACHE_KEY, JSON.stringify(cacheData));
            return true;
        } catch (e) {
            console.warn('文章列表缓存失败:', e);
            return false;
        }
    },

    /**
     * 获取缓存的文章列表
     */
    getPostList() {
        // 禁用离线时禁止读取缓存
        if (this._cachePref === 'off') return null;
        try {
            const cached = JSON.parse(localStorage.getItem(this.LIST_CACHE_KEY));
            if (!cached) return null;

            // 检查过期
            if (Date.now() - (cached.timestamp || 0) > this.EXPIRY_TIME) {
                localStorage.removeItem(this.LIST_CACHE_KEY);
                return null;
            }

            return cached.issues;
        } catch (e) {
            console.warn('读取文章列表缓存失败:', e);
            return null;
        }
    },

    /**
     * 获取缓存统计信息
     */
    getCacheStats() {
        try {
            const postCache = JSON.parse(localStorage.getItem(this.POST_CACHE_KEY)) || {};
            const issueCache = JSON.parse(localStorage.getItem(this.ISSUE_CACHE_KEY)) || {};
            const listCache = localStorage.getItem(this.LIST_CACHE_KEY);
            const postCount = Object.keys(postCache).length;
            const issueCount = Object.keys(issueCache).length;

            // 计算离线缓存大小
            const postSize = this._getSize(postCache);
            const issueSize = this._getSize(issueCache);
            const listSize = listCache ? new Blob([listCache]).size : 0;

            // 获取最后更新时间
            const timestamps = [
                ...Object.values(postCache).map(v => v.timestamp || 0),
                ...Object.values(issueCache).map(v => v.timestamp || 0)
            ];
            const lastUpdate = timestamps.length > 0 ? Math.max(...timestamps) : null;

            return {
                postCount: postCount + issueCount,
                totalSize: postSize + issueSize + listSize,
                postSize: postSize,
                listSize: listSize,
                lastUpdate: lastUpdate
            };
        } catch (e) {
            return { postCount: 0, totalSize: 0, postSize: 0, listSize: 0, lastUpdate: null };
        }
    },

    /**
     * 清除所有离线缓存
     */
    clearAllCache() {
        try {
            localStorage.removeItem(this.POST_CACHE_KEY);
            localStorage.removeItem(this.LIST_CACHE_KEY);
            localStorage.removeItem(this.ISSUE_CACHE_KEY);
            return true;
        } catch (e) {
            console.error('清除离线缓存失败:', e);
            return false;
        }
    },

    /**
     * 清除文章内容缓存（保留列表缓存）
     */
    clearPostCache() {
        try {
            localStorage.removeItem(this.POST_CACHE_KEY);
            localStorage.removeItem(this.ISSUE_CACHE_KEY);
            return true;
        } catch (e) {
            console.error('清除文章内容缓存失败:', e);
            return false;
        }
    },

    /**
     * 设置缓存偏好（由设置页调用）
     * @param {string} pref - 'auto' | 'all' | 'onread' | 'off'
     */
    setCachePref(pref) {
        this._cachePref = pref;
        localStorage.setItem('settings_cache_pref', pref);
        console.log('[offlineStorage] 缓存偏好已更新:', pref);
    },

    /**
     * 检查是否在线
     */
    isOnline() {
        return navigator.onLine;
    },

    /**
     * 初始化网络状态监听
     */
    initNetworkListener() {
        // 创建网络状态指示器
        const indicator = document.createElement('div');
        indicator.id = 'network-status-indicator';
        indicator.className = 'network-status online';
        indicator.innerHTML = `
            <span class="network-status-dot"></span>
            <span class="network-status-text">在线</span>
        `;
        indicator.title = '网络连接状态';

        // 添加到导航栏
        const navRight = document.querySelector('.nav-right');
        if (navRight) {
            navRight.insertBefore(indicator, navRight.firstChild);
        }

        // 监听网络状态变化
        window.addEventListener('online', () => {
            this._updateNetworkStatus(true);
        });

        window.addEventListener('offline', () => {
            this._updateNetworkStatus(false);
        });

        // 初始化状态
        this._updateNetworkStatus(navigator.onLine);
    },

    /**
     * 更新网络状态指示器
     * @param {boolean|string} status - true=在线, false=离线, 'cache'=缓存模式
     */
    _updateNetworkStatus(status) {
        const indicator = document.getElementById('network-status-indicator');
        if (!indicator) return;

        const dot = indicator.querySelector('.network-status-dot');
        const text = indicator.querySelector('.network-status-text');

        if (status === 'cache') {
            // 使用缓存数据模式（在线但使用缓存）
            indicator.className = 'network-status cache';
            if (dot) dot.style.background = '#f0ad4e';
            if (text) text.textContent = '缓存';
            indicator.title = '正在使用缓存数据';
        } else if (status) {
            indicator.className = 'network-status online';
            if (dot) dot.style.background = '#28a745';
            if (text) text.textContent = '在线';
            indicator.title = '网络已连接';
        } else {
            indicator.className = 'network-status offline';
            if (dot) dot.style.background = '#dc3545';
            if (text) text.textContent = '离线';
            indicator.title = '网络已断开，正在使用离线缓存';
        }
    },

    /**
     * 显示离线提示
     */
    showOfflineNotice() {
        const existing = document.getElementById('offline-notice');
        if (existing) return;

        const notice = document.createElement('div');
        notice.id = 'offline-notice';
        notice.className = 'offline-notice';
        notice.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
            <span>您当前处于离线状态，正在加载缓存内容</span>
            <button onclick="this.parentElement.remove()" class="offline-notice-close">×</button>
        `;
        document.body.appendChild(notice);

        // 3秒后自动消失
        setTimeout(() => {
            if (notice.parentElement) {
                notice.style.opacity = '0';
                notice.style.transform = 'translateY(-100%)';
                setTimeout(() => notice.remove(), 300);
            }
        }, 5000);
    },

    /**
     * 注册 Service Worker
     */
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(reg => {
                console.log('SW 注册成功:', reg.scope);
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            if (typeof showNotification === 'function') {
                                showNotification('网站有新版本可用，请关闭所有标签页后重新打开', 'info');
                            }
                        }
                    });
                });
            }).catch(err => {
                console.warn('SW 注册失败:', err);
            });

            // 离线时也尝试注册
            navigator.serviceWorker.ready.then(() => {
                console.log('SW 已就绪');
            });
        }
    }
};

// 网络状态初始化
document.addEventListener('DOMContentLoaded', () => {
    if (typeof offlineStorage !== 'undefined') {
        offlineStorage.initNetworkListener();
        offlineStorage.registerServiceWorker();
    }
});
