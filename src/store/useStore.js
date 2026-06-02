import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, dbTaskToJs, jsTaskToDb, dbStatsToJs, getUserMeta } from '../lib/supabase.js'
import { scheduleTaskNotification, cancelTaskNotification } from '../utils/notifications.js'

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
  user: { name: 'Visitante', email: null, avatar: null, xp: 0, level: 1, streak: 0, totalFocusSec: 0, todayFocusSec: 0 },
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
      },

      // ─ Tasks ─
      tasks:      [],
      focusTaskId: null,

      // ─ UI ─
      darkMode:         false,
      currentPage:      'loading',
      sidebarOpen:      false,
      quickCaptureOpen: false,
      xpToast:          null,
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
      setQuickCaptureOpen: (v)    => set({ quickCaptureOpen: v }),
      setEditingTask:      (task) => set({ editingTask: task }),
      setFocusTask:        (id)   => {
        set({ focusTaskId: id })
        const uid = get().authUser?.id
        if (uid) supabase.from('user_stats').update({ focus_task_id: id }).eq('id', uid)
      },

      // ── Auth ──────────────────────────────────────────────────────────────────────
      setSession: (session) => {
        if (!session) { set(LOGGED_OUT_STATE); return }
        const meta = getUserMeta(session.user)
        set((s) => ({ session, authUser: meta, isLoggedIn: true,
              user: { ...s.user, ...meta } }))
      },

      initAuth: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await get().loadAll(session)
        } else {
          set({ currentPage: 'login', isLoading: false })
        }
      },

      loadAll: async (session) => {
        const meta = getUserMeta(session.user)

        // Mostra o app imediatamente mantendo o cache local
        set((s) => ({
          session, authUser: meta, isLoggedIn: true,
          user: { ...s.user, name: meta.name, email: meta.email, avatar: meta.avatar },
          currentPage: 'dashboard',
          isLoading: false,
        }))

        try {
          const [statsRes, tasksRes] = await Promise.all([
            supabase.from('user_stats').select('*').eq('id', session.user.id).single(),
            supabase.from('tasks').select('*, subtasks(*)').eq('user_id', session.user.id).order('created_at', { ascending: false }),
          ])

          // Não aplica se o usuário já saiu enquanto o fetch corria
          if (!get().isLoggedIn) return

          const stats = dbStatsToJs(statsRes.data)
          const tasks = (tasksRes.data || []).map(dbTaskToJs)
          set((s) => ({
            user: { ...s.user, ...(stats || {}) },
            tasks,
            focusTaskId: stats?.focusTaskId || (tasks.find(t => !t.completed)?.id || null),
          }))
        } catch { /* silently ignore — usuário já está na tela principal com cache */ }
      },

      logout: () => {
        // Limpa o estado local primeiro — UI vai para login imediatamente,
        // sem depender de rede. signOut() invalida o token no servidor em background.
        set(LOGGED_OUT_STATE)
        supabase.auth.signOut().catch(() => {})
      },

      deleteAccount: async () => {
        const uid = get().authUser?.id
        if (!uid) return
        set(LOGGED_OUT_STATE)
        await supabase.from('tasks').delete().eq('user_id', uid)
        await supabase.from('user_stats').delete().eq('id', uid)
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
          await supabase.from('user_stats').update({
            total_focus_sec: user.totalFocusSec,
            today_focus_sec: user.todayFocusSec,
          }).eq('id', uid)
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

        const { data: saved, error } = await supabase
          .from('tasks')
          .insert({ ...jsTaskToDb(data), title: data.title.trim(), user_id: uid })
          .select('*, subtasks(*)')
          .single()

        if (!error && saved) {
          const real = dbTaskToJs(saved)
          set((s) => ({
            tasks: s.tasks.map(t => t.id === tempId ? real : t),
            focusTaskId: s.focusTaskId === tempId ? real.id : s.focusTaskId,
          }))
          scheduleTaskNotification(real)
          return real
        }
        return tempTask
      },

      updateTask: async (id, patch) => {
        const oldSubs = get().tasks.find(t => t.id === id)?.subtasks || []

        set((s) => ({
          tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t),
          editingTask: s.editingTask?.id === id ? { ...s.editingTask, ...patch } : s.editingTask,
        }))

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
        if (updatedTask) scheduleTaskNotification(updatedTask)
      },

      deleteTask: async (id) => {
        cancelTaskNotification(id)
        set((s) => ({
          tasks: s.tasks.filter(t => t.id !== id),
          focusTaskId: s.focusTaskId === id ? null : s.focusTaskId,
          editingTask: s.editingTask?.id === id ? null : s.editingTask,
        }))
        await supabase.from('tasks').delete().eq('id', id)
      },

      completeTask: async (id) => {
        const { tasks, user } = get()
        const task = tasks.find(t => t.id === id)
        if (!task || task.completed) return

        const xpGain   = XP_TABLE[task.priority] ?? 20
        const oldLevel = levelFromXp(user.xp)
        const newXp    = user.xp + xpGain
        const newLevel = levelFromXp(newXp)
        const now      = new Date().toISOString()

        set((s) => ({
          tasks: s.tasks.map(t => t.id === id ? { ...t, completed: true, completedAt: now } : t),
          user:  { ...s.user, xp: newXp, level: newLevel },
          xpToast:     { amount: xpGain, taskTitle: task.title, key: Date.now() },
          levelUpModal: newLevel > oldLevel ? { from: oldLevel, to: newLevel } : null,
          focusTaskId: s.focusTaskId === id
            ? (s.tasks.find(t => !t.completed && t.id !== id)?.id || null)
            : s.focusTaskId,
        }))

        const uid = get().authUser?.id
        if (uid) {
          await Promise.all([
            supabase.from('tasks').update({ completed: true, completed_at: now }).eq('id', id),
            supabase.from('user_stats').update({ xp: newXp, level: newLevel }).eq('id', uid),
          ])
        }
      },

      uncompleteTask: async (id) => {
        set((s) => ({
          tasks: s.tasks.map(t => t.id === id ? { ...t, completed: false, completedAt: null } : t),
        }))
        await supabase.from('tasks').update({ completed: false, completed_at: null }).eq('id', id)
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
        if (table === 'tasks') {
          if (event === 'INSERT') {
            const task = dbTaskToJs({ ...newRow, subtasks: [] })
            set((s) => {
              const exists = s.tasks.some(t => t.id === task.id)
              if (exists) return {}
              return { tasks: [task, ...s.tasks] }
            })
          } else if (event === 'UPDATE') {
            const updated = dbTaskToJs({ ...newRow, subtasks: get().tasks.find(t => t.id === newRow.id)?.subtasks || [] })
            set((s) => ({ tasks: s.tasks.map(t => t.id === newRow.id ? updated : t) }))
          } else if (event === 'DELETE') {
            set((s) => ({ tasks: s.tasks.filter(t => t.id !== oldRow.id) }))
          }
        }
        if (table === 'user_stats' && event === 'UPDATE') {
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
        return get().tasks.filter(t => t.completed && new Date(t.completedAt).toDateString() === today)
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
        user:        s.user,
      }),
    }
  )
)

export default useStore
