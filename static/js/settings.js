/**
 * 设置页面逻辑
 * 管理字体、缓存偏好、显示模式、调试模式、右键菜单、强制刷新等功能
 */

// ===== 设置存储键名 =====
const SETTINGS_KEYS = {
    FONT_FAMILY: 'settings_font_family',
    FONT_SIZE: 'settings_font_size',
    CACHE_PREF: 'settings_cache_pref',
    DEBUG_MODE: 'settings_debug_mode',
    CONTEXT_MENU: 'settings_context_menu',
    THEME_MODE: 'settings_theme_mode',
    BORDER_RADIUS: 'settings_border_radius',
    ACCENT_COLOR: 'settings_accent_color',
    SMOOTH_SCROLL: 'settings_smooth_scroll',
    POST_LAYOUT: 'settings_post_layout',
    DEBUG_NETWORK: 'settings_debug_network',
    DEBUG_PERFORMANCE: 'settings_debug_performance',
};

// ===== 默认设置 =====
const SETTINGS_DEFAULTS = {
    FONT_FAMILY: "'Inter', 'PingFang SC', sans-serif",
    FONT_SIZE: '100',
    CACHE_PREF: 'auto',
    DEBUG_MODE: 'false',
    CONTEXT_MENU: 'true',
    THEME_MODE: 'manual',
    BORDER_RADIUS: 'rounded',
    ACCENT_COLOR: '#0a84ff',
    SMOOTH_SCROLL: 'true',
    POST_LAYOUT: 'grid',
    DEBUG_NETWORK: 'false',
    DEBUG_PERFORMANCE: 'false',
};

// ===== 工具函数 =====
function settingsGet(key) {
    const val = localStorage.getItem(key);
    return val !== null ? val : SETTINGS_DEFAULTS[key];
}

function settingsSet(key, value) {
    localStorage.setItem(key, value);
}

// ===== 打开/关闭设置 =====
async function openSettings(pushState = true) {
    const overlay = document.getElementById('settings-overlay');
    if (!overlay) return;

    if (overlay.innerHTML.trim() === "") {
        try {
            const resp = await fetch('/components/settings.html');
            if (!resp.ok) throw new Error("无法读取 settings.html");
            overlay.innerHTML = await resp.text();
        } catch (e) {
            console.error(e);
            if (typeof showNotification === 'function') showNotification("加载设置失败", "error");
            return;
        }
    }

    const content = document.getElementById('settings-content');
    if (!content) return;

    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        content.classList.add('show');
    }, 50);

    // 加载已保存的设置
    settingsLoadState();
    // 更新缓存统计
    settingsUpdateCacheStats();

    if (pushState) {
        history.pushState({ page: 'settings' }, '');
    }
}

function closeSettings() {
    const overlay = document.getElementById('settings-overlay');
    const content = document.getElementById('settings-content');
    if (!content) return;

    content.classList.remove('show');
    setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);

    // 退出时自动收起调试面板
    const debugPanel = document.getElementById('settings-debug-panel');
    if (debugPanel) {
        debugPanel.style.display = 'none';
    }

    // 停止性能监控
    if (window._fpsInterval) {
        clearInterval(window._fpsInterval);
        window._fpsInterval = null;
    }
}

