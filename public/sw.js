const CACHE = 'forje-v3'
const ASSETS_TO_CACHE = ['/']

self.addEventListener('install', (event) => {
  // Ativa imediatamente sem esperar — garante que updates chegam na hora
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS_TO_CACHE))
  )
})

self.addEventListener('activate', (event) => {
  // Remove caches antigos
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Network-first: sempre busca na rede, usa cache só se offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone()
        caches.open(CACHE).then(cache => cache.put(event.request, clone))
        return res
      })
      .catch(() => caches.match(event.request))
  )
})
