const CACHE_NAME = 'student-wallet-v2'; // Tăng lên v2 để ép điện thoại cập nhật
const ASSETS = [
  './',
  './index.html',
  './lucide.min.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Ép Service Worker mới chạy ngay lập tức
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  // Xóa rác cache phiên bản cũ
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      // Có cache thì dùng, không có thì tải từ mạng. Nếu mất mạng thì trả về index.html
      return res || fetch(e.request).catch(() => caches.match('./index.html'));
    })
  );
});