// 小金库 Service Worker：离线缓存 + 桌面图标红点（App Badge）预留
const CACHE = 'kidsbank-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== 'GET') return;

  // 页面导航：网络优先，失败回退缓存（保证更新可见，离线可用）
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const cp = r.clone();
          caches.open(CACHE).then(c => c.put('./index.html', cp)).catch(() => {});
          return r;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静态资源：缓存优先，回源并更新
  e.respondWith(
    caches.match(e.request).then(c => {
      if (c) return c;
      return fetch(e.request).then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(ca => ca.put(e.request, cp)).catch(() => {});
        return r;
      });
    })
  );
});

// ===== 预留：收到推送时点亮桌面图标红点（将来接入实时推送用）=====
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) {}
  const n = Number(data.badge) || 1;
  e.waitUntil((async () => {
    try { if ('setAppBadge' in self.registration) await self.registration.setAppBadge(n); } catch (_) {}
    const title = data.title || '小金库';
    const body = data.body || '有一笔新的账户变动';
    try {
      await self.registration.showNotification(title, {
        body, icon: './icon-512.png', badge: './icon-192.png'
      });
    } catch (_) {}
  })());
});

// 点击通知：打开应用并清除红点
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  try { if ('clearAppBadge' in self.registration) self.registration.clearAppBadge().catch(() => {}); } catch (_) {}
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(cl => {
      if (cl.length) return cl[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
