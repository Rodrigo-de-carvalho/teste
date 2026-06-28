import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    // Persiste sessão no localStorage (funciona em WebView também)
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
})

// ── Mapeamento DB (snake_case) ↔ JS (camelCase) ───────────────────────────

export function dbTaskToJs(row) {
  if (!row) return null
  return {
    id:          row.id,
    title:       row.title,
    notes:       row.notes        ?? '',
    priority:    row.priority     ?? 'medium',
    project:     row.project      ?? 'Geral',
    // Supabase pode retornar date como "YYYY-MM-DDT..." ou time como "HH:MM:SS"
    // — truncamos para os formatos esperados pelos inputs HTML
    dueDate:        row.due_date   ? String(row.due_date).slice(0, 10)  : null,
    startTime:      row.start_time ? String(row.start_time).slice(0, 5) : null,
    dueTime:        row.due_time   ? String(row.due_time).slice(0, 5)   : null,
    reminderOffset: row.reminder_offset ?? null,
    reminderAnchor: row.reminder_anchor ?? 'start',  // 'start' = lembrar antes do início | 'end' = antes do término
    recurrence:     row.recurrence ?? 'none',        // 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'
    recurrenceDays: row.recurrence_days ?? null,     // [0-6] (Dom..Sáb) quando recurrence='custom'
    clientId:       row.client_id ?? null,           // idempotência (uuid gerado no cliente)
    completed:      row.completed    ?? false,
    completedAt: row.completed_at ?? null,
    weekDay:     row.week_day     ?? null,
    createdAt:   row.created_at,
    subtasks:    (row.subtasks ?? []).map(dbSubToJs),
  }
}

export function dbSubToJs(row) {
  return { id: row.id, title: row.title, done: row.done ?? false }
}

export function jsTaskToDb(data) {
  const db = {}
  if (data.title       !== undefined) db.title        = data.title
  if (data.notes       !== undefined) db.notes        = data.notes
  if (data.priority    !== undefined) db.priority     = data.priority
  if (data.project     !== undefined) db.project      = data.project
  if (data.dueDate        !== undefined) db.due_date        = data.dueDate
  if (data.startTime      !== undefined) db.start_time      = data.startTime || null
  if (data.dueTime        !== undefined) db.due_time        = data.dueTime
  if (data.reminderOffset !== undefined) db.reminder_offset = data.reminderOffset ?? null
  if (data.reminderAnchor !== undefined) db.reminder_anchor = data.reminderAnchor || 'start'
  if (data.recurrence     !== undefined) db.recurrence     = data.recurrence || 'none'
  if (data.recurrenceDays !== undefined) db.recurrence_days = data.recurrenceDays ?? null
  if (data.clientId) db.client_id = data.clientId   // só envia se houver uuid (truthy) — habilita upsert idempotente
  if (data.completed      !== undefined) db.completed      = data.completed
  if (data.completedAt !== undefined) db.completed_at = data.completedAt
  if (data.weekDay     !== undefined) db.week_day     = data.weekDay
  return db
}

export function dbNoteToJs(row) {
  if (!row) return null
  return {
    id:        row.id,
    title:     row.title ?? '',
    body:      row.body  ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function dbStatsToJs(row) {
  if (!row) return null
  return {
    xp:            row.xp              ?? 0,
    level:         row.level           ?? 1,
    streak:        row.streak          ?? 0,
    totalFocusSec: row.total_focus_sec ?? 0,
    todayFocusSec: row.today_focus_sec ?? 0,
    focusTaskId:   row.focus_task_id   ?? null,
    lastActiveDate:row.last_active_date ?? null,
  }
}

export function isValidAvatarUrl(url) {
  if (!url || typeof url !== 'string') return false
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export function getUserMeta(user) {
  if (!user) return null
  return {
    id:     user.id,
    email:  user.email,
    name:   user.user_metadata?.full_name  || user.email?.split('@')[0] || 'Usuário',
    avatar: user.user_metadata?.avatar_url || null,
  }
}
