const _timers = new Map()

const PRIORITY_LABEL = {
  critical: '🚨 Urgente',
  high:     '🔴 Alta prioridade',
  medium:   '🟡 Média prioridade',
  low:      '🟢 Baixa prioridade',
}

function isAndroid() {
  return typeof window !== 'undefined' && !!window.Android
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission() {
  if (!notificationsSupported()) return 'denied'
  return Notification.permission
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function swController() {
  return 'serviceWorker' in navigator ? navigator.serviceWorker.controller : null
}

function showBrowserNotification(title, body, tag) {
  const sw = swController()
  if (sw) {
    sw.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag })
  } else {
    new Notification(title, { body, icon: '/icon-192.png', tag })
  }
}

export function scheduleTaskNotification(task) {
  if (!task.dueDate) return

  const time     = task.dueTime || '09:00'
  const dateTime = new Date(`${task.dueDate}T${time}`)
  const delay    = dateTime.getTime() - Date.now()
  if (isNaN(delay) || delay <= 0) return

  const title = `⚡ ${task.title}`
  const body  = `${PRIORITY_LABEL[task.priority] || ''} — vence agora!`

  if (isAndroid()) {
    window.Android?.scheduleNotification?.(task.id, title, body, dateTime.getTime())
    return
  }

  if (!notificationsSupported() || Notification.permission !== 'granted') return

  cancelTaskNotification(task.id)

  const sw = swController()
  if (sw) {
    // Via SW — funciona mesmo com aba em background
    sw.postMessage({ type: 'SCHEDULE_NOTIFICATION', id: task.id, delayMs: delay, title, body })
  } else {
    // Fallback: setTimeout no main thread
    const timerId = setTimeout(() => {
      showBrowserNotification(title, body, task.id)
      _timers.delete(task.id)
    }, delay)
    _timers.set(task.id, timerId)
  }
}

export function cancelTaskNotification(taskId) {
  if (isAndroid()) {
    window.Android?.cancelNotification?.(taskId)
    return
  }
  // Cancela no SW
  swController()?.postMessage({ type: 'CANCEL_NOTIFICATION', id: taskId })
  // Cancela setTimeout (fallback)
  const timerId = _timers.get(taskId)
  if (timerId !== undefined) { clearTimeout(timerId); _timers.delete(taskId) }
}
