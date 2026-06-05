const CACHE = 'forje-v7'
const ASSETS_TO_CACHE = ['/']
let focusTimerTimeout = null
const scheduledNotifs = new Map() // taskId -> timeoutId

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS_TO_CACHE))
  )
})

self.addEventListener('activate', (event) => {
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

async function broadcastNotifShown(taskId, title, body) {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  list.forEach(c => c.postMessage({ type: 'NOTIFICATION_SHOWN', taskId, title, body, at: Date.now() }))
}

// Recebe pedido de notificação enviado pelo app
self.addEventListener('message', (event) => {
  // Agenda notificação de fim de sessão de foco
  if (event.data?.type === 'SCHEDULE_FOCUS_NOTIFICATION') {
    if (focusTimerTimeout) clearTimeout(focusTimerTimeout)
    const { delayMs, title, body } = event.data
    focusTimerTimeout = setTimeout(() => {
      focusTimerTimeout = null
      self.registration.showNotification(title, {
        body, icon: '/icon-192.png', badge: '/icon-192.png',
        tag: 'forge-focus', renotify: true, requireInteraction: false,
        vibrate: [200, 100, 200],
      })
    }, delayMs)
    return
  }

  if (event.data?.type === 'CANCEL_FOCUS_NOTIFICATION') {
    if (focusTimerTimeout) { clearTimeout(focusTimerTimeout); focusTimerTimeout = null }
    return
  }

  // Agenda notificação de tarefa (por ID, cancelável individualmente)
  if (event.data?.type === 'SCHEDULE_NOTIFICATION') {
    const { id, delayMs, title, body } = event.data
    if (scheduledNotifs.has(id)) clearTimeout(scheduledNotifs.get(id))
    const tid = setTimeout(async () => {
      scheduledNotifs.delete(id)
      await self.registration.showNotification(title, {
        body, icon: '/icon-192.png', badge: '/icon-192.png',
        tag: id, renotify: true,
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 300],
        data: { taskId: id },
      })
      broadcastNotifShown(id, title, body)
    }, delayMs)
    scheduledNotifs.set(id, tid)
    return
  }

  if (event.data?.type === 'CANCEL_NOTIFICATION') {
    const { id } = event.data
    if (scheduledNotifs.has(id)) { clearTimeout(scheduledNotifs.get(id)); scheduledNotifs.delete(id) }
    return
  }

  if (event.data?.type !== 'SHOW_NOTIFICATION') return
  const { title, body, tag } = event.data
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:   '/icon-192.png',
      badge:  '/icon-192.png',
      tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      data: { taskId: tag },
    }).then(() => broadcastNotifShown(tag, title, body))
  )
})

// Recebe push do servidor (funciona com app FECHADO)
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data?.json() ?? {} } catch {}
  const { title = '⏰ Forje', body = '', tag = 'push-' + Date.now(), taskId } = data
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:   '/icon-192.png',
      badge:  '/icon-192.png',
      tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      data: { taskId: taskId || tag },
    }).then(() => broadcastNotifShown(tag, title, body))
  )
})

// Abre o app ao clicar na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow('/')
    })
  )
})
