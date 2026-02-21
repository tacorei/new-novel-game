const CACHE_NAME = 'vn-maker-v4';
const ASSETS = [
    './',
    './index.html',
    './editor.html',
    './play.html',
    './script.html',
    './css/style.css',
    './js/storage.js',
    './js/ai.js',
    './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
    // 新しいSWがインストールされたらすぐに待機状態をスキップしてアクティブにする
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    // アクティブになったら、すぐにすべてのクライアント（タブ）を制御下に置く
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((keys) => {
                return Promise.all(
                    keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((fetchResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    // 動的にリソース（画像など）をキャッシュ
                    if (event.request.url.startsWith('http') || event.request.url.includes('assets/')) {
                        cache.put(event.request, fetchResponse.clone());
                    }
                    return fetchResponse;
                });
            });
        }).catch(() => {
            // オフライン時のフォールバック
        })
    );
});
