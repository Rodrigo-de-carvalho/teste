import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, dbTaskToJs, jsTaskToDb, dbStatsToJs, getUserMeta } from '../lib/supabase.js'
import { scheduleTaskNotification, cancelTaskNotification } from '../utils/notifications.js'
import { localIso } from '../utils/dates.js'

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
      levelUpModal:     null,
      editingTask:      null,

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

          const stats = statsRes.error ? null : dbStatsToJs(statsRes.data)
          const tasks = (tasksRes.data || []).map(dbTaskToJs)

          // Valida focusTaskId — descarta se apontar para tarefa concluída ou inexistente
          const savedFocusId = stats?.focusTaskId
          const validFocusId = tasks.find(t => t.id === savedFocusId && !t.completed)?.id || null

          set((s) => ({
            user: { ...s.user, ...(stats ?? {}) },
            tasks,
            focusTaskId: validFocusId || (tasks.find(t => !t.completed)?.id || null),
          }))

          // Reagenda notificações — espera o SW estar ativo para usar canal seguro
          const scheduleAll = () => tasks.forEach(t => { try { scheduleTaskNotification(t) } catch {} })
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(scheduleAll).catch(scheduleAll)
          } else {
            scheduleAll()
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
          dueDate: data.dueDate || null, dueTime: data.dueTime || null,
          completed: false, completedAt: null,
          createdAt: new Date().toISOString(), weekDay: data.weekDay ?? null,
          subtasks: [],
        }
        set((s) => ({ tasks: [tempTask, ...s.tasks] }))

        try {
          const { data: saved, error } = await withTimeout(
            supabase
              .from('tasks')
              .insert({ ...jsTaskToDb(data), title: data.title.trim(), user_id: uid })
              .select('*, subtasks(*)')
              .single(),
            10000
          )

          if (!error && saved) {
            const real = dbTaskToJs(saved)
            set((s) => ({
              tasks: s.tasks.map(t => t.id === tempId ? real : t),
              focusTaskId: s.focusTaskId === tempId ? real.id : s.focusTaskId,
            }))
            try { scheduleTaskNotification(real) } catch {}
            return real
          }
        } catch {}
        return tempTask
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
          if (Object.keys(dbPatch).length > 0) {
            await supabase.from('tasks').update(dbPatch).eq('id', id)
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
          if (original) {
            set((s) => ({
              tasks: s.tasks.map(t => t.id === id ? original : t),
              editingTask: s.editingTask?.id === id ? original : s.editingTask,
            }))
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
        try {
          await supabase.from('tasks').delete().eq('id', id)
        } catch (err) {
          if (import.meta.env.DEV) console.error('[Forje] deleteTask failed:', err)
          if (backup) {
            set((s) => ({ tasks: [backup, ...s.tasks] }))
          }
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

          // Tarefa não salvou — reverte tudo no UI
          if (taskResult.error) {
            if (import.meta.env.DEV) console.error('[Forje] completeTask task save failed:', taskResult.error)
            set((s) => ({
              tasks: s.tasks.map(t => t.id === id ? { ...t, completed: false, completedAt: null } : t),
              user:  { ...s.user, xp: user.xp, level: oldLevel, streak: user.streak, lastActiveDate: user.lastActiveDate },
              xpToast: null,
              levelUpModal: null,
            }))
            return
          }

          // Tarefa salvou mas XP falhou — tenta uma vez mais
          if (statsResult.error) {
            if (import.meta.env.DEV) console.error('[Forje] completeTask XP save failed:', statsResult.error)
            supabase.from('user_stats')
              .upsert({ id: uid, xp: newXp, level: newLevel, streak: newStreak, last_active_date: today })
              .catch(() => {})
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
            supabase.from('tasks').update({ completed: false, completed_at: null }).eq('id', id),
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
        set((s) => ({
          tasks: s.tasks.map(t =>
            t.id === taskId
              ? { ...t, subtasks: t.subtasks.map(st => st.id === subId ? { ...st, done } : st) }
              : t
          ),
          editingTask: s.editingTask?.id === taskId
            ? { ...s.editingTask, subtasks: s.editingTask.subtasks.map(st => st.id === subId ? { ...st, done } : st) }
            : s.editingTask,
        }))
        await supabase.from('subtasks').update({ done }).eq('id', subId)
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
      clearXpToast:      () => set({ xpToast: null }),
      clearLevelUpModal: () => set({ levelUpModal: null }),

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
        darkMode:    s.darkMode,
        focusTaskId: s.focusTaskId,
        tasks:       s.tasks,
        user:        { xp: s.user.xp, level: s.user.level, streak: s.user.streak, lastActiveDate: s.user.lastActiveDate },
      }),
      // Merge profundo: evita que user.xp sobrescreva o objeto user inteiro
      merge: (persisted, current) => ({
        ...current,
        darkMode:    persisted.darkMode    ?? current.darkMode,
        focusTaskId: persisted.focusTaskId ?? current.focusTaskId,
        tasks:       persisted.tasks       ?? current.tasks,
        user:        { ...current.user, ...(persisted.user ?? {}) },
      }),
    }
  )
)

export default useStore
