let _updateReady = false
let _listeners = []
let _registration = null

export function hasUpdate() {
  return _updateReady
}

export function onUpdateReady(fn) {
  _listeners.push(fn)
  return () => { _listeners = _listeners.filter(l => l !== fn) }
}

function notifyReady() {
  _updateReady = true
  _listeners.forEach(fn => fn())
}

// Aplica a atualização: pede ao SW em espera para assumir e recarrega.
// O controllerchange (abaixo) cuida do reload quando o novo SW assume.
export function applyUpdate() {
  const waiting = _registration?.waiting
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' })
    // Fallback: se controllerchange não disparar em 1.2s, recarrega na marra
    setTimeout(() => window.location.reload(), 1200)
  } else {
    window.location.reload()
  }
}

export function registerSW() {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.register('/sw.js').then(reg => {
    _registration = reg

    // Já existe um SW em espera (atualização baixada antes do app abrir)
    if (reg.waiting && navigator.serviceWorker.controller) notifyReady()

    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing
      if (!newWorker) return
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          notifyReady()
        }
      })
    })

    // Verifica atualização imediatamente e ao voltar para o app
    reg.update().catch(() => {})
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {})
    })
    // E periodicamente, para apps que ficam abertos por muito tempo
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
  }).catch(() => {})

  // Quando um novo SW assume o controle, recarrega para usar a versão nova
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}
