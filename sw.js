// MellowPDF Service Worker — Cache-First Strategy
// Caches all assets on install so the app works 100% offline

const CACHE_NAME = 'mellowpdf-v3';

// Local assets to pre-cache on install
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

// CDN libraries — also pre-cached during install so offline works immediately.
// Each is fetched with no-cors where needed and cached individually.
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js'
];

// ─── Helper: is this a cacheable URL? ────────────────────────────────────────
function isCacheableRequest(request) {
    const url = request.url;
    // Only cache http / https — skip chrome-extension://, data:, blob:, etc.
    return url.startsWith('http://') || url.startsWith('https://');
}

// ─── Install: pre-cache local assets + CDN libraries ─────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[SW] Pre-caching local assets...');

            // Cache local assets (must succeed — addAll throws if any fail)
            await cache.addAll(PRECACHE_ASSETS);

            // Cache CDN assets individually with graceful failure.
            // Use no-cors so cross-origin scripts can still be stored as opaque responses.
            await Promise.allSettled(
                CDN_ASSETS.map(url =>
                    fetch(url, { mode: 'cors', credentials: 'omit' })
                        .then(res => {
                            if (res.ok || res.type === 'opaque') {
                                return cache.put(url, res);
                            }
                        })
                        .catch(err => {
                            console.warn('[SW] Could not pre-cache CDN asset (offline?):', url, err.message);
                        })
                )
            );

            console.log('[SW] Pre-cache complete.');
        }).then(() => self.skipWaiting())
    );
});

// ─── Activate: clean up old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            )
        ).then(() => {
            console.log('[SW] Activated. Claiming clients...');
            return self.clients.claim();
        })
    );
});

// ─── Fetch: Cache-First with Network Fallback ────────────────────────────────
self.addEventListener('fetch', (event) => {
    const request = event.request;

    // Only intercept GET requests over http(s) — ignore chrome-extension, data, blob, etc.
    if (request.method !== 'GET') return;
    if (!isCacheableRequest(request)) return;

    // For Google Fonts CSS (varies by user-agent), just pass through — don't cache
    if (request.url.includes('fonts.googleapis.com') || request.url.includes('fonts.gstatic.com')) {
        return; // let browser handle it normally
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Serve from cache immediately.
                // For CDN scripts, silently revalidate in the background if online.
                if (CDN_ASSETS.some(cdn => request.url.startsWith(cdn))) {
                    fetch(request, { mode: 'cors', credentials: 'omit' })
                        .then(networkResponse => {
                            if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(request, networkResponse.clone());
                                });
                            }
                        })
                        .catch(() => { /* offline — serve from cache, no-op */ });
                }
                return cachedResponse;
            }

            // Not in cache yet — try network, then cache the result
            return fetch(request, { credentials: 'same-origin' })
                .then((networkResponse) => {
                    if (!networkResponse || !networkResponse.ok) {
                        return networkResponse;
                    }

                    // Store a clone in cache for next time
                    caches.open(CACHE_NAME).then((cache) => {
                        try {
                            cache.put(request, networkResponse.clone());
                        } catch (e) {
                            console.warn('[SW] Could not cache response:', request.url, e.message);
                        }
                    });

                    return networkResponse;
                })
                .catch(() => {
                    // Fully offline and not in cache
                    if (request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                    return new Response('Offline — resource not cached.', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'text/plain' }
                    });
                });
        })
    );
});

// ─── Message: force immediate activation ────────────────────────────────────
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
