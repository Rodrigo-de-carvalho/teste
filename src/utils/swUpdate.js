export function registerSW() {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.register('/sw.js')

  // Quando um novo SW assume o controle, recarrega a página silenciosamente
  // para garantir que o usuário sempre vê a versão mais nova
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}
