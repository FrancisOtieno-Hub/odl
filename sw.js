// Service Worker for ODL Digital Library PWA
const CACHE_NAME = 'odl-library-v1';
const RUNTIME_CACHE = 'odl-runtime-v1';
const PDF_CACHE = 'odl-pdfs-v1';

// Files to cache immediately on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== RUNTIME_CACHE && 
              cacheName !== PDF_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome extensions and other protocols
  if (!url.protocol.startsWith('http')) return;

  // Handle different types of requests
  if (isPDFRequest(request)) {
    event.respondWith(handlePDFRequest(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else {
    event.respondWith(handleStaticRequest(request));
  }
});

// Check if request is for PDF
function isPDFRequest(request) {
  return request.url.includes('.pdf') || 
         request.url.includes('drive.google.com') ||
         request.headers.get('accept')?.includes('application/pdf');
}

// Check if request is for API
function isAPIRequest(request) {
  return request.url.includes('/api/') || 
         request.url.includes('supabase') ||
         request.url.includes('paystack');
}

// Handle PDF requests - Cache for offline reading
async function handlePDFRequest(request) {
  try {
    const cache = await caches.open(PDF_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Serving PDF from cache:', request.url);
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    // Only cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      console.log('Caching PDF:', request.url);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('PDF fetch failed:', error);
    
    // Return cached version if available
    const cache = await caches.open(PDF_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for PDFs
    return new Response('PDF not available offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

// Handle API requests - Network first, cache as fallback
async function handleAPIRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful API responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network request failed, trying cache:', request.url);
    
    const cache = await caches.open(RUNTIME_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return error response
    return new Response(JSON.stringify({ 
      error: 'Network error',
      offline: true 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle static requests - Cache first, network fallback
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Return cached version and update cache in background
    updateCacheInBackground(request, cache);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Fetch failed:', error);
    
    // Return offline page if available
    return cache.match('/index.html');
  }
}

// Update cache in background (stale-while-revalidate pattern)
async function updateCacheInBackground(request, cache) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse);
    }
  } catch (error) {
    // Silently fail - user already has cached version
    console.log('Background cache update failed:', request.url);
  }
}

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-subscriptions') {
    event.waitUntil(syncSubscriptions());
  }
  
  if (event.tag === 'sync-reading-progress') {
    event.waitUntil(syncReadingProgress());
  }
});

// Sync subscription data when back online
async function syncSubscriptions() {
  try {
    // Get pending subscription data from IndexedDB
    const pendingData = await getPendingSubscriptions();
    
    if (pendingData && pendingData.length > 0) {
      // Send to server
      await fetch('/api/sync-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingData)
      });
      
      // Clear pending data
      await clearPendingSubscriptions();
      
      console.log('Subscriptions synced successfully');
    }
  } catch (error) {
    console.error('Subscription sync failed:', error);
    throw error; // Retry sync
  }
}

// Sync reading progress when back online
async function syncReadingProgress() {
  try {
    const pendingProgress = await getPendingProgress();
    
    if (pendingProgress && pendingProgress.length > 0) {
      await fetch('/api/sync-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingProgress)
      });
      
      await clearPendingProgress();
      
      console.log('Reading progress synced successfully');
    }
  } catch (error) {
    console.error('Progress sync failed:', error);
    throw error;
  }
}

// Push notification handler
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New content available!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'odl-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open Library'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('ODL Digital Library', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handler for cache management from main app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_PDF') {
    cachePDF(event.data.url);
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    clearAllCaches();
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Cache specific PDF
async function cachePDF(url) {
  const cache = await caches.open(PDF_CACHE);
  try {
    const response = await fetch(url);
    await cache.put(url, response);
    console.log('PDF cached:', url);
  } catch (error) {
    console.error('Failed to cache PDF:', error);
  }
}

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  console.log('All caches cleared');
}

// Helper functions for IndexedDB (will be implemented with Supabase integration)
async function getPendingSubscriptions() {
  // Placeholder - will integrate with IndexedDB
  return [];
}

async function clearPendingSubscriptions() {
  // Placeholder - will integrate with IndexedDB
}

async function getPendingProgress() {
  // Placeholder - will integrate with IndexedDB
  return [];
}

async function clearPendingProgress() {
  // Placeholder - will integrate with IndexedDB
}

console.log('Service Worker loaded successfully');
