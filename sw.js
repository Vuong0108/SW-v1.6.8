const CACHE_PREFIX = 'student-wallet-cache-';
const CACHE_VERSION = 'v1.6.2'; // Thay đổi version này mỗi khi bạn deploy bản mới
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

// Đã bổ sung đầy đủ CSS và JS
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './lucide.min.js'
];

// 1. INSTALL: Cài đặt và đưa file tĩnh vào cache ban đầu
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Bắt buộc SW mới cài đặt xong phải active ngay, không chờ đợi
  
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Đang lưu cache các tài nguyên cốt lõi');
      return cache.addAll(ASSETS);
    })
  );
});

// 2. ACTIVATE: Dọn dẹp cache cũ và tiếp quản ngay lập tức
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Chỉ xóa những cache của Student Wallet mà là phiên bản cũ (an toàn cho app khác)
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
            console.log('[Service Worker] Đang xóa cache cũ:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Đã tiếp quản (Claiming clients)');
      return self.clients.claim(); // Bắt đầu kiểm soát các request ngay trong lần tải đầu tiên
    })
  );
});

// 3. FETCH: Chiến lược Network-First (Ưu tiên mạng, dự phòng bằng cache)
self.addEventListener('fetch', (e) => {
  // Chỉ xử lý các request GET (không can thiệp POST, PUT... hoặc extension trình duyệt)
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Nếu lấy được từ mạng, clone response và ném vào cache để cập nhật bản mới nhất
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Mất mạng -> Lấy từ Cache
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback cuối cùng: Trả về index.html nếu request là chuyển hướng trang
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
