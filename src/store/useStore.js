import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, dbTaskToJs, jsTaskToDb, dbStatsToJs, getUserMeta } from '../lib/supabase.js'
import { scheduleTaskNotification, cancelTaskNotification, subscribeAndSavePush, notificationsSupported, notificationPermission, reminderAnchorTime } from '../utils/notifications.js'
import { localIso, advanceDate } from '../utils/dates.js'

// Degradação graciosa: se uma coluna opcional ainda não existe no banco
// (migração não aplicada), removemos o campo dos writes para não quebrar o salvamento.
const OPTIONAL_COLUMNS = ['reminder_anchor', 'recurrence']
const missingColumns = new Set()
function stripMissing(dbObj) {
  if (!dbObj || missingColumns.size === 0) return dbObj
  let copy = null
  for (const col of missingColumns) {
    if (col in dbObj) { copy = copy || { ...dbObj }; delete copy[col] }
  }
  return copy || dbObj
}
// Detecta erro de coluna ausente, marca a coluna e retorna true se algo foi marcado
function detectMissingColumn(error) {
  if (!error) return false
  const msg = String(error.message || '').toLowerCase()
  let found = false
  for (const col of OPTIONAL_COLUMNS) {
    if (msg.includes(col)) { missingColumns.add(col); found = true }
  }
  if (!found && (error.code === '42703' || error.code === 'PGRST204')) {
    OPTIONAL_COLUMNS.forEach(c => missingColumns.add(c)); found = true
  }
  return found
}

// ── Theme ─────────────────────────────────────────────────────────────────────────
function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark)
}

// ── XP ─────────────────────────────────────────────────────────────────────────────
export const XP_TABLE = { critical: 50, high: 30, medium: 20, low: 10 }

function totalXpToReach(level) {
  let t = 0
  for (let l = 2; l <= level; l++) t += Math.floor(100 * (l - 1) * 1.4)
  return t
}

export function levelFromXp(xp) {
  let l = 1
  while (totalXpToReach(l + 1) <= xp) l++
  return l
}

export function xpProgressInLevel(xp) {
  const level  = levelFromXp(xp)
  const start  = totalXpToReach(level)
  const end    = totalXpToReach(level + 1)
  const earned = xp - start
  const needed = end - start
  return { level, earned, needed, pct: Math.round((earned / needed) * 100) }
}

const LOGGED_OUT_STATE = {
  session: null, authUser: null, isLoggedIn: false,
  tasks: [], focusTaskId: null, currentPage: 'login',
  user: { name: 'Visitante', email: null, avatar: null, xp: 0, level: 1, streak: 0, totalFocusSec: 0, todayFocusSec: 0, lastActiveDate: null },
}

// Garante que uma promise resolva em no máximo `ms` milissegundos.
function withTimeout(promise, ms) {
  const timer = new Promise(resolve =>
    setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), ms)
  )
  return Promise.race([promise, timer])
}

// Timeout do insert de tarefa. Mais generoso que os 10s antigos: conexões lentas
// merecem mais chance de concluir antes de considerarmos o salvamento perdido.
const TASK_INSERT_TIMEOUT_MS = 18000

// Insere uma linha de tarefa com rede de segurança:
//  1ª tentativa → se coluna opcional ausente, degrada e tenta de novo →
//  se ainda houver erro (timeout/rede transitória), mais uma tentativa antes de desistir.
async function insertTaskRow(payload) {
  const run = () => withTimeout(
    supabase.from('tasks').insert(stripMissing(payload)).select('*, subtasks(*)').single(),
    TASK_INSERT_TIMEOUT_MS
  )
  let { data: saved, error } = await run()
  if (error && detectMissingColumn(error)) {
    ;({ data: saved, error } = await run())   // degrada coluna ausente
  }
  if (error) {
    ;({ data: saved, error } = await run())   // retry de erro transitório
  }
  return { saved, error }
}

// Está offline? (em ambientes sem navigator, assume online)
function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

const ERR_SAVE_TASK = 'Não foi possível salvar a tarefa. Tente novamente.'
const MSG_LOCAL_SAVE = 'Tarefa salva localmente. Será sincronizada quando a internet voltar.'

// Calcula o timestamp UTC em que o push deve ser enviado pelo servidor.
// Usa o horário de referência (início/término) conforme reminderAnchor da tarefa.
function calcRemindSendAt(task) {
  if (!task.dueDate || task.reminderOffset == null) return null
  const dueMs = new Date(`${task.dueDate}T${reminderAnchorTime(task)}`).getTime()
  if (isNaN(dueMs)) return null
  const remMs = dueMs - task.reminderOffset * 60 * 1000
  return remMs > Date.now() ? new Date(remMs).toISOString() : null
}

