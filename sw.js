/**
 * Service Worker - 离线缓存与读取支持
 * 缓存策略: 安装时预缓存静态资源，网络优先，回退到缓存
 */
const CACHE_NAME = 'blog-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/data/config.json',
  '/static/css/style.css',
  '/static/css/main.css',
  '/static/css/sidebar.css',
  '/static/css/about.css',
  '/static/css/archive.css',
  '/static/css/post.css',
  '/static/css/publish.css',
  '/static/css/markdown.css',
  '/static/css/cookie.css',
  '/static/css/context-menu.css',
  '/static/css/history.css',
  '/static/css/settings.css',
  '/static/js/search.js',
  '/static/js/theme.js',
  '/static/js/post.js',
  '/static/js/about.js',
  '/static/js/archive.js',
  '/static/js/publish.js',
  '/static/js/history.js',
  '/static/js/offline.js',
  '/static/js/cache-manager.js',
  '/static/js/settings.js',
  '/static/js/script.js',
  '/components/about.html',
  '/components/archive.html',
  '/components/post.html',
  '/components/publish.html',
  '/components/settings.html',
  '/image/favicon.ico',
  '/image/favicon.png',
  '/rss.xml',
  '/404.html'
];

// 安装阶段 - 预缓存所有静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('SW: 部分资源缓存失败:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 激活阶段 - 清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// 网络优先策略（先网络，超时或失败则回退到缓存）
async function networkFirst(request, timeout = 5000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    
    if (response && response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      return response;
    }
    throw new Error('Response not OK');
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // 如果是导航请求，返回首页缓存
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    throw e;
  }
}

// 缓存优先策略（优先使用缓存，再网络更新）
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // 后台更新缓存
    fetch(request).then(response => {
      if (response && response.ok) {
        caches.open(CACHE_NAME).then(cache => cache.put(request, response));
      }
    }).catch(() => {});
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
    }
    return response;
  } catch (e) {
    // GitHub API 请求在离线时返回空数据标记
    if (request.url.includes('api.github.com')) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw e;
  }
}

// 拦截请求
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // 只处理同源请求和 GitHub API 请求
  if (url.origin === self.location.origin) {
    // 静态资源用缓存优先
    if (STATIC_ASSETS.includes(url.pathname) || 
        url.pathname.startsWith('/static/') || 
        url.pathname.startsWith('/components/') ||
        url.pathname.startsWith('/image/') ||
        url.pathname.startsWith('/data/')) {
      event.respondWith(cacheFirst(event.request));
    } else {
      // HTML 页面用网络优先
      event.respondWith(networkFirst(event.request));
    }
  } else if (url.hostname === 'api.github.com') {
    // GitHub API 请求 - 尝试缓存
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response(JSON.stringify({ items: [] }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
  }
  // 其他请求（CDN、外部API）不拦截
});
