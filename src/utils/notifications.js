const _timers = new Map()
const VAPID_PUBLIC_KEY    = import.meta.env.VITE_VAPID_PUBLIC_KEY
const SUPABASE_URL        = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY   = import.meta.env.VITE_SUPABASE_ANON_KEY

function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - b64.length % 4) % 4)
  const raw = atob((b64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// forceRefresh=true: cancela subscription existente antes de criar nova (garante endpoint fresco)
export async function subscribeAndSavePush(userId, accessToken, onStep, forceRefresh = false) {
  const report = (s) => { console.warn('[Forje push]', s); onStep?.(s) }

  if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'VAPID key ausente no build' }
  if (!('PushManager' in window)) return { ok: false, error: 'PushManager não suportado' }
  if (!('serviceWorker' in navigator)) return { ok: false, error: 'ServiceWorker não suportado' }

  let step = 'getRegistrations'
  try {
    report('1/4 buscando SW...')
    const regs = await Promise.race([
      navigator.serviceWorker.getRegistrations(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('getRegistrations timeout')), 5000)),
    ])
    const reg = regs.find(r => r.active) || regs[0]
    if (!reg) return { ok: false, error: 'SW não encontrado — recarregue o app' }
    if (!reg.pushManager) return { ok: false, error: 'pushManager indisponível neste browser' }

    step = 'getSubscription'
    report('2/4 verificando subscription...')
    let sub = await Promise.race([
      reg.pushManager.getSubscription(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('getSubscription timeout')), 5000)),
    ])

    if (sub && forceRefresh) {
      // Força criação de subscription nova para corrigir endpoints expirados
      await sub.unsubscribe().catch(() => {})
      sub = null
    } else if (sub) {
      const json = sub.toJSON()
      if (!json.keys?.p256dh) { await sub.unsubscribe().catch(() => {}); sub = null }
    }

    step = 'subscribe'
    report('3/4 registrando no servidor push...')
    if (!sub) {
      sub = await Promise.race([
        reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout — verifique sua conexão')), 10000)),
      ])
    }

    step = 'upsert'
    report('4/4 salvando no banco...')
    const json = sub.toJSON()
    // on_conflict=endpoint: cada DISPOSITIVO tem sua linha. Antes o conflito era por
    // user_id (PK) — registrar o push num segundo aparelho apagava o do primeiro.
    const res = await Promise.race([
      fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
          'Prefer':        'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          user_id:  userId,
          endpoint: json.endpoint,
          p256dh:   json.keys.p256dh,
          auth_key: json.keys.auth,
        }),
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('banco timeout')), 6000)),
    ])
    if (!res.ok) {
      const msg = await res.text().catch(() => res.status)
      return { ok: false, error: `Erro ao salvar: ${msg}` }
    }
    return { ok: true }
  } catch (err) {
    console.warn('[Forje] push failed at', step, err)
    return { ok: false, error: `${step}: ${String(err)}` }
  }
}

export async function sendTestNotification() {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  return showBrowserNotification(
    '⏰ Forje — Teste',
    'As notificações estão funcionando corretamente!',
    'forje-test-' + Date.now(),
  )
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

function recordInHistory(tag, title, body) {
  window.dispatchEvent(new CustomEvent('forje-notif-shown', {
    detail: { taskId: tag, title, body, at: Date.now() }
  }))
}

async function showBrowserNotification(title, body, tag) {
  const opts = {
    body, icon: '/icon-192.png', badge: '/icon-192.png',
    tag, renotify: true, requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    data: { taskId: tag },
  }
  // Preferência: registration.showNotification — é o único caminho que funciona
  // no Chrome Android (o construtor `new Notification()` LANÇA exceção lá).
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg?.showNotification) {
        await reg.showNotification(title, opts)
        recordInHistory(tag, title, body)
        return true
      }
    }
  } catch { /* tenta o fallback abaixo */ }
  try {
    new Notification(title, { body, icon: '/icon-192.png', tag })
    recordInHistory(tag, title, body)
    return true
  } catch {
    return false
  }
}

// Horário de referência do lembrete: 'start' (início) ou 'end' (término).
// Default 'start' — o mais lógico (avisa antes de COMEÇAR a tarefa).
// Cai para o outro horário disponível, ou 09:00, se o escolhido não existir.
export function reminderAnchorTime(task) {
  const anchor = task.reminderAnchor === 'end' ? 'end' : 'start'
  if (anchor === 'start') return task.startTime || task.dueTime || '09:00'
  return task.dueTime || task.startTime || '09:00'
}

function buildBody(task) {
  const priority = PRIORITY_LABEL[task.priority] || ''
  const anchor   = task.reminderAnchor === 'end' ? 'end' : 'start'
  if (task.startTime || task.dueTime) {
    const time = reminderAnchorTime(task)
    const verb = anchor === 'start' ? 'começa às' : 'vence às'
    return `${priority} · ${verb} ${time}`
  }
  return priority
}

// Calcula o timestamp (ms) em que o lembrete deve disparar.
// Exportado para a UI avisar quando o horário escolhido já passou.
export function calcReminderMs(task) {
  if (!task.dueDate || task.reminderOffset == null) return null
  const time  = reminderAnchorTime(task)
  const dueMs = new Date(`${task.dueDate}T${time}`).getTime()
  if (isNaN(dueMs)) return null
  return dueMs - task.reminderOffset * 60 * 1000
}

export function scheduleTaskNotification(task) {
  if (task.completed) return

  if (isAndroid()) {
    if (!task.dueDate || task.reminderOffset == null) return
    const time      = reminderAnchorTime(task)
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
  // Timer SEMPRE na página, nunca via setTimeout dentro do Service Worker:
  // o navegador mata SWs ociosos em segundos e os timers de lá quase nunca
  // disparavam — principal causa de "a notificação não chegou" com o app aberto.
  // O timer da página vive enquanto a aba/PWA existir, e o app reagenda tudo
  // ao voltar ao primeiro plano (visibilitychange em App.jsx). Com o app
  // fechado, quem cobre é o push do servidor (cron + send-reminders).
  // setTimeout estoura com delays > ~24,8 dias — deixa para o reagendamento.
  if (delayMs > 2_000_000_000) return
  const timerId = setTimeout(() => {
    showBrowserNotification(title, body, task.id)
    _timers.delete(task.id)
  }, delayMs)
  _timers.set(task.id, timerId)
}

export function cancelTaskNotification(taskId) {
  if (isAndroid()) {
    window.Android?.cancelNotification?.(taskId)
    return
  }
  // CANCEL para o SW cobre agendamentos feitos por versões antigas da página
  swController()?.postMessage({ type: 'CANCEL_NOTIFICATION', id: taskId })
  const timerId = _timers.get(taskId)
  if (timerId !== undefined) { clearTimeout(timerId); _timers.delete(taskId) }
}
