// MellowPDF Service Worker — Cache-First Strategy
// Caches all assets on install so the app works 100% offline

const CACHE_NAME = 'mellowpdf-v1';

// All local assets to pre-cache on install
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/index.css',
    '/upi_qr.png',
    '/manifest.json',
    '/icons/icon-72.png',
    '/icons/icon-96.png',
    '/icons/icon-128.png',
    '/icons/icon-144.png',
    '/icons/icon-152.png',
    '/icons/icon-192.png',
    '/icons/icon-384.png',
    '/icons/icon-512.png'
];

// CDN libraries — cache at runtime on first fetch
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js',
    'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap'
];

// ─── Install: pre-cache all local assets ────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching local assets...');
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => {
            console.log('[SW] Pre-cache complete. Skipping waiting...');
            return self.skipWaiting();
        })
    );
});

// ─── Activate: clean up old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] Activated. Claiming clients...');
            return self.clients.claim();
        })
    );
});

// ─── Fetch: Cache-First with Network Fallback ────────────────────────────────
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Strategy: Cache first, then network, then offline fallback
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Serve from cache immediately
                // Also update cache in background for CDN assets
                if (CDN_ASSETS.some(cdn => event.request.url.startsWith(cdn.split('?')[0]))) {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.ok) {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, networkResponse.clone());
                            });
                        }
                        return networkResponse;
                    }).catch(() => { /* offline, no-op */ });
                }
                return cachedResponse;
            }

            // Not in cache — fetch from network and cache it
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || !networkResponse.ok) {
                    return networkResponse;
                }

                // Cache the fetched response for future use
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Network failed — serve the main page as offline fallback
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
                return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
            });
        })
    );
});

// ─── Message: force cache refresh ───────────────────────────────────────────
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