// ── Store ─────────────────────────────────────────────────────────────────────────────
const useStore = create(
  persist(
    (set, get) => ({
      // ─ Auth ─
      session:    null,
      authUser:   null,
      isLoggedIn: false,
      isLoading:  false,

      // ─ User stats ─
      user: {
        name: 'Visitante', email: null, avatar: null,
        xp: 0, level: 1, streak: 0,
        totalFocusSec: 0, todayFocusSec: 0,
        lastActiveDate: null,
      },

      // ─ Tasks ─
      tasks:      [],
      focusTaskId: null,

      // ─ UI ─
      darkMode:         false,
      currentPage:      'loading',
      sidebarOpen:      false,
      quickCaptureOpen:     false,
      quickCaptureDefaults: null,
      xpToast:              null,
      errorToast:           null,  // { message, kind: 'error'|'info', key }
      levelUpModal:     null,
      editingTask:      null,
      notifHistoryOpen: false,
      notifHistory:     [],  // [{ id, taskId, title, body, at, read }]

      // ── Theme ────────────────────────────────────────────────────────────────────
      toggleDarkMode: () => {
        const newDark = !get().darkMode
        applyTheme(newDark)
        set({ darkMode: newDark })
      },
      initTheme: () => applyTheme(get().darkMode),

      // ── Navigation ────────────────────────────────────────────────────────────────
      setPage:             (p)    => set({ currentPage: p, sidebarOpen: false }),
      setSidebarOpen:      (v)    => set({ sidebarOpen: v }),
      setQuickCaptureOpen: (v)    => set({ quickCaptureOpen: v, quickCaptureDefaults: null }),
      openQuickCapture:    (defaults = null) => set({ quickCaptureOpen: true, quickCaptureDefaults: defaults }),
      setEditingTask:      (task) => set({ editingTask: task }),
      setFocusTask:        (id)   => {
        set({ focusTaskId: id })
        const uid = get().authUser?.id
        if (uid) supabase.from('user_stats').upsert({ id: uid, focus_task_id: id })
      },

      // ── Auth ──────────────────────────────────────────────────────────────────────
      setSession: (session) => {
        if (!session) { set(LOGGED_OUT_STATE); return }
        const meta = getUserMeta(session.user)
        set((s) => ({ session, authUser: meta, isLoggedIn: true,
              user: { ...s.user, ...meta } }))
      },

      loadAll: async (session) => {
        const expectedUid   = session.user.id
        const meta          = getUserMeta(session.user)
        const prevUserId    = get().authUser?.id
        const switchingUser = prevUserId && prevUserId !== meta.id

        set((s) => ({
          session, authUser: meta, isLoggedIn: true,
          tasks: switchingUser ? [] : s.tasks,
          user: { ...s.user, name: meta.name, email: meta.email, avatar: meta.avatar },
          currentPage: 'dashboard',
          isLoading: false,
        }))

        try {
          const [statsRes, tasksRes] = await Promise.all([
            supabase.from('user_stats').select('*').eq('id', expectedUid).single(),
            supabase.from('tasks').select('*, subtasks(*)').eq('user_id', expectedUid).order('created_at', { ascending: false }),
          ])

          // Aborta se o usuário mudou enquanto aguardávamos o Supabase
          if (get().authUser?.id !== expectedUid) return

          if (statsRes.error) {
            if (import.meta.env.DEV) console.warn('[Forje] user_stats erro:', statsRes.error.code, statsRes.error.message)
            if (statsRes.error.code === 'PGRST116') {
              // Linha não existe — cria com defaults
              await supabase.from('user_stats').insert({ id: expectedUid }).catch(() => {})
            }
          }

          const stats = statsRes.error ? null : dbStatsToJs(statsRes.data)

          // Preserva completed:true do estado local quando o DB ainda não confirmou o save
          // (race condition: user completa tarefa e recarrega antes do Supabase responder)
          const localTasks = get().tasks
          const tasks = (tasksRes.data || []).map(row => {
            const parsed = dbTaskToJs(row)
            const local  = localTasks.find(l => l.id === parsed.id)
            if (local?.completed && !parsed.completed) {
              return { ...parsed, completed: true, completedAt: local.completedAt }
            }
            return parsed
          })

          // Lê XP local (localStorage) antes de ser sobrescrito pelo Supabase
          const localXp = get().user.xp

          // Valida focusTaskId — descarta se apontar para tarefa concluída ou inexistente
          const savedFocusId = stats?.focusTaskId
          const validFocusId = tasks.find(t => t.id === savedFocusId && !t.completed)?.id || null

          // Preserva tarefas criadas offline ainda não sincronizadas (mesma proteção do reloadTasks)
          const pending  = localTasks.filter(l => l._pendingSync && String(l.id).startsWith('temp_'))
          const allTasks = [...pending, ...tasks]

          set((s) => ({
            user: { ...s.user, ...(stats ?? {}) },
            tasks: allTasks,
            focusTaskId: validFocusId || (allTasks.find(t => !t.completed)?.id || null),
          }))

          // Se Supabase retornou xp=0 mas localStorage tinha xp>0, restaura e sincroniza
          if (stats && stats.xp === 0 && localXp > 0) {
            const restoredLevel = levelFromXp(localXp)
            set((s) => ({ user: { ...s.user, xp: localXp, level: restoredLevel } }))
            supabase.from('user_stats')
              .upsert({ id: expectedUid, xp: localXp, level: restoredLevel })
              .catch(() => {})
          }

          // Reagenda notificações — espera o SW estar ativo para usar canal seguro
          const scheduleAll = () => tasks.forEach(t => { try { scheduleTaskNotification(t) } catch {} })
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(scheduleAll).catch(scheduleAll)
          } else {
            scheduleAll()
          }

          // Garante que a subscription de push está salva no servidor
          if (notificationsSupported() && notificationPermission() === 'granted') {
            subscribeAndSavePush(expectedUid, session?.access_token).catch(() => {})
          }

          if (stats?.lastActiveDate) {
            const yest = new Date(); yest.setDate(yest.getDate() - 1)
            const yesterdayStr = localIso(yest)
            if (stats.lastActiveDate < yesterdayStr) {
              set((s) => ({ user: { ...s.user, streak: 0, todayFocusSec: 0 } }))
              supabase.from('user_stats')
                .upsert({ id: expectedUid, streak: 0, today_focus_sec: 0 })
                .catch(() => {})
            }
          }
        } catch (err) {
          if (import.meta.env.DEV) console.error('[Forje] loadAll failed:', err)
        }
      },

      logout: () => {
        set(LOGGED_OUT_STATE)
        supabase.auth.signOut().catch(() => {})
      },

      deleteAccount: async () => {
        const uid = get().authUser?.id
        if (!uid) return

        try {
          // Deleta dados do app em paralelo
          await Promise.all([
            supabase.from('tasks').delete().eq('user_id', uid),
            supabase.from('user_stats').delete().eq('id', uid),
          ])
          // Deleta a conta no Auth via Edge Function (roda com service role key no servidor)
          await supabase.functions.invoke('delete-account')
        } catch (err) {
          if (import.meta.env.DEV) console.error('[Forje] deleteAccount failed:', err)
        }

        set(LOGGED_OUT_STATE)
        await supabase.auth.signOut().catch(() => {})
      },

      // ── Focus timer ───────────────────────────────────────────────────────────────────
      addFocusTime: async (seconds) => {
        set((s) => ({
          user: {
            ...s.user,
            totalFocusSec: s.user.totalFocusSec + seconds,
            todayFocusSec: s.user.todayFocusSec + seconds,
          },
        }))
        const uid = get().authUser?.id
        if (uid) {
          const { user } = get()
          await supabase.from('user_stats').upsert({
            id: uid,
            total_focus_sec: user.totalFocusSec,
            today_focus_sec: user.todayFocusSec,
          })
        }
      },

      completeFocusSession: async (minutes, sessionStreak = 1) => {
        const seconds    = minutes * 60
        const multiplier = Math.min(2, 1 + (sessionStreak - 1) * 0.25)
        const xpGain     = Math.round(minutes * multiplier)
        const { user }   = get()
        const newXp      = user.xp + xpGain
        const oldLevel   = user.level
        const newLevel   = levelFromXp(newXp)

        const streakLabel = multiplier > 1 ? ` ×${multiplier.toFixed(2).replace(/\.?0+$/, '')}` : ''

        set((s) => ({
          user: {
            ...s.user,
            xp: newXp,
            level: newLevel,
            totalFocusSec: s.user.totalFocusSec + seconds,
            todayFocusSec: s.user.todayFocusSec + seconds,
          },
          xpToast:      { amount: xpGain, taskTitle: `${minutes} min de foco${streakLabel}`, key: Date.now() },
          levelUpModal: newLevel > oldLevel ? { from: oldLevel, to: newLevel } : null,
        }))

        const uid = get().authUser?.id
        if (uid) {
          const { user: u } = get()
          await supabase.from('user_stats').upsert({
            id: uid,
            xp: newXp,
            level: newLevel,
            total_focus_sec: u.totalFocusSec,
            today_focus_sec: u.todayFocusSec,
          })
        }
      },

      resetXp: async () => {
        set((s) => ({ user: { ...s.user, xp: 0, level: 1 } }))
        const uid = get().authUser?.id
        if (uid) {
          await supabase.from('user_stats').upsert({ id: uid, xp: 0, level: 1 })
        }
      },

      // ── Tasks CRUD ────────────────────────────────────────────────────────────────────
      addTask: async (data) => {
        const uid = get().authUser?.id
        if (!uid) return

        const tempId = `temp_${Date.now()}`
        const tempTask = {
          id: tempId, title: data.title.trim(), notes: data.notes || '',
          priority: data.priority || 'medium', project: data.project || 'Geral',
          dueDate: data.dueDate || null, startTime: data.startTime || null, dueTime: data.dueTime || null,
          reminderOffset: data.reminderOffset ?? null,
          reminderAnchor: data.reminderAnchor || 'start',
          recurrence: data.recurrence || 'none',
          completed: false, completedAt: null,
          createdAt: new Date().toISOString(), weekDay: data.weekDay ?? null,
          subtasks: [],
        }
        set((s) => ({ tasks: [tempTask, ...s.tasks] }))

        // Marca a tarefa otimista como pendente de sincronização e avisa o usuário.
        // Mantém o dado local (zustand persist) para reenviar quando a conexão voltar.
        const keepForSync = () => {
          set((s) => ({ tasks: s.tasks.map(t => t.id === tempId ? { ...t, _pendingSync: true } : t) }))
          get().showError(MSG_LOCAL_SAVE, 'info')
          return get().tasks.find(t => t.id === tempId) || tempTask
        }
        // Remove a tarefa otimista e avisa que o salvamento falhou — nunca falha em silêncio.
        const rollback = () => {
          set((s) => ({
            tasks: s.tasks.filter(t => t.id !== tempId),
            focusTaskId: s.focusTaskId === tempId ? null : s.focusTaskId,
          }))
          get().showError(ERR_SAVE_TASK)
          return null
        }

        // Sem internet: não tenta a rede, preserva localmente para sincronizar depois.
        if (isOffline()) return keepForSync()

        try {
          const reminder_send_at = calcRemindSendAt({
            dueDate: data.dueDate || null, startTime: data.startTime || null,
            dueTime: data.dueTime || null, reminderOffset: data.reminderOffset ?? null,
            reminderAnchor: data.reminderAnchor || 'start',
          })
          const payload = { ...jsTaskToDb(data), title: data.title.trim(), user_id: uid, reminder_send_at, reminder_sent_at: null }
          const { saved, error } = await insertTaskRow(payload)

          if (!error && saved) {
            const real = dbTaskToJs(saved)

            // Se o usuário concluiu a tarefa enquanto o insert estava em voo, o estado
            // local tem completed:true, mas a linha recém-criada veio como false. Sem
            // isto, o `real` (false) sobrescreveria a conclusão e a tarefa "voltaria"
            // para pendente. Além disso, o completeTask anterior tentou salvar usando o
            // id temporário — que não bate em nenhuma linha — então re-persistimos com o id real.
            const localNow     = get().tasks.find(t => t.id === tempId)
            const keepCompleted = !!(localNow?.completed && !real.completed)
            const merged = keepCompleted
              ? { ...real, completed: true, completedAt: localNow.completedAt }
              : real

            if (keepCompleted) {
              supabase.from('tasks')
                .update({ completed: true, completed_at: localNow.completedAt })
                .eq('id', real.id)
                .catch(() => {})
            }

            set((s) => {
              // Substitui o temp pelo real e remove eventual duplicata vinda do Realtime
              // (o evento INSERT pode ter adicionado a linha com o id real antes deste swap)
              const deduped = s.tasks.filter(t => t.id === tempId || t.id !== real.id)
              return {
                tasks: deduped.map(t => t.id === tempId ? merged : t),
                focusTaskId: s.focusTaskId === tempId ? real.id : s.focusTaskId,
              }
            })
            if (!merged.completed) { try { scheduleTaskNotification(merged) } catch {} }
            return merged
          }

          // Insert falhou mesmo após os retries. Se a conexão caiu no meio,
          // preserva local para sincronizar; caso contrário, desfaz e avisa.
          return isOffline() ? keepForSync() : rollback()
        } catch (err) {
          if (import.meta.env.DEV) console.error('[Forje] addTask failed:', err)
          return isOffline() ? keepForSync() : rollback()
        }
      },

      updateTask: async (id, patch) => {
        const original = get().tasks.find(t => t.id === id)
        const oldSubs  = original?.subtasks || []

        set((s) => ({
          tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t),
          editingTask: s.editingTask?.id === id ? { ...s.editingTask, ...patch } : s.editingTask,
        }))

        try {
          const dbPatch = jsTaskToDb(patch)
          // Recalcula reminder_send_at quando campos de lembrete mudam
          if ('dueDate' in patch || 'dueTime' in patch || 'startTime' in patch || 'reminderOffset' in patch || 'reminderAnchor' in patch) {
            const orig   = get().tasks.find(t => t.id === id)
            const merged = { ...orig, ...patch }
            dbPatch.reminder_send_at = calcRemindSendAt(merged)
            dbPatch.reminder_sent_at = null
          }
          if (Object.keys(dbPatch).length > 0) {
            let { error } = await supabase.from('tasks').update(stripMissing(dbPatch)).eq('id', id)
            if (error && detectMissingColumn(error)) {
              ;({ error } = await supabase.from('tasks').update(stripMissing(dbPatch)).eq('id', id))  // degrada coluna ausente
            }
            if (error) {
              ;({ error } = await supabase.from('tasks').update(stripMissing(dbPatch)).eq('id', id))  // retry transitório
            }
            // Falha persistente online: o update não foi salvo. Reverte para o original
            // e avisa — não seguir como se tivesse dado certo. (Offline mantém otimista.)
            if (error && navigator.onLine) {
              if (import.meta.env.DEV) console.error('[Forje] updateTask save failed:', error)
              if (original) {
                set((s) => ({
                  tasks: s.tasks.map(t => t.id === id ? original : t),
                  editingTask: s.editingTask?.id === id ? original : s.editingTask,
                }))
              }
              get().showError(ERR_SAVE_TASK)
              return
            }
          }

          if (patch.subtasks !== undefined) {
            const newSubs = patch.subtasks
            const deletedIds = oldSubs
              .filter(o => !newSubs.some(n => n.id === o.id))
              .map(s => s.id)
            if (deletedIds.length > 0) {
              await supabase.from('subtasks').delete().in('id', deletedIds)
            }
            const addedSubs = newSubs.filter(n => !oldSubs.some(o => o.id === n.id))
            for (const sub of addedSubs) {
              const { data: inserted } = await supabase
                .from('subtasks')
                .insert({ task_id: id, title: sub.title, done: sub.done })
                .select()
                .single()
              if (inserted) {
                set((s) => ({
                  tasks: s.tasks.map(t =>
                    t.id === id
                      ? { ...t, subtasks: t.subtasks.map(st => st.id === sub.id ? { ...st, id: inserted.id } : st) }
                      : t
                  ),
                }))
              }
            }
          }

          const updatedTask = get().tasks.find(t => t.id === id)
          if (updatedTask) try { scheduleTaskNotification(updatedTask) } catch {}
        } catch (err) {
          if (import.meta.env.DEV) console.error('[Forje] updateTask failed:', err)
          // Offline: mantém a edição otimista (persistida localmente). Online: reverte e avisa.
          if (original && navigator.onLine) {
            set((s) => ({
              tasks: s.tasks.map(t => t.id === id ? original : t),
              editingTask: s.editingTask?.id === id ? original : s.editingTask,
            }))
            get().showError(ERR_SAVE_TASK)
          }
        }
      },

      deleteTask: async (id) => {
        const backup = get().tasks.find(t => t.id === id)
        cancelTaskNotification(id)
        set((s) => ({
          tasks: s.tasks.filter(t => t.id !== id),
          focusTaskId: s.focusTaskId === id ? null : s.focusTaskId,
          editingTask: s.editingTask?.id === id ? null : s.editingTask,
        }))
        // Tarefa que nunca chegou ao servidor (offline/pendingSync): some só do estado local.
        if (String(id).startsWith('temp_')) return

        const restore = () => {
          if (backup) set((s) => ({ tasks: [backup, ...s.tasks] }))
          get().showError('Não foi possível remover a tarefa. Tente novamente.')
        }
        try {
          const { error } = await supabase.from('tasks').delete().eq('id', id)
          // Erro retornado sem throw (RLS/rede) — antes era ignorado e a tarefa "ressuscitava"
          // no próximo reload. Online: restaura no UI e avisa. Offline: confia no reenvio/reload.
          if (error && navigator.onLine) {
            if (import.meta.env.DEV) console.error('[Forje] deleteTask error:', error)
            restore()
          }
        } catch (err) {
          if (import.meta.env.DEV) console.error('[Forje] deleteTask failed:', err)
          if (navigator.onLine) restore()
        }
      },

      completeTask: async (id) => {
        const { tasks, user } = get()
        const task = tasks.find(t => t.id === id)
        if (!task || task.completed) return

        const xpGain   = XP_TABLE[task.priority] ?? 20
        const oldLevel = levelFromXp(user.xp)
        const newXp    = user.xp + xpGain
        const newLevel = levelFromXp(newXp)
        const now          = new Date().toISOString()
        const today        = localIso()
        const yesterdayD   = new Date(); yesterdayD.setDate(yesterdayD.getDate() - 1)
        const yesterdayStr = localIso(yesterdayD)
        const newStreak = user.lastActiveDate === today ? user.streak
          : user.lastActiveDate === yesterdayStr ? user.streak + 1
          : 1

        set((s) => ({
          tasks: s.tasks.map(t => t.id === id ? { ...t, completed: true, completedAt: now } : t),
          user:  { ...s.user, xp: newXp, level: newLevel, streak: newStreak, lastActiveDate: today },
          xpToast:      { amount: xpGain, taskTitle: task.title, key: Date.now() },
          levelUpModal: newLevel > oldLevel ? { from: oldLevel, to: newLevel } : null,
          focusTaskId: s.focusTaskId === id
            ? (s.tasks.find(t => !t.completed && t.id !== id)?.id || null)
            : s.focusTaskId,
        }))

        const uid = get().authUser?.id
        if (uid) {
          const [taskResult, statsResult] = await Promise.all([
            supabase.from('tasks').update({ completed: true, completed_at: now }).eq('id', id),
            supabase.from('user_stats').upsert({ id: uid, xp: newXp, level: newLevel, streak: newStreak, last_active_date: today }),
          ])

          // Tarefa não salvou — tenta uma vez mais antes de reverter (erro de rede transitório)
          if (taskResult.error) {
            if (import.meta.env.DEV) console.error('[Forje] completeTask task save failed:', taskResult.error)
            const retry = await supabase.from('tasks')
              .update({ completed: true, completed_at: now }).eq('id', id)
              .then(r => r, e => ({ error: e }))

            // Offline: mantém a conclusão (persistida localmente; loadAll preserva e ressincroniza).
            // Online com erro persistente: reverte tudo no UI para não enganar o usuário.
            if (retry.error && navigator.onLine) {
              set((s) => ({
                tasks: s.tasks.map(t => t.id === id ? { ...t, completed: false, completedAt: null } : t),
                user:  { ...s.user, xp: user.xp, level: oldLevel, streak: user.streak, lastActiveDate: user.lastActiveDate },
                xpToast: null,
                levelUpModal: null,
              }))
              return
            }
          }

          // Tarefa salvou mas XP falhou — tenta uma vez mais
          if (statsResult.error) {
            if (import.meta.env.DEV) console.error('[Forje] completeTask XP save failed:', statsResult.error)
            supabase.from('user_stats')
              .upsert({ id: uid, xp: newXp, level: newLevel, streak: newStreak, last_active_date: today })
              .catch(() => {})
          }

          // Recorrência: ao concluir, gera a próxima ocorrência com a data avançada.
          // Só online (evita criar cópias órfãs sem id real quando offline).
          if (navigator.onLine && task.recurrence && task.recurrence !== 'none' && task.dueDate) {
            const nextDate = advanceDate(task.dueDate, task.recurrence)
            if (nextDate) {
              get().addTask({
                title: task.title, notes: task.notes, priority: task.priority, project: task.project,
                dueDate: nextDate, startTime: task.startTime, dueTime: task.dueTime,
                reminderOffset: task.reminderOffset, reminderAnchor: task.reminderAnchor,
                recurrence: task.recurrence,
              })
            }
          }
        }
      },

      uncompleteTask: async (id) => {
        const task = get().tasks.find(t => t.id === id)
        if (!task || !task.completed) return

        const xpLoss  = XP_TABLE[task.priority] ?? 20
        const newXp   = Math.max(0, get().user.xp - xpLoss)
        const newLevel = levelFromXp(newXp)

        set((s) => ({
          tasks: s.tasks.map(t => t.id === id ? { ...t, completed: false, completedAt: null } : t),
          user:  { ...s.user, xp: newXp, level: newLevel },
        }))

        const uid = get().authUser?.id
        if (uid) {
          await Promise.all([
            supabase.from('tasks').update({ completed: false, completed_at: null, reminder_sent_at: null }).eq('id', id),
            supabase.from('user_stats').upsert({ id: uid, xp: newXp, level: newLevel }),
          ])
        }
      },

      // ── Subtasks ─────────────────────────────────────────────────────────────────────────
      toggleSubtask: async (taskId, subId) => {
        const task = get().tasks.find(t => t.id === taskId)
        const sub  = task?.subtasks?.find(s => s.id === subId)
        if (!sub) return

        const done = !sub.done
        const applyDone = (value) => set((s) => ({
          tasks: s.tasks.map(t =>
            t.id === taskId
              ? { ...t, subtasks: t.subtasks.map(st => st.id === subId ? { ...st, done: value } : st) }
              : t
          ),
          editingTask: s.editingTask?.id === taskId
            ? { ...s.editingTask, subtasks: s.editingTask.subtasks.map(st => st.id === subId ? { ...st, done: value } : st) }
            : s.editingTask,
        }))
        applyDone(done)

        try {
          const { error } = await supabase.from('subtasks').update({ done }).eq('id', subId)
          // Erro retornado sem throw — antes era ignorado e o toggle não persistia.
          if (error && navigator.onLine) {
            if (import.meta.env.DEV) console.error('[Forje] toggleSubtask error:', error)
            applyDone(sub.done)  // reverte ao valor anterior
            get().showError('Não foi possível salvar a subtarefa. Tente novamente.')
          }
        } catch (err) {
          if (import.meta.env.DEV) console.error('[Forje] toggleSubtask failed:', err)
          if (navigator.onLine) {
            applyDone(sub.done)
            get().showError('Não foi possível salvar a subtarefa. Tente novamente.')
          }
        }
      },

      // ── Realtime ─────────────────────────────────────────────────────────────────────────
      applyRealtimeChange: (event, table, newRow, oldRow) => {
        const uid = get().authUser?.id
        // Rejeita silenciosamente qualquer evento que não pertença ao usuário logado
        if (!uid) return

        if (table === 'tasks') {
          const rowUid = (newRow || oldRow)?.user_id
          if (rowUid && rowUid !== uid) return

          if (event === 'INSERT') {
            const task = dbTaskToJs({ ...newRow, subtasks: [] })
            set((s) => {
              const exists = s.tasks.some(t => t.id === task.id)
              if (exists) return {}
              return { tasks: [task, ...s.tasks] }
            })
          } else if (event === 'UPDATE') {
            const existing = get().tasks.find(t => t.id === newRow.id)
            if (!existing) return
            const updated = dbTaskToJs({ ...newRow, subtasks: existing.subtasks || [] })
            // Não regride completed:true → false via Realtime (evento pode ser de campo diferente)
            if (existing.completed && !updated.completed) {
              updated.completed  = true
              updated.completedAt = existing.completedAt
            }
            set((s) => ({ tasks: s.tasks.map(t => t.id === newRow.id ? updated : t) }))
          } else if (event === 'DELETE') {
            set((s) => ({ tasks: s.tasks.filter(t => t.id !== oldRow.id) }))
          }
        }

        if (table === 'user_stats' && (event === 'UPDATE' || event === 'INSERT')) {
          if (newRow?.id !== uid) return
          const stats = dbStatsToJs(newRow)
          set((s) => ({ user: { ...s.user, ...stats } }))
        }
      },

      // ── Helpers ─────────────────────────────────────────────────────────────────────────
      reloadTasks: async () => {
        const { authUser } = get()
        if (!authUser?.id) return { ok: false }
        try {
          const { data, error } = await supabase
            .from('tasks')
            .select('*, subtasks(*)')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false })
          if (error) return { ok: false }
          // Preserva conclusões locais que ainda não confirmaram no banco
          // (mesma proteção do loadAll — evita reverter "executada" → "não executada")
          const localTasks = get().tasks
          const tasks = (data || []).map(row => {
            const parsed = dbTaskToJs(row)
            const local  = localTasks.find(l => l.id === parsed.id)
            if (local?.completed && !parsed.completed) {
              return { ...parsed, completed: true, completedAt: local.completedAt }
            }
            return parsed
          })
          // Preserva tarefas criadas offline ainda não sincronizadas — senão o reload
          // (que só traz o que está no banco) as apagaria antes do reenvio.
          const pending = localTasks.filter(l => l._pendingSync && String(l.id).startsWith('temp_'))
          set({ tasks: [...pending, ...tasks] })
          return { ok: true, count: tasks.length }
        } catch {
          return { ok: false }
        }
      },

      // Reenvia ao Supabase as tarefas criadas offline (marcadas com _pendingSync e
      // ainda com id temporário). Chamado pelo listener de 'online' em App.jsx.
      syncPendingTasks: async () => {
        const uid = get().authUser?.id
        if (!uid || isOffline()) return
        const pending = get().tasks.filter(t => t._pendingSync && String(t.id).startsWith('temp_'))
        if (pending.length === 0) return

        for (const t of pending) {
          const reminder_send_at = calcRemindSendAt(t)
          const payload = { ...jsTaskToDb(t), title: t.title, user_id: uid, reminder_send_at, reminder_sent_at: null }
          let saved, error
          try {
            ;({ saved, error } = await insertTaskRow(payload))
          } catch (err) {
            if (import.meta.env.DEV) console.error('[Forje] syncPendingTasks failed:', err)
            continue  // mantém _pendingSync para a próxima tentativa
          }
          if (!error && saved) {
            const real = dbTaskToJs(saved)
            set((s) => {
              const deduped = s.tasks.filter(x => x.id === t.id || x.id !== real.id)
              return {
                tasks: deduped.map(x => x.id === t.id ? real : x),
                focusTaskId: s.focusTaskId === t.id ? real.id : s.focusTaskId,
              }
            })
            if (!real.completed) { try { scheduleTaskNotification(real) } catch {} }
          }
          // erro persistente: mantém _pendingSync (tenta de novo no próximo 'online')
        }
      },

      recalcXpFromTasks: async () => {
        const { tasks, authUser } = get()
        if (!authUser?.id) return { xp: 0, level: 1 }
        const xp    = tasks.filter(t => t.completed).reduce((sum, t) => sum + (XP_TABLE[t.priority] ?? 20), 0)
        const level = levelFromXp(xp)
        set(s => ({ user: { ...s.user, xp, level } }))
        try { await supabase.from('user_stats').upsert({ id: authUser.id, xp, level }) } catch {}
        return { xp, level }
      },

      setNotifHistoryOpen: (v) => set({ notifHistoryOpen: v }),
      addNotifToHistory: (entry) => set(s => ({
        notifHistory: [
          { id: `n${Date.now()}`, read: false, ...entry },
          ...s.notifHistory,
        ].slice(0, 50),
      })),
      markNotifsRead:    () => set(s => ({ notifHistory: s.notifHistory.map(n => ({ ...n, read: true })) })),
      clearNotifHistory: () => set({ notifHistory: [] }),

      clearXpToast:      () => set({ xpToast: null }),
      clearLevelUpModal: () => set({ levelUpModal: null }),

      // Toast genérico de feedback (erro de salvamento, aviso de sync local, etc.)
      showError:       (message, kind = 'error') => set({ errorToast: { message, kind, key: Date.now() } }),
      clearErrorToast: () => set({ errorToast: null }),

      getActiveTasks:    () => get().tasks.filter(t => !t.completed),
      getCompletedToday: () => {
        const today = new Date().toDateString()
        return get().tasks.filter(t => t.completed && t.completedAt && new Date(t.completedAt).toDateString() === today)
      },
      getFocusTask:  () => get().tasks.find(t => t.id === get().focusTaskId) || null,
      getXpProgress: () => xpProgressInLevel(get().user.xp),
    }),
    {
      name: 'forge-v2',
      partialize: (s) => ({
        darkMode:     s.darkMode,
        focusTaskId:  s.focusTaskId,
        tasks:        s.tasks,
        user:         { xp: s.user.xp, level: s.user.level, streak: s.user.streak, lastActiveDate: s.user.lastActiveDate },
        notifHistory: s.notifHistory,
      }),
      // Merge profundo: evita que user.xp sobrescreva o objeto user inteiro
      merge: (persisted, current) => ({
        ...current,
        darkMode:     persisted.darkMode     ?? current.darkMode,
        focusTaskId:  persisted.focusTaskId  ?? current.focusTaskId,
        tasks:        persisted.tasks        ?? current.tasks,
        user:         { ...current.user, ...(persisted.user ?? {}) },
        notifHistory: persisted.notifHistory ?? [],
      }),
    }
  )
)

export default useStore
