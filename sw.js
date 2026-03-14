const CACHE_NAME = 'vn-maker-v5';
const ASSETS = [
    './',
    './index.html',
    './editor.html',
    './play.html',
    './script.html',
    './css/style.css',
    './js/storage.js',
    './js/db.js',
    './js/auth.js',
    './js/ai.js',
    './js/syncQueue.js',
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
    if (event.request.method !== 'GET') {
        return;
    }

    // 開発中 (localhost) は常にネットワークを優先し、キャッシュを回避する設定
    const isLocalhost = event.request.url.includes('localhost') || event.request.url.includes('127.0.0.1');

    if (isLocalhost) {
        event.respondWith(fetch(event.request));
        return;
    }

    const isNavigationRequest = event.request.mode === 'navigate';

    event.respondWith(
        fetch(event.request).then((response) => {
            if (response && response.status === 200 && event.request.url.startsWith('http')) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
            }
            return response;
        }).catch(async () => {
            const cached = await caches.match(event.request);
            if (cached) {
                return cached;
            }
            if (isNavigationRequest) {
                return caches.match('./index.html');
            }
            throw new Error('Resource unavailable offline');
        })
    );
});
