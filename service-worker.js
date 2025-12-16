const CACHE_NAME = 'petstore-pos-v1';
const ASSETS_TO_CACHE = [
    '/App_pet_home/',
    '/App_pet_home/index.html',
    '/App_pet_home/pos.html',
    '/App_pet_home/products.html',
    '/App_pet_home/history.html',
    '/App_pet_home/settings.html',
    '/App_pet_home/css/style.css',
    '/App_pet_home/js/database.js',
    '/App_pet_home/js/pos.js',
    '/App_pet_home/js/products.js',
    '/App_pet_home/js/history.js',
    '/App_pet_home/js/settings.js',
    '/App_pet_home/manifest.json',
    '/App_pet_home/icons/icon-192.png',
    '/App_pet_home/icons/icon-512.png'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching app assets...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip external requests
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200) {
                            return response;
                        }

                        // Clone and cache the response
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Return offline fallback for HTML pages
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/App_pet_home/pos.html');
                        }
                    });
            })
    );
});