// ===== 加载已保存设置到 UI =====
function settingsLoadState() {
    // 深色模式
    const darkModeCheckbox = document.getElementById('settings-dark-mode');
    if (darkModeCheckbox) {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        darkModeCheckbox.checked = isDark;
    }

    // 主题模式
    const themeMode = settingsGet(SETTINGS_KEYS.THEME_MODE);
    document.querySelectorAll('#settings-content .segmented-option[data-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === themeMode);
    });

    // 卡片圆角
    const borderRadius = settingsGet(SETTINGS_KEYS.BORDER_RADIUS);
    document.querySelectorAll('#settings-content .segmented-option[data-radius]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.radius === borderRadius);
    });

    // 强调色
    const accentColor = settingsGet(SETTINGS_KEYS.ACCENT_COLOR);
    document.querySelectorAll('#settings-content .color-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === accentColor);
    });

    // 字体
    const fontSelect = document.getElementById('settings-font-family');
    if (fontSelect) {
        const savedFont = settingsGet(SETTINGS_KEYS.FONT_FAMILY);
        for (let option of fontSelect.options) {
            if (option.value === savedFont) {
                fontSelect.value = savedFont;
                break;
            }
        }
    }

    // 字体大小
    const fontSizeInput = document.getElementById('settings-font-size');
    if (fontSizeInput) {
        fontSizeInput.value = settingsGet(SETTINGS_KEYS.FONT_SIZE);
        const label = document.getElementById('settings-font-size-label');
        if (label) label.textContent = fontSizeInput.value + '%';
    }

    // 缓存偏好
    const cacheSelect = document.getElementById('settings-cache-pref');
    if (cacheSelect) {
        cacheSelect.value = settingsGet(SETTINGS_KEYS.CACHE_PREF);
    }

    // 右键菜单
    const contextMenuCheckbox = document.getElementById('settings-context-menu');
    if (contextMenuCheckbox) {
        contextMenuCheckbox.checked = settingsGet(SETTINGS_KEYS.CONTEXT_MENU) === 'true';
    }

    // 平滑滚动
    const smoothScrollCheckbox = document.getElementById('settings-smooth-scroll');
    if (smoothScrollCheckbox) {
        smoothScrollCheckbox.checked = settingsGet(SETTINGS_KEYS.SMOOTH_SCROLL) === 'true';
    }

    // 文章列表布局
    const postLayout = settingsGet(SETTINGS_KEYS.POST_LAYOUT);
    document.querySelectorAll('#settings-content .segmented-option[data-layout]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layout === postLayout);
    });

    // 调试模式
    const debugCheckbox = document.getElementById('settings-debug-mode');
    if (debugCheckbox) {
        debugCheckbox.checked = settingsGet(SETTINGS_KEYS.DEBUG_MODE) === 'true';
        if (debugCheckbox.checked) {
            document.getElementById('settings-debug-sub-options').style.display = 'block';
            settingsToggleDebug();
        }
    }

    // 调试子选项
    const debugNetworkCheckbox = document.getElementById('settings-debug-network');
    if (debugNetworkCheckbox) {
        debugNetworkCheckbox.checked = settingsGet(SETTINGS_KEYS.DEBUG_NETWORK) === 'true';
    }
    const debugPerfCheckbox = document.getElementById('settings-debug-performance');
    if (debugPerfCheckbox) {
        debugPerfCheckbox.checked = settingsGet(SETTINGS_KEYS.DEBUG_PERFORMANCE) === 'true';
    }
}

// ===== 显示模式 =====
function settingsToggleDarkMode() {
    if (typeof toggleDarkMode === 'function') {
        toggleDarkMode();
    } else {
        const body = document.body;
        const isDark = body.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }
    // 同步图标状态
    if (typeof updateThemeIcon === 'function') updateThemeIcon();
}

function settingsSetThemeMode(mode) {
    settingsSet(SETTINGS_KEYS.THEME_MODE, mode);

    // 更新 UI 状态
    document.querySelectorAll('#settings-content .segmented-option[data-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'system') {
        // 跟随系统主题
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const newTheme = prefersDark ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        if (typeof updateThemeIcon === 'function') updateThemeIcon();

        // 监听系统主题变化
        if (window._themeMediaListener) {
            window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', window._themeMediaListener);
        }
        window._themeMediaListener = (e) => {
            const theme = e.matches ? 'dark' : 'light';
            document.body.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            if (typeof updateThemeIcon === 'function') updateThemeIcon();
        };
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', window._themeMediaListener);

        if (typeof showNotification === 'function') {
            showNotification('已切换为跟随系统主题', 'info');
        }
    } else {
        // 移除系统主题监听
        if (window._themeMediaListener) {
            window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', window._themeMediaListener);
            window._themeMediaListener = null;
        }

        const newTheme = mode;
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        if (typeof updateThemeIcon === 'function') updateThemeIcon();

        if (typeof showNotification === 'function') {
            showNotification(mode === 'dark' ? '已切换为深色模式' : '已切换为浅色模式', 'info');
        }
    }

    // 同步深色模式开关
    const darkModeCheckbox = document.getElementById('settings-dark-mode');
    if (darkModeCheckbox) {
        darkModeCheckbox.checked = document.body.getAttribute('data-theme') === 'dark';
    }
}

function settingsSetBorderRadius(radius) {
    settingsSet(SETTINGS_KEYS.BORDER_RADIUS, radius);

    // 更新 UI 状态
    document.querySelectorAll('#settings-content .segmented-option[data-radius]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.radius === radius);
    });

    // 应用到页面
    document.documentElement.style.setProperty('--card-radius',
        radius === 'square' ? '4px' :
        radius === 'rounded' ? '12px' :
        radius === 'pill' ? '24px' : '12px'
    );

    if (typeof showNotification === 'function') {
        const labels = { square: '直角', rounded: '圆角', pill: '超大圆角' };
        showNotification(`卡片圆角已切换为「${labels[radius] || radius}」`, 'info');
    }
}

function settingsSetAccentColor(color) {
    settingsSet(SETTINGS_KEYS.ACCENT_COLOR, color);

    // 更新 UI 状态
    document.querySelectorAll('#settings-content .color-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === color);
    });

    // 应用到页面
    document.documentElement.style.setProperty('--accent', color);

    // 计算 RGB 值用于透明度
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);

    if (typeof showNotification === 'function') {
        showNotification('强调色已更新', 'success');
    }
}

