const CACHE = 'forje-v1'

self.addEventListener('install', () => {
  // Do NOT call skipWaiting() here so the new SW waits for user confirmation
  // (on first install there is no existing SW, so it activates immediately anyway)
})

self.addEventListener('activate', () => self.clients.claim())

// The app sends this message when the user clicks "Atualizar"
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

// Network-first with cache fallback (required for PWA standalone mode)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone()
        caches.open(CACHE).then((cache) => cache.put(event.request, clone))
        return res
      })
      .catch(() => caches.match(event.request))
  )
})
