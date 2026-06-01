let _waitingSW = null
let _listeners = []

function notify() {
  _listeners.forEach(fn => fn())
}

export function onUpdateReady(fn) {
  _listeners.push(fn)
  return () => { _listeners = _listeners.filter(l => l !== fn) }
}

export function hasUpdate() {
  return !!_waitingSW
}

export function applyUpdate() {
  if (!_waitingSW) return
  _waitingSW.postMessage('SKIP_WAITING')
  // Reload after the new SW takes control
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  }, { once: true })
}

export function registerSW() {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.register('/sw.js').then((reg) => {
    // Check if there's already a waiting SW on page load (e.g. user refreshed after deploy)
    if (reg.waiting) {
      _waitingSW = reg.waiting
      notify()
    }

    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing
      if (!newSW) return
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          // New version installed and waiting — old version still active
          _waitingSW = newSW
          notify()
        }
      })
    })
  })

  // Poll for updates every 60 seconds (catches deploys while app is open)
  setInterval(() => {
    navigator.serviceWorker.getRegistration().then(reg => reg?.update())
  }, 60_000)
}
