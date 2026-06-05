import { supabase } from '../lib/supabase.js'

const _timers = new Map()
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - b64.length % 4) % 4)
  const raw = atob((b64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function subscribeAndSavePush(userId) {
  if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'VAPID key ausente no build' }
  if (!('PushManager' in window)) return { ok: false, error: 'PushManager não suportado neste browser' }
  if (!('serviceWorker' in navigator)) return { ok: false, error: 'ServiceWorker não suportado' }

  async function _work() {
    let step = 'getRegistration'
    try {
      // getRegistration não bloqueia — retorna imediatamente se o SW existe
      let reg = await navigator.serviceWorker.getRegistration('/')
      if (!reg) return { ok: false, error: 'Service Worker não encontrado — recarregue o app' }
      step = 'getSubscription'
      let sub = await reg.pushManager.getSubscription()
      if (sub) {
        const json = sub.toJSON()
        if (!json.keys?.p256dh) { await sub.unsubscribe(); sub = null }
      }
      step = 'subscribe'
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }
      step = 'upsert'
      const json = sub.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id:  userId,
        endpoint: json.endpoint,
        p256dh:   json.keys.p256dh,
        auth_key: json.keys.auth,
      })
      if (error) return { ok: false, error: `upsert: ${error.message}` }
      return { ok: true }
    } catch (err) {
      console.warn('[Forje] push subscribe failed at', step, err)
      return { ok: false, error: `${step}: ${String(err)}` }
    }
  }

  const timeout = new Promise(resolve =>
    setTimeout(() => resolve({ ok: false, error: 'Timeout em sw.ready — feche outras abas do app e tente de novo' }), 12000)
  )
  return Promise.race([_work(), timeout])
}

const PRIORITY_LABEL = {
  critical: '🚨 Urgente',
  high:     '🔴 Alta prioridade',
  medium:   '🟡 Média prioridade',
  low:      '🟢 Baixa prioridade',
}

export const REMINDER_OPTIONS = [
  { label: 'Na hora da tarefa',  value: 0    },
  { label: '15 min antes',       value: 15   },
  { label: '30 min antes',       value: 30   },
  { label: '1 hora antes',       value: 60   },
  { label: '2 horas antes',      value: 120  },
  { label: '1 dia antes',        value: 1440 },
]

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
    // History gravado pelo broadcast que o SW envia de volta
    sw.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag })
  } else {
    new Notification(title, { body, icon: '/icon-192.png', tag })
    // Sem SW: dispara evento para o App registrar no histórico
    window.dispatchEvent(new CustomEvent('forje-notif-shown', {
      detail: { taskId: tag, title, body, at: Date.now() }
    }))
  }
}

function buildBody(task) {
  const priority = PRIORITY_LABEL[task.priority] || ''
  if (task.dueTime) return `${priority} · vence às ${task.dueTime}`
  return priority
}

// Calcula o timestamp (ms) em que o lembrete deve disparar
function calcReminderMs(task) {
  if (!task.dueDate || task.reminderOffset == null) return null
  const time  = task.dueTime || '09:00'
  const dueMs = new Date(`${task.dueDate}T${time}`).getTime()
  if (isNaN(dueMs)) return null
  return dueMs - task.reminderOffset * 60 * 1000
}

export function scheduleTaskNotification(task) {
  if (task.completed) return

  if (isAndroid()) {
    if (!task.dueDate || task.reminderOffset == null) return
    const time      = task.dueTime || '09:00'
    const reminderMs = new Date(`${task.dueDate}T${time}`).getTime() - task.reminderOffset * 60 * 1000
    window.Android?.scheduleNotification?.(task.id, `⏰ ${task.title}`, buildBody(task), reminderMs)
    return
  }

  if (!notificationsSupported() || Notification.permission !== 'granted') return

  const reminderMs = calcReminderMs(task)
  if (reminderMs == null) return

  cancelTaskNotification(task.id)

  const now             = Date.now()
  const CATCH_UP_WINDOW = 24 * 60 * 60 * 1000  // 24h — mostra ao abrir o app se perdeu enquanto estava fechado
  const title      = `⏰ ${task.title}`
  const body       = buildBody(task)

  // Catch-up: lembrete que passou nas últimas 24h — notifica imediatamente ao abrir o app
  if (reminderMs > now - CATCH_UP_WINDOW && reminderMs <= now) {
    showBrowserNotification(title, body, task.id)
    return
  }

  if (reminderMs <= now) return // muito antigo, ignora

  const delayMs = reminderMs - now
  const sw = swController()
  if (sw) {
    sw.postMessage({ type: 'SCHEDULE_NOTIFICATION', id: task.id, delayMs, title, body })
  } else {
    const timerId = setTimeout(() => {
      showBrowserNotification(title, body, task.id)
      _timers.delete(task.id)
    }, delayMs)
    _timers.set(task.id, timerId)
  }
}

export function cancelTaskNotification(taskId) {
  if (isAndroid()) {
    window.Android?.cancelNotification?.(taskId)
    return
  }
  swController()?.postMessage({ type: 'CANCEL_NOTIFICATION', id: taskId })
  const timerId = _timers.get(taskId)
  if (timerId !== undefined) { clearTimeout(timerId); _timers.delete(taskId) }
}