function settingsPickCustomColor() {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = settingsGet(SETTINGS_KEYS.ACCENT_COLOR);
    input.addEventListener('input', (e) => {
        settingsSetAccentColor(e.target.value);
    });
    input.click();
}

// ===== 字体设置 =====
function settingsChangeFont() {
    const select = document.getElementById('settings-font-family');
    if (!select) return;
    const font = select.value;
    document.body.style.fontFamily = font;
    settingsSet(SETTINGS_KEYS.FONT_FAMILY, font);
    if (typeof showNotification === 'function') {
        showNotification('字体已更新', 'success');
    }
}

function settingsChangeFontSize() {
    const input = document.getElementById('settings-font-size');
    if (!input) return;
    const size = parseInt(input.value);
    const label = document.getElementById('settings-font-size-label');
    if (label) label.textContent = size + '%';
    document.documentElement.style.fontSize = size + '%';
    settingsSet(SETTINGS_KEYS.FONT_SIZE, size.toString());
}

// ===== 功能偏好 =====
function settingsToggleContextMenu() {
    const checkbox = document.getElementById('settings-context-menu');
    if (!checkbox) return;
    const enabled = checkbox.checked;
    settingsSet(SETTINGS_KEYS.CONTEXT_MENU, enabled.toString());

    if (typeof applyContextMenuSetting === 'function') {
        applyContextMenuSetting(enabled);
    }

    if (typeof showNotification === 'function') {
        showNotification(enabled ? '右键菜单已启用' : '右键菜单已禁用', 'info');
    }
}

function settingsToggleSmoothScroll() {
    const checkbox = document.getElementById('settings-smooth-scroll');
    if (!checkbox) return;
    const enabled = checkbox.checked;
    settingsSet(SETTINGS_KEYS.SMOOTH_SCROLL, enabled.toString());

    document.documentElement.style.scrollBehavior = enabled ? 'smooth' : 'auto';

    if (typeof showNotification === 'function') {
        showNotification(enabled ? '平滑滚动已启用' : '平滑滚动已禁用', 'info');
    }
}

function settingsSetLayout(layout) {
    settingsSet(SETTINGS_KEYS.POST_LAYOUT, layout);

    // 更新 UI 状态
    document.querySelectorAll('#settings-content .segmented-option[data-layout]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layout === layout);
    });

    // 应用到文章列表
    const container = document.getElementById('post-list-container');
    if (container) {
        container.className = container.className
            .replace(/post-layout-\w+/g, '')
            .trim();
        container.classList.add('post-layout-' + layout);
    }

    if (typeof showNotification === 'function') {
        const labels = { grid: '网格', list: '列表', compact: '紧凑' };
        showNotification(`文章列表布局已切换为「${labels[layout] || layout}」`, 'info');
    }
}

// ===== 缓存偏好 =====
function settingsChangeCachePref() {
    const select = document.getElementById('settings-cache-pref');
    if (!select) return;
    const pref = select.value;
    settingsSet(SETTINGS_KEYS.CACHE_PREF, pref);

    if (typeof offlineStorage !== 'undefined' && typeof offlineStorage.setCachePref === 'function') {
        offlineStorage.setCachePref(pref);
    }

    const messages = {
        'auto': '已设置为智能缓存模式',
        'all': '已设置为预缓存所有文章',
        'onread': '已设置为仅缓存已读文章',
        'off': '已禁用离线缓存'
    };
    if (typeof showNotification === 'function') {
        showNotification(messages[pref] || '缓存偏好已更新', 'info');
    }
}

// ===== 缓存管理（内联到设置页） =====

/**
 * 格式化文件大小
 */
function settingsFormatSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

/**
 * 格式化时间
 */
