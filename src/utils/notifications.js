// Integração com notificações nativas Android via JavascriptInterface

function isAndroid() {
  return typeof window !== 'undefined' && !!window.Android
}

export function scheduleTaskNotification(task) {
  if (!isAndroid()) return
  if (!task.dueDate || !task.dueTime) return

  const dateTime = new Date(`${task.dueDate}T${task.dueTime}`)
  const timestamp = dateTime.getTime()

  if (isNaN(timestamp) || timestamp <= Date.now()) return

  const priorityLabel = {
    critical: '🚨 Urgente',
    high: '🔴 Alta prioridade',
    medium: '🟡 Média prioridade',
    low: '🟢 Baixa prioridade',
  }[task.priority] || ''

  window.Android.scheduleNotification(
    task.id,
    `⚡ ${task.title}`,
    `${priorityLabel} — vence agora!`,
    timestamp
  )
}

export function cancelTaskNotification(taskId) {
  if (!isAndroid()) return
  window.Android.cancelNotification(taskId)
}
