// Armazena o prompt de instalação no nível do módulo para persistir entre renders
let _deferredPrompt = null
let _listeners = []

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    _deferredPrompt = e
    _listeners.forEach(fn => fn())
  })
}

export function onInstallReady(fn) {
  _listeners.push(fn)
  return () => { _listeners = _listeners.filter(l => l !== fn) }
}

export function canInstall() {
  return !!_deferredPrompt
}

export async function installApp() {
  if (!_deferredPrompt) return false
  _deferredPrompt.prompt()
  const { outcome } = await _deferredPrompt.userChoice
  if (outcome === 'accepted') _deferredPrompt = null
  return outcome === 'accepted'
}