function settingsFormatTime(timestamp) {
    if (!timestamp) return '无';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

/**
 * 更新缓存统计信息（内联显示）
 */
function settingsUpdateCacheStats() {
    const body = document.getElementById('settings-cache-body');
    if (!body) return;

    const offlineStats = typeof offlineStorage !== 'undefined'
        ? offlineStorage.getCacheStats()
        : { postCount: 0, totalSize: 0, postSize: 0, listSize: 0, lastUpdate: null };

    const historyStats = typeof postHistory !== 'undefined'
        ? (typeof postHistory.getCacheStats === 'function' ? postHistory.getCacheStats() : { count: 0, size: 0, lastUpdate: null })
        : { count: 0, size: 0, lastUpdate: null };

    const totalSize = (offlineStats.totalSize || 0) + (historyStats.size || 0);
    const totalCount = (offlineStats.postCount || 0) + (historyStats.count || 0);

    body.innerHTML = `
        <div class="settings-cache-summary" style="display: flex; gap: 12px; padding: 12px 18px; flex-wrap: wrap;">
            <div class="settings-cache-card" style="flex: 1; min-width: 120px; background: var(--selection-bg); border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 1.1rem; font-weight: 700; color: var(--accent);">${settingsFormatSize(totalSize)}</div>
                <div style="font-size: 0.72rem; color: var(--text-soft); margin-top: 4px;">总缓存大小</div>
            </div>
            <div class="settings-cache-card" style="flex: 1; min-width: 120px; background: var(--selection-bg); border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 1.1rem; font-weight: 700; color: var(--accent);">${totalCount}</div>
                <div style="font-size: 0.72rem; color: var(--text-soft); margin-top: 4px;">缓存条目</div>
            </div>
            <div class="settings-cache-card" style="flex: 1; min-width: 120px; background: var(--selection-bg); border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 0.85rem; font-weight: 700; color: var(--accent);">3 MB</div>
                <div style="font-size: 0.72rem; color: var(--text-soft); margin-top: 4px;">缓存上限</div>
            </div>
        </div>
        <div class="settings-cache-details" style="padding: 0 18px 8px;">
            <div class="settings-cache-row" style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.8rem; border-bottom: 1px solid var(--line);">
                <span style="color: var(--text-soft);">离线文章</span>
                <span style="font-weight: 600;">${offlineStats.postCount || 0} 篇 / ${settingsFormatSize(offlineStats.postSize || 0)}</span>
            </div>
            <div class="settings-cache-row" style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.8rem; border-bottom: 1px solid var(--line);">
                <span style="color: var(--text-soft);">列表缓存</span>
                <span style="font-weight: 600;">${settingsFormatSize(offlineStats.listSize || 0)}</span>
            </div>
            <div class="settings-cache-row" style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.8rem; border-bottom: 1px solid var(--line);">
                <span style="color: var(--text-soft);">历史记录</span>
                <span style="font-weight: 600;">${historyStats.count || 0} 条 / ${settingsFormatSize(historyStats.size || 0)}</span>
            </div>
            <div class="settings-cache-row" style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.8rem;">
                <span style="color: var(--text-soft);">最后更新</span>
                <span style="font-weight: 600; font-size: 0.78rem;">${settingsFormatTime(offlineStats.lastUpdate || historyStats.lastUpdate)}</span>
            </div>
        </div>
        <div class="settings-cache-actions" style="display: flex; gap: 8px; padding: 8px 18px 14px; flex-wrap: wrap;">
            <button class="settings-btn" onclick="settingsClearOfflineCache()" style="flex: 1;">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                清除离线缓存
            </button>
            <button class="settings-btn" onclick="settingsClearHistoryCache()" style="flex: 1;">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                清除历史缓存
            </button>
            <button class="settings-btn settings-btn-danger" onclick="settingsClearAllCaches()" style="flex: 1;">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15 4V3c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5zM9.5 18H8V9h1.5v9zm3.25 0h-1.5V9h1.5v9zm3.25 0h-1.5V9h1.5v9z"/></svg>
                清除全部
            </button>
        </div>
        <div class="settings-cache-note" style="padding: 0 18px 12px; font-size: 0.72rem; color: var(--text-soft); display: flex; align-items: center; gap: 6px;">
            <svg viewBox="0 0 24 24" width="14" height="14" style="flex-shrink: 0;"><path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
            <span>已读文章自动缓存，最多保存 3MB，超过 30 天自动清理</span>
        </div>
    `;
}

/**
 * 清除离线缓存
 */
function settingsClearOfflineCache() {
    if (!confirm('确定要清除所有离线文章缓存吗？')) return;
    const success = typeof offlineStorage !== 'undefined' && offlineStorage.clearPostCache();
    if (success) {
        settingsUpdateCacheStats();
        if (typeof showNotification === 'function') {
            showNotification('离线缓存已清除', 'success');
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
function settingsClearHistoryCache() {
    if (!confirm('确定要清除所有历史记录缓存吗？')) return;
    const success = typeof postHistory !== 'undefined' && postHistory.clearAllCache();
    if (success) {
        settingsUpdateCacheStats();
        if (typeof showNotification === 'function') {
            showNotification('历史记录缓存已清除', 'success');
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
function settingsClearAllCaches() {
    if (!confirm('⚠️ 确定要清除所有缓存吗？\n\n这将删除所有离线文章和历史记录缓存，但不会影响已登录状态。\n\n此操作不可撤销！')) return;

    let allSuccess = true;
    if (typeof offlineStorage !== 'undefined') {
        allSuccess = offlineStorage.clearAllCache() && allSuccess;
    }
    if (typeof postHistory !== 'undefined') {
        allSuccess = postHistory.clearAllCache() && allSuccess;
    }

    if (allSuccess) {
        settingsUpdateCacheStats();
        if (typeof showNotification === 'function') {
            showNotification('所有缓存已清除', 'success');
        }
    } else {
        if (typeof showNotification === 'function') {
            showNotification('清除缓存时发生错误', 'error');
        }
    }
}

// ===== 调试模式 =====
function settingsToggleDebug() {
    const checkbox = document.getElementById('settings-debug-mode');
    const panel = document.getElementById('settings-debug-panel');
    const subOptions = document.getElementById('settings-debug-sub-options');
    if (!checkbox || !panel || !subOptions) return;

    const enabled = checkbox.checked;
    settingsSet(SETTINGS_KEYS.DEBUG_MODE, enabled.toString());

    subOptions.style.display = enabled ? 'block' : 'none';

    if (enabled) {
        panel.style.display = 'block';
        settingsUpdateDebugInfo();
        // 启动定时更新
        if (window._debugInterval) clearInterval(window._debugInterval);
        window._debugInterval = setInterval(settingsUpdateDebugInfo, 3000);
        if (typeof showNotification === 'function') {
            showNotification('调试模式已启用', 'info');
        }
    } else {
        panel.style.display = 'none';
        if (window._debugInterval) {
            clearInterval(window._debugInterval);
            window._debugInterval = null;
        }
        // 停止性能监控
        if (window._fpsInterval) {
            clearInterval(window._fpsInterval);
            window._fpsInterval = null;
        }
    }
}

function settingsToggleDebugNetwork() {
    const checkbox = document.getElementById('settings-debug-network');
    if (!checkbox) return;
    const enabled = checkbox.checked;
    settingsSet(SETTINGS_KEYS.DEBUG_NETWORK, enabled.toString());

    if (enabled) {
        // 拦截 fetch 记录日志
        if (!window._originalFetch) {
            window._originalFetch = window.fetch.bind(window);
            window.fetch = function(...args) {
                console.log('[Network]', args[0], args[1] || {});
                return window._originalFetch(...args).then(resp => {
                    console.log('[Network] Response:', resp.status, resp.url);
                    return resp;
                }).catch(err => {
                    console.error('[Network] Error:', err);
                    throw err;
                });
            };
        }
        if (typeof showNotification === 'function') {
            showNotification('网络请求日志已启用，请查看控制台', 'info');
        }
    } else {
        // 恢复原始 fetch
        if (window._originalFetch) {
            window.fetch = window._originalFetch;
            window._originalFetch = null;
        }
    }
}

function settingsToggleDebugPerformance() {
    const checkbox = document.getElementById('settings-debug-performance');
    if (!checkbox) return;
    const enabled = checkbox.checked;
    settingsSet(SETTINGS_KEYS.DEBUG_PERFORMANCE, enabled.toString());

    if (enabled) {
        // 启动 FPS 监控
        if (window._fpsInterval) clearInterval(window._fpsInterval);
        let frameCount = 0;
        let lastFpsTime = performance.now();

        function countFrame() {
            frameCount++;
        }
        window._fpsFrameCallback = countFrame;

        window._fpsInterval = setInterval(() => {
            const now = performance.now();
            const delta = now - lastFpsTime;
            const fps = Math.round(frameCount / (delta / 1000));
            const fpsEl = document.getElementById('debug-fps');
            if (fpsEl) {
                fpsEl.textContent = fps + ' FPS';
                fpsEl.style.color = fps < 30 ? '#dc3545' : fps < 50 ? '#ff9800' : '#4caf50';
            }
            frameCount = 0;
            lastFpsTime = now;
        }, 1000);

        // 使用 requestAnimationFrame 统计帧数
        if (window._fpsRAF) cancelAnimationFrame(window._fpsRAF);
        function fpsLoop() {
            if (window._fpsFrameCallback) window._fpsFrameCallback();
            window._fpsRAF = requestAnimationFrame(fpsLoop);
        }
        window._fpsRAF = requestAnimationFrame(fpsLoop);

        if (typeof showNotification === 'function') {
            showNotification('性能监控已启用', 'info');
        }
    } else {
        // 停止 FPS 监控
        if (window._fpsInterval) {
            clearInterval(window._fpsInterval);
            window._fpsInterval = null;
        }
        if (window._fpsRAF) {
            cancelAnimationFrame(window._fpsRAF);
            window._fpsRAF = null;
        }
        window._fpsFrameCallback = null;
        const fpsEl = document.getElementById('debug-fps');
        if (fpsEl) fpsEl.textContent = '-';
    }
}

function settingsUpdateDebugInfo() {
    // 页面加载时间
    const loadTimeEl = document.getElementById('debug-load-time');
    if (loadTimeEl && window.performance) {
        const navEntry = performance.getEntriesByType('navigation')[0];
        if (navEntry) {
            loadTimeEl.textContent = (navEntry.loadEventEnd - navEntry.startTime).toFixed(0) + ' ms';
        } else {
            const timing = performance.timing;
            if (timing) {
                loadTimeEl.textContent = (timing.loadEventEnd - timing.navigationStart) + ' ms';
            }
        }
    }

    // 内存使用
    const memoryEl = document.getElementById('debug-memory');
    if (memoryEl && window.performance && performance.memory) {
        const usedMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
        const totalMB = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(0);
        memoryEl.textContent = usedMB + ' MB / ' + totalMB + ' MB';
    } else if (memoryEl) {
        memoryEl.textContent = 'N/A';
    }

    // 文章缓存数
    const postCountEl = document.getElementById('debug-post-count');
    if (postCountEl) {
        const count = (typeof allIssues !== 'undefined' && allIssues) ? allIssues.length : 0;
        postCountEl.textContent = count + ' 篇';
    }

    // LocalStorage 大小
    const storageEl = document.getElementById('debug-storage-size');
    if (storageEl) {
        let totalBytes = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalBytes += (localStorage[key].length + key.length) * 2;
            }
        }
        if (totalBytes > 1024 * 1024) {
            storageEl.textContent = (totalBytes / (1024 * 1024)).toFixed(2) + ' MB';
        } else if (totalBytes > 1024) {
            storageEl.textContent = (totalBytes / 1024).toFixed(1) + ' KB';
        } else {
            storageEl.textContent = totalBytes + ' B';
        }
    }

    // Service Worker 状态
    const swEl = document.getElementById('debug-sw-status');
    if (swEl) {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(reg => {
                if (reg) {
                    swEl.textContent = reg.active ? '已激活 ✓' : '注册中...';
                } else {
                    swEl.textContent = '未注册';
                }
            }).catch(() => {
                swEl.textContent = '不可用';
            });
        } else {
            swEl.textContent = '不支持';
        }
    }

    // 网络状态
    const networkEl = document.getElementById('debug-network-status');
    if (networkEl) {
        const online = navigator.onLine;
        networkEl.textContent = online ? '在线 ✓' : '离线 ✗';
        networkEl.style.color = online ? '#4caf50' : '#dc3545';
    }

    // 版本号
    const versionEl = document.getElementById('debug-version');
    if (versionEl) {
        const sidebarVersion = document.getElementById('sidebar-version');
        versionEl.textContent = sidebarVersion ? sidebarVersion.textContent : 'v1.0';
    }
}

/**
 * 导出调试信息为 JSON
 */
function settingsExportDebugInfo() {
    const debugInfo = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        theme: document.body.getAttribute('data-theme'),
        language: navigator.language,
        online: navigator.onLine,
        cookieEnabled: navigator.cookieEnabled,
        serviceWorker: 'serviceWorker' in navigator ? 'supported' : 'unsupported',
        localStorage: {
            keys: Object.keys(localStorage).length,
            size: settingsFormatSize(JSON.stringify(localStorage).length * 2)
        },
        screen: {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth
        },
        performance: {
            memory: window.performance && performance.memory
                ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + ' MB'
                : 'N/A'
        }
    };

    const blob = new Blob([JSON.stringify(debugInfo, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-info-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    if (typeof showNotification === 'function') {
        showNotification('调试信息已导出', 'success');
    }
}

/**
 * 复制调试信息到剪贴板
 */
function settingsCopyDebugInfo() {
    const debugLines = [];
    document.querySelectorAll('.debug-info-row').forEach(row => {
        const label = row.querySelector('.debug-info-label');
        const value = row.querySelector('.debug-info-value');
        if (label && value) {
            debugLines.push(`${label.textContent}: ${value.textContent}`);
        }
    });
    debugLines.push(`User Agent: ${navigator.userAgent}`);
    debugLines.push(`导出时间: ${new Date().toLocaleString('zh-CN')}`);

    const text = debugLines.join('\n');

    navigator.clipboard.writeText(text).then(() => {
        if (typeof showNotification === 'function') {
            showNotification('调试信息已复制到剪贴板', 'success');
        }
    }).catch(() => {
        if (typeof showNotification === 'function') {
            showNotification('复制失败', 'error');
        }
    });
}

// ===== 维护工具 =====
/**
 * 强制刷新 - 清除所有缓存并重新加载
 */
async function settingsForceRefresh() {
    if (!confirm('⚠️ 确定要强制刷新吗？\n\n这将清除所有 Service Worker 缓存和本地存储的缓存数据，然后重新加载页面。\n\n已登录状态和设置偏好不会受影响。')) return;

    if (typeof showNotification === 'function') {
        showNotification('正在清除缓存...', 'info');
    }

    // 显示进度反馈
    const section = document.querySelector('.settings-section-danger .settings-section-body');
    let progressBar = section.querySelector('.settings-progress-bar');
    let progressText = section.querySelector('.settings-progress-text');

    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'settings-progress-bar';
        progressBar.innerHTML = '<div class="progress-fill"></div>';
        section.appendChild(progressBar);
        progressText = document.createElement('div');
        progressText.className = 'settings-progress-text';
        progressText.textContent = '正在清除...';
        section.appendChild(progressText);
    }

    const fill = progressBar.querySelector('.progress-fill');
    fill.style.width = '0%';
    progressText.textContent = '正在清除...';
    progressBar.style.display = 'block';
    progressText.style.display = 'block';

    try {
        // 清除 SW 缓存 (25%)
        fill.style.width = '25%';
        progressText.textContent = '正在清除 Service Worker 缓存...';
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }

        // 清除离线存储缓存 (50%)
        fill.style.width = '50%';
        progressText.textContent = '正在清除离线存储...';
        if (typeof offlineStorage !== 'undefined') {
            if (typeof offlineStorage.clearAllCache === 'function') {
                offlineStorage.clearAllCache();
            } else if (typeof offlineStorage.clearPostCache === 'function') {
                offlineStorage.clearPostCache();
            }
        }

        // 清除文章列表缓存 (75%)
        fill.style.width = '75%';
        progressText.textContent = '正在清除应用缓存...';
        localStorage.removeItem('blog_posts_cache');
        localStorage.removeItem('github_stars_cache');
        localStorage.removeItem('announcement_closed');

        // 注销 Service Worker (90%)
        fill.style.width = '90%';
        progressText.textContent = '正在注销 Service Worker...';
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
        }

        fill.style.width = '100%';
        progressText.textContent = '清除完成，正在重新加载...';

        if (typeof showNotification === 'function') {
            showNotification('缓存已清除，正在重新加载...', 'success');
        }

        // 延迟重载以使通知显示
        setTimeout(() => {
            window.location.reload(true);
        }, 800);
    } catch (e) {
        console.error('强制刷新失败:', e);
        progressText.textContent = '清除失败: ' + e.message;
        if (typeof showNotification === 'function') {
            showNotification('强制刷新失败: ' + e.message, 'error');
        }
    }
}

/**
 * 清除 Service Worker 缓存
 */
async function settingsClearSWCache() {
    if (!confirm('确定要清除 Service Worker 缓存并重新注册吗？')) return;

    try {
        // 清除 Cache Storage
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }

        // 注销并重新注册
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
            // 重新注册
            try {
                await navigator.serviceWorker.register('/sw.js');
            } catch (e) {
                console.warn('Service Worker 重新注册失败:', e);
            }
        }

        if (typeof showNotification === 'function') {
            showNotification('Service Worker 缓存已清除并重新注册', 'success');
        }

        // 更新缓存统计
        settingsUpdateCacheStats();
    } catch (e) {
        console.error('清除 SW 缓存失败:', e);
        if (typeof showNotification === 'function') {
            showNotification('清除 Service Worker 缓存失败', 'error');
        }
    }
}

/**
 * 清除 LocalStorage 缓存（保留设置）
 */
function settingsClearLocalStorageCache() {
    if (!confirm('确定要清除 LocalStorage 中的缓存数据吗？\n\n设置偏好将保留，不会被清除。')) return;

    const keepKeys = ['theme', ...Object.values(SETTINGS_KEYS)];
    const additionalKeepKeys = ['gh_access_token', 'gh_user_login', 'gh_user_avatar', 'cookie-consent'];

    let clearedCount = 0;
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!keepKeys.includes(key) && !additionalKeepKeys.includes(key)) {
            localStorage.removeItem(key);
            clearedCount++;
        }
    }

    if (typeof showNotification === 'function') {
        showNotification(`已清除 ${clearedCount} 个缓存条目，设置已保留`, 'success');
    }

    // 更新缓存统计
    settingsUpdateCacheStats();
}

