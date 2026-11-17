/*
 * M11 — service worker for the installable app.
 *
 * Two jobs only, both chosen to be safe for a workshop that is often on a
 * patchy connection:
 *   1. Keep the app shell so it opens instantly and still opens offline.
 *   2. Serve the last good copy of a read-only API response when the network
 *      is unreachable, clearly marked so the screen can say it is stale.
 *
 * Writes are never cached or replayed: a job card must not be created twice
 * because the phone came back online.
 */

const VERSION = 'au2ka-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;

const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/app-icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // A missing asset must not fail the whole install.
      .then(cache => Promise.allSettled(SHELL_ASSETS.map(a => cache.add(a))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Read-only API traffic we are willing to serve stale. */
function isCacheableApi(url) {
  if (!url.pathname.includes('/api/v1/')) return false;
  // Never cache anything to do with signing in or with one-time codes.
  if (url.pathname.includes('/auth/')) return false;
  if (url.pathname.includes('/backup/')) return false;
  return true;
}

self.addEventListener('fetch', event => {
  const { request } = event;

  // Only GET is ever cached; everything else goes straight to the network.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isCacheableApi(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Same-origin assets: cache first, since Vite fingerprints its filenames.
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      // Marked so the app can tell the user what they are looking at is stale.
      const headers = new Headers(cached.headers);
      headers.set('X-Au2ka-Offline', '1');
      return new Response(await cached.blob(), {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
    return new Response(
      JSON.stringify({ status: 'error', message: 'لا يوجد اتصال بالإنترنت' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // A navigation that cannot reach the network still gets the app shell.
    if (request.mode === 'navigate') {
      const shell = await caches.match('/index.html');
      if (shell) return shell;
    }
    throw error;
  }
}

// Lets the page ask a waiting worker to take over immediately.
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
