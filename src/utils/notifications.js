// Mapa de timers ativos para cancelamento
const _timers = new Map()

const PRIORITY_LABEL = {
  critical: '🚨 Urgente',
  high:     '🔴 Alta prioridade',
  medium:   '🟡 Média prioridade',
  low:      '🟢 Baixa prioridade',
}

// ── Android WebView bridge ────────────────────────────────────────────────────
function isAndroid() {
  return typeof window !== 'undefined' && !!window.Android
}

// ── Browser / PWA ─────────────────────────────────────────────────────────────
export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission() {
  if (!notificationsSupported()) return 'denied'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function showBrowserNotification(title, body, tag) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    // Delega ao SW para funcionar mesmo com app em background
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
      tag,
    })
  } else {
    new Notification(title, { body, icon: '/icon-192.png', tag })
  }
}

// ── API pública ───────────────────────────────────────────────────────────────
export function scheduleTaskNotification(task) {
  if (!task.dueDate || !task.dueTime) return

  const dateTime  = new Date(`${task.dueDate}T${task.dueTime}`)
  const delay     = dateTime.getTime() - Date.now()
  if (isNaN(delay) || delay <= 0) return

  const label = PRIORITY_LABEL[task.priority] || ''

  // Android nativo
  if (isAndroid()) {
    window.Android.scheduleNotification(
      task.id,
      `⚡ ${task.title}`,
      `${label} — vence agora!`,
      dateTime.getTime()
    )
    return
  }

  // Browser / PWA
  if (!notificationsSupported() || Notification.permission !== 'granted') return

  cancelTaskNotification(task.id)

  const timerId = setTimeout(() => {
    showBrowserNotification(
      `⚡ ${task.title}`,
      `${label} — vence agora!`,
      task.id
    )
    _timers.delete(task.id)
  }, delay)

  _timers.set(task.id, timerId)
}

export function cancelTaskNotification(taskId) {
  if (isAndroid()) {
    window.Android.cancelNotification(taskId)
    return
  }
  const timerId = _timers.get(taskId)
  if (timerId !== undefined) {
    clearTimeout(timerId)
    _timers.delete(taskId)
  }
}