/**
 * 重置所有设置
 */
function settingsResetAll() {
    if (!confirm('⚠️ 确定要重置所有设置吗？\n\n这将恢复字体、缓存偏好、显示模式等所有设置为默认值。\n\n已登录状态不会受影响。')) return;

    // 清除所有设置键
    Object.values(SETTINGS_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });

    // 移除系统主题监听
    if (window._themeMediaListener) {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', window._themeMediaListener);
        window._themeMediaListener = null;
    }

    // 恢复 fetch 拦截
    if (window._originalFetch) {
        window.fetch = window._originalFetch;
        window._originalFetch = null;
    }

    // 停止性能监控
    if (window._fpsInterval) {
        clearInterval(window._fpsInterval);
        window._fpsInterval = null;
    }
    if (window._fpsRAF) {
        cancelAnimationFrame(window._fpsRAF);
        window._fpsRAF = null;
    }
    window._fpsFrameCallback = null;

    // 重置字体
    document.body.style.fontFamily = SETTINGS_DEFAULTS.FONT_FAMILY;
    document.documentElement.style.fontSize = '';

    // 重置缓存偏好
    if (typeof offlineStorage !== 'undefined' && typeof offlineStorage.setCachePref === 'function') {
        offlineStorage.setCachePref(SETTINGS_DEFAULTS.CACHE_PREF);
    }

    // 重置右键菜单
    if (typeof applyContextMenuSetting === 'function') {
        applyContextMenuSetting(true);
    }

    // 重置圆角
    document.documentElement.style.removeProperty('--card-radius');

    // 重置强调色
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-rgb');

    // 重置平滑滚动
    document.documentElement.style.scrollBehavior = '';

    // 重置布局
    const container = document.getElementById('post-list-container');
    if (container) {
        container.className = container.className.replace(/post-layout-\w+/g, '').trim();
    }

    // 重置调试模式
    const debugCheckbox = document.getElementById('settings-debug-mode');
    if (debugCheckbox) {
        debugCheckbox.checked = false;
        const panel = document.getElementById('settings-debug-panel');
        if (panel) panel.style.display = 'none';
        const subOptions = document.getElementById('settings-debug-sub-options');
        if (subOptions) subOptions.style.display = 'none';
        if (window._debugInterval) {
            clearInterval(window._debugInterval);
            window._debugInterval = null;
        }
    }

    // 重新加载 UI
    settingsLoadState();
    settingsUpdateCacheStats();

    if (typeof showNotification === 'function') {
        showNotification('所有设置已重置为默认值', 'success');
    }
}

