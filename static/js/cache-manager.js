/**
 * 缓存管理工具
 * 提供缓存统计、清除等功能，在About页面中以Modal形式展示
 */

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

/**
 * 格式化时间
 */
function formatTime(timestamp) {
    if (!timestamp) return '无';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

/**
 * 打开缓存管理器
 */
function showCacheManager() {
    // 移除已存在的缓存管理器
    const existing = document.getElementById('cache-manager-modal');
    if (existing) existing.remove();

    // 获取缓存统计信息
    const offlineStats = typeof offlineStorage !== 'undefined' ? offlineStorage.getCacheStats() : { postCount: 0, totalSize: 0, postSize: 0, listSize: 0, lastUpdate: null };
    const historyStats = typeof postHistory !== 'undefined' ? postHistory.getCacheStats() : { count: 0, size: 0, lastUpdate: null };

    // 总大小
    const totalSize = (offlineStats.totalSize || 0) + (historyStats.size || 0);
    const totalCount = (offlineStats.postCount || 0) + (historyStats.count || 0);

    // 创建Modal
    const modal = document.createElement('div');
    modal.id = 'cache-manager-modal';
    modal.className = 'cache-manager-overlay';
    modal.innerHTML = `
        <div class="cache-manager-modal">
            <div class="cache-manager-header">
                <h2>
                    <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19 10V8c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v2c-1.1 0-2 .9-2 2v6h2v-2h14v2h2v-6c0-1.1-.9-2-2-2zm-2 0H7V8h10v2zM5 16v-4h14v4H5z"/></svg>
                    缓存管理器
                </h2>
                <button onclick="closeCacheManager()" class="cache-manager-close" title="关闭">
                    <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>

            <div class="cache-manager-body">
                <!-- 概览 -->
                <div class="cache-summary">
                    <div class="cache-summary-card">
                        <div class="cache-summary-icon" style="background: #e8f5e9; color: #2e7d32;">
                            <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M21 18v1c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                        </div>
                        <div class="cache-summary-info">
                            <span class="cache-summary-label">总缓存</span>
                            <span class="cache-summary-value">${formatSize(totalSize)}</span>
                            <span class="cache-summary-sub">${totalCount} 个条目</span>
                        </div>
                    </div>
                    <div class="cache-summary-card">
                        <div class="cache-summary-icon" style="background: #fff3e0; color: #e65100;">
                            <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                        </div>
                        <div class="cache-summary-info">
                            <span class="cache-summary-label">缓存限制</span>
                            <span class="cache-summary-value">${typeof CONFIG !== 'undefined' && CONFIG.cache ? CONFIG.cache.max_size_mb : 3} MB</span>
                            <span class="cache-summary-sub">离线文章缓存上限</span>
                        </div>
                    </div>
                </div>

                <!-- 离线文章缓存详情 -->
                <div class="cache-section">
                    <div class="cache-section-header">
                        <h3>
                            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 10V8c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v2c-1.1 0-2 .9-2 2v6h2v-2h14v2h2v-6c0-1.1-.9-2-2-2zm-2 0H7V8h10v2zM5 16v-4h14v4H5z"/></svg>
                            离线文章缓存
                        </h3>
                        <button onclick="clearOfflineCache()" class="cache-btn clear-btn" title="清除离线缓存">
                            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                            清除离线缓存
                        </button>
                    </div>
                    <div class="cache-details">
                        <div class="cache-detail-item">
                            <span class="cache-detail-label">缓存文章数</span>
                            <span class="cache-detail-value">${offlineStats.postCount || 0} 篇</span>
                        </div>
                        <div class="cache-detail-item">
                            <span class="cache-detail-label">文章缓存大小</span>
                            <span class="cache-detail-value">${formatSize(offlineStats.postSize || 0)}</span>
                        </div>
                        <div class="cache-detail-item">
                            <span class="cache-detail-label">列表缓存大小</span>
                            <span class="cache-detail-value">${formatSize(offlineStats.listSize || 0)}</span>
                        </div>
                        <div class="cache-detail-item">
                            <span class="cache-detail-label">最后更新</span>
                            <span class="cache-detail-value">${formatTime(offlineStats.lastUpdate)}</span>
                        </div>
                    </div>
                    <div class="cache-note">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                        <span>已读文章自动缓存，最多保存 ${typeof CONFIG !== 'undefined' && CONFIG.cache ? CONFIG.cache.max_size_mb : 3}MB，超过 ${typeof CONFIG !== 'undefined' && CONFIG.cache ? CONFIG.cache.max_age_days : 30} 天自动清理</span>
                    </div>
                </div>

                <!-- 历史记录缓存详情 -->
                <div class="cache-section">
                    <div class="cache-section-header">
                        <h3>
                            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M13 3a9 9 0 0 0-9 9H1l4 3.99L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.25 2.52.77-1.28-3.52-2.09V8H12z"/></svg>
                            历史记录缓存
                        </h3>
                        <button onclick="clearHistoryCache()" class="cache-btn clear-btn" title="清除历史记录缓存">
                            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                            清除历史缓存
                        </button>
                    </div>
                    <div class="cache-details">
                        <div class="cache-detail-item">
                            <span class="cache-detail-label">缓存条目</span>
                            <span class="cache-detail-value">${historyStats.count || 0} 条</span>
                        </div>
                        <div class="cache-detail-item">
                            <span class="cache-detail-label">缓存大小</span>
                            <span class="cache-detail-value">${formatSize(historyStats.size || 0)}</span>
                        </div>
                        <div class="cache-detail-item">
                            <span class="cache-detail-label">最后更新</span>
                            <span class="cache-detail-value">${formatTime(historyStats.lastUpdate)}</span>
                        </div>
                    </div>
                    <div class="cache-note">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                        <span>文章编辑历史自动缓存，最多保存 ${typeof CONFIG !== 'undefined' && CONFIG.cache ? CONFIG.cache.max_age_days : 30} 天</span>
                    </div>
                </div>

                <!-- 清除所有缓存 -->
                <div class="cache-section cache-section-danger">
                    <div class="cache-section-header">
                        <h3 style="color: #dc3545;">
                            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15 4V3c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5zM9.5 18H8V9h1.5v9zm3.25 0h-1.5V9h1.5v9zm3.25 0h-1.5V9h1.5v9z"/></svg>
                            清除所有缓存
                        </h3>
                        <button onclick="clearAllCaches()" class="cache-btn danger-btn" title="清除所有缓存">
                            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                            清除全部
                        </button>
                    </div>
                    <p class="cache-danger-text">清除所有本地缓存数据，包括离线文章和历史记录。此操作不可撤销。</p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 显示动画
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeCacheManager();
        }
    });

    // ESC键关闭
    document.addEventListener('keydown', _cacheManagerEscHandler);
}

/**
 * ESC关闭缓存管理器的事件处理器
 */
function _cacheManagerEscHandler(e) {
    if (e.key === 'Escape') {
        closeCacheManager();
    }
}

/**
 * 关闭缓存管理器
 */
function closeCacheManager() {
    const modal = document.getElementById('cache-manager-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
    document.removeEventListener('keydown', _cacheManagerEscHandler);
}

/**
 * 清除离线缓存
 */
function clearOfflineCache() {
    if (!confirm('确定要清除所有离线文章缓存吗？')) return;

    const success = typeof offlineStorage !== 'undefined' && offlineStorage.clearPostCache();
    if (success) {
        // 刷新缓存管理器
        closeCacheManager();
        setTimeout(() => showCacheManager(), 100);
        if (typeof showNotification === 'function') {
            showNotification('离线缓存已清除', 'success');
        } else {
            alert('离线缓存已清除');
        }
    } else {
        if (typeof showNotification === 'function') {
            showNotification('清除离线缓存失败', 'error');
        }
    }
}

/**
 * 清除历史记录缓存
 */
function clearHistoryCache() {
    if (!confirm('确定要清除所有历史记录缓存吗？')) return;

    const success = typeof postHistory !== 'undefined' && postHistory.clearAllCache();
    if (success) {
        closeCacheManager();
        setTimeout(() => showCacheManager(), 100);
        if (typeof showNotification === 'function') {
            showNotification('历史记录缓存已清除', 'success');
        } else {
            alert('历史记录缓存已清除');
        }
    } else {
        if (typeof showNotification === 'function') {
            showNotification('清除历史记录缓存失败', 'error');
        }
    }
}

/**
 * 清除所有缓存
 */
function clearAllCaches() {
    if (!confirm('⚠️ 确定要清除所有缓存吗？\n\n这将删除所有离线文章和历史记录缓存，但不会影响已登录状态。\n\n此操作不可撤销！')) return;

    let allSuccess = true;

    if (typeof offlineStorage !== 'undefined') {
        allSuccess = offlineStorage.clearAllCache() && allSuccess;
    }
    if (typeof postHistory !== 'undefined') {
        allSuccess = postHistory.clearAllCache() && allSuccess;
    }

    if (allSuccess) {
        closeCacheManager();
        if (typeof showNotification === 'function') {
            showNotification('所有缓存已清除', 'success');
        } else {
            alert('所有缓存已清除');
        }
    } else {
        if (typeof showNotification === 'function') {
            showNotification('清除缓存时发生错误', 'error');
        }
    }
}
