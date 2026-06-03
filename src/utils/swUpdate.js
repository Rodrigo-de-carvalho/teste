let _updateReady = false
let _listeners = []

export function hasUpdate() {
  return _updateReady
}

export function onUpdateReady(fn) {
  _listeners.push(fn)
  return () => { _listeners = _listeners.filter(l => l !== fn) }
}

export function applyUpdate() {
  window.location.reload()
}

export function registerSW() {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.register('/sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing
      if (!newWorker) return
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          _updateReady = true
          _listeners.forEach(fn => fn())
        }
      })
    })
  }).catch(() => {})

  // Quando um novo SW assume o controle e applyUpdate() foi chamado, recarrega
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}