// ===== 应用已保存设置（页面加载时调用） =====
function settingsApplySaved() {
    // 应用字体
    const savedFont = settingsGet(SETTINGS_KEYS.FONT_FAMILY);
    if (savedFont && savedFont !== SETTINGS_DEFAULTS.FONT_FAMILY) {
        document.body.style.fontFamily = savedFont;
    }

    // 应用字体大小
    const savedFontSize = settingsGet(SETTINGS_KEYS.FONT_SIZE);
    if (savedFontSize && savedFontSize !== SETTINGS_DEFAULTS.FONT_SIZE) {
        document.documentElement.style.fontSize = savedFontSize + '%';
    }

    // 应用缓存偏好
    const savedCachePref = settingsGet(SETTINGS_KEYS.CACHE_PREF);
    if (savedCachePref && savedCachePref !== SETTINGS_DEFAULTS.CACHE_PREF) {
        if (typeof offlineStorage !== 'undefined' && typeof offlineStorage.setCachePref === 'function') {
            offlineStorage.setCachePref(savedCachePref);
        }
    }

    // 应用右键菜单设置（页面加载时根据设置决定是否初始化）
    const savedContextMenu = settingsGet(SETTINGS_KEYS.CONTEXT_MENU);
    if (savedContextMenu === 'false') {
        window._contextMenuDisabled = true;
    }

    // 应用圆角
    const savedRadius = settingsGet(SETTINGS_KEYS.BORDER_RADIUS);
    if (savedRadius && savedRadius !== SETTINGS_DEFAULTS.BORDER_RADIUS) {
        document.documentElement.style.setProperty('--card-radius',
            savedRadius === 'square' ? '4px' :
            savedRadius === 'pill' ? '24px' : '12px'
        );
    }

    // 应用强调色
    const savedAccent = settingsGet(SETTINGS_KEYS.ACCENT_COLOR);
    if (savedAccent && savedAccent !== SETTINGS_DEFAULTS.ACCENT_COLOR) {
        document.documentElement.style.setProperty('--accent', savedAccent);
        const r = parseInt(savedAccent.slice(1, 3), 16);
        const g = parseInt(savedAccent.slice(3, 5), 16);
        const b = parseInt(savedAccent.slice(5, 7), 16);
        document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
    }

    // 应用平滑滚动
    const savedScroll = settingsGet(SETTINGS_KEYS.SMOOTH_SCROLL);
    if (savedScroll === 'false') {
        document.documentElement.style.scrollBehavior = 'auto';
    }

    // 应用文章列表布局
    const savedLayout = settingsGet(SETTINGS_KEYS.POST_LAYOUT);
    if (savedLayout && savedLayout !== SETTINGS_DEFAULTS.POST_LAYOUT) {
        const container = document.getElementById('post-list-container');
        if (container) {
            container.classList.add('post-layout-' + savedLayout);
        }
    }

    // 应用系统主题跟随
    const savedThemeMode = settingsGet(SETTINGS_KEYS.THEME_MODE);
    if (savedThemeMode === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = prefersDark ? 'dark' : 'light';
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // 监听系统主题变化
        window._themeMediaListener = (e) => {
            const newTheme = e.matches ? 'dark' : 'light';
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            if (typeof updateThemeIcon === 'function') updateThemeIcon();
        };
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', window._themeMediaListener);
    }
}

// ===== 在页面加载时应用设置 =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', settingsApplySaved);
} else {
    settingsApplySaved();
}

// ===== popstate 支持 =====
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page === 'settings') {
        openSettings(false);
    } else {
        closeSettings();
    }
});
