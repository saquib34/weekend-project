

const CACHE_NAME = 'weekendly-v1.0.0';
const STATIC_CACHE_NAME = 'weekendly-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'weekendly-dynamic-v1.0.0';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/index.css',
  '/manifest.json',
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /^https:\/\/api\.openweathermap\.org/,
  /^https:\/\/generativelanguage\.googleapis\.com/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-http requests (chrome-extension, etc.)
  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) {
    return;
  }

  // Handle different types of requests
  if (request.method === 'GET') {
    event.respondWith(handleGetRequest(request));
  } else if (request.method === 'POST') {
    event.respondWith(handlePostRequest(request));
  }
});

// Handle GET requests with different caching strategies
async function handleGetRequest(request) {
  const url = new URL(request.url);

  // Strategy 1: Cache First (for static assets)
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
    return cacheFirst(request);
  }

  // Strategy 2: Network First (for HTML pages)
  if (url.pathname === '/' || url.pathname.includes('.html')) {
    return networkFirst(request);
  }

  // Strategy 3: Stale While Revalidate (for API calls)
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.href))) {
    return staleWhileRevalidate(request);
  }

  // Default: Network First
  return networkFirst(request);
}

// Handle POST requests (for background sync)
async function handlePostRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);
    return response;
  } catch (error) {
    // If offline, store for background sync
    await storeForBackgroundSync(request);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Request stored for background sync',
        offline: true 
      }),
      { 
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Caching Strategies

// Cache First - try cache, fallback to network
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      // Only cache http/https requests, skip chrome-extension and other schemes
      if (request.url.startsWith('http://') || request.url.startsWith('https://')) {
        const cache = await caches.open(STATIC_CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }
    }
    return networkResponse;
  } catch (error) {
    console.error('Cache First strategy failed:', error);
    return new Response('Offline and not cached', { status: 503 });
  }
}

// Network First - try network, fallback to cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      // Only cache http/https requests, skip chrome-extension and other schemes
      if (request.url.startsWith('http://') || request.url.startsWith('https://')) {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }
    }
    return networkResponse;
  } catch (error) {
    console.log('Network First: Network failed, trying cache');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html') || new Response('Offline', { status: 503 });
    }
    
    return new Response('Offline and not cached', { status: 503 });
  }
}

// Stale While Revalidate - serve from cache, update in background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await caches.match(request);

  // Fetch in background to update cache
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.status === 200) {
      // Only cache http/https requests, skip chrome-extension and other schemes
      if (request.url.startsWith('http://') || request.url.startsWith('https://')) {
        cache.put(request, networkResponse.clone());
      }
    }
    return networkResponse;
  }).catch(() => {
    // Network failed, but we might have cache
    return cachedResponse;
  });

  // Return cached version immediately if available
  return cachedResponse || fetchPromise;
}

// Network Only - always use network
async function networkOnly(request) {
  return fetch(request);
}

// Background Sync
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'weekend-plan-sync') {
    event.waitUntil(syncWeekendPlans());
  } else if (event.tag === 'activity-interaction-sync') {
    event.waitUntil(syncActivityInteractions());
  }
});

// Store request for background sync
async function storeForBackgroundSync(request) {
  const data = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: Date.now(),
  };

  // Store in IndexedDB for background sync
  const db = await openIndexedDB();
  const transaction = db.transaction(['pending-requests'], 'readwrite');
  const store = transaction.objectStore('pending-requests');
  await store.add(data);
}

// Sync weekend plans when back online
async function syncWeekendPlans() {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(['pending-requests'], 'readonly');
    const store = transaction.objectStore('pending-requests');
    const requests = await store.getAll();

    // Check if requests is valid and iterable
    if (!requests || !Array.isArray(requests)) {
      console.log('No pending requests to sync');
      return;
    }

    for (const requestData of requests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body,
        });

        if (response.ok) {
          // Remove from pending requests
          const deleteTransaction = db.transaction(['pending-requests'], 'readwrite');
          const deleteStore = deleteTransaction.objectStore('pending-requests');
          await deleteStore.delete(requestData.id);
        }
      } catch (error) {
        console.error('Failed to sync request:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Sync activity interactions
async function syncActivityInteractions() {
  // Similar to syncWeekendPlans but for activity data
  console.log('Syncing activity interactions...');
}

// Push Notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: 'Check out activity recommendations for this weekend!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'weekend-reminder',
    data: {
      url: '/',
      action: 'open-app'
    },
    actions: [
      {
        action: 'view-recommendations',
        title: 'View Recommendations',
        icon: '/icons/action-view.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/action-dismiss.png'
      }
    ],
    timestamp: Date.now(),
    renotify: true,
    requireInteraction: false,
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.body || options.body;
      options.data = { ...options.data, ...data };
    } catch (error) {
      console.error('Failed to parse push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification('Weekendly', options)
  );
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  let url = data?.url || '/';

  if (action === 'view-recommendations') {
    url = '/activities?recommendations=true';
  } else if (action === 'dismiss') {
    return; // Just close the notification
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// IndexedDB helper
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('weekendly-db', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('pending-requests')) {
        const store = db.createObjectStore('pending-requests', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Message handling (for communication with main thread)
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'REQUEST_CACHE_UPDATE') {
    event.waitUntil(updateCache());
  }
});

// Update cache manually
async function updateCache() {
  const cache = await caches.open(STATIC_CACHE_NAME);
  await cache.addAll(STATIC_ASSETS);
  console.log('Service Worker: Cache updated manually');
}
