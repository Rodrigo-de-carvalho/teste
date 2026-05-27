import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, dbTaskToJs, jsTaskToDb, dbStatsToJs, getUserMeta } from '../lib/supabase.js'

// ── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark)
}

// ── XP ───────────────────────────────────────────────────────────────────────
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

// ── Store ─────────────────────────────────────────────────────────────────────
const useStore = create(
  persist(
    (set, get) => ({
      // ─ Auth ─
      session:    null,
      authUser:   null,   // { id, email, name, avatar }
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

      // ── Theme ─────────────────────────────────────────────────────────────
      toggleDarkMode: () => set((s) => {
        applyTheme(!s.darkMode)
        return { darkMode: !s.darkMode }
      }),
      initTheme: () => applyTheme(get().darkMode),

      // ── Navigation ────────────────────────────────────────────────────────
      setPage:             (p)    => set({ currentPage: p, sidebarOpen: false }),
      setSidebarOpen:      (v)    => set({ sidebarOpen: v }),
      setQuickCaptureOpen: (v)    => set({ quickCaptureOpen: v }),
      setEditingTask:      (task) => set({ editingTask: task }),
      setFocusTask:        (id)   => {
        set({ focusTaskId: id })
        // Persiste no banco
        const uid = get().authUser?.id
        if (uid) supabase.from('user_stats').update({ focus_task_id: id }).eq('id', uid)
      },

      // ── Auth ──────────────────────────────────────────────────────────────
      setSession: (session) => {
        if (!session) {
          set({ session: null, authUser: null, isLoggedIn: false,
                tasks: [], currentPage: 'login', user: { name: 'Visitante', email: null, avatar: null, xp: 0, level: 1, streak: 0, totalFocusSec: 0, todayFocusSec: 0 } })
          return
        }
        const meta = getUserMeta(session.user)
        set({ session, authUser: meta, isLoggedIn: true,
              user: (s) => ({ ...s.user, ...meta }) })
      },

      initAuth: async () => {
        set({ isLoading: true })
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await get().loadAll(session)
        } else {
          set({ currentPage: 'login', isLoading: false })
        }
      },

      loadAll: async (session) => {
        set({ isLoading: true })
        const meta = getUserMeta(session.user)
        set({ session, authUser: meta, isLoggedIn: true })

        try {
          // Carrega stats e tarefas em paralelo
          const [statsRes, tasksRes] = await Promise.all([
            supabase.from('user_stats').select('*').eq('id', session.user.id).single(),
            supabase.from('tasks').select('*, subtasks(*)').eq('user_id', session.user.id).order('created_at', { ascending: false }),
          ])

          const stats = dbStatsToJs(statsRes.data)
          const tasks = (tasksRes.data || []).map(dbTaskToJs)

          set({
            user: { ...meta, ...(stats || {}) },
            tasks,
            focusTaskId: stats?.focusTaskId || (tasks.find(t => !t.completed)?.id || null),
            currentPage: 'dashboard',
            isLoading: false,
          })
        } catch {
          set({ currentPage: 'dashboard', isLoading: false })
        }
      },

      logout: async () => {
        await supabase.auth.signOut()
        set({
          session: null, authUser: null, isLoggedIn: false,
          tasks: [], focusTaskId: null, currentPage: 'login',
          user: { name: 'Visitante', email: null, avatar: null, xp: 0, level: 1, streak: 0, totalFocusSec: 0, todayFocusSec: 0 },
        })
      },

      // ── Focus timer ───────────────────────────────────────────────────────
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

      // ── Tasks CRUD ────────────────────────────────────────────────────────
      addTask: async (data) => {
        const uid = get().authUser?.id
        if (!uid) return

        // Optimistic: add with temp id
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

        // Insert no Supabase
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
          return real
        }
        return tempTask
      },

      updateTask: async (id, patch) => {
        // Optimistic
        set((s) => ({
          tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t),
          editingTask: s.editingTask?.id === id ? { ...s.editingTask, ...patch } : s.editingTask,
        }))
        await supabase.from('tasks').update(jsTaskToDb(patch)).eq('id', id)
      },

      deleteTask: async (id) => {
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

        // Optimistic
        set((s) => ({
          tasks: s.tasks.map(t => t.id === id ? { ...t, completed: true, completedAt: now } : t),
          user:  { ...s.user, xp: newXp, level: newLevel },
          xpToast:     { amount: xpGain, taskTitle: task.title, key: Date.now() },
          levelUpModal: newLevel > oldLevel ? { from: oldLevel, to: newLevel } : null,
          focusTaskId: s.focusTaskId === id
            ? (s.tasks.find(t => !t.completed && t.id !== id)?.id || null)
            : s.focusTaskId,
        }))

        // Persiste
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

      // ── Subtasks ──────────────────────────────────────────────────────────
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

      // ── Realtime: aplica mudanças vindas de outros dispositivos ───────────
      applyRealtimeChange: (event, table, newRow, oldRow) => {
        if (table === 'tasks') {
          if (event === 'INSERT') {
            const task = dbTaskToJs({ ...newRow, subtasks: [] })
            set((s) => {
              // Evita duplicar (já pode estar localmente como temp)
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

      // ── Clear helpers ─────────────────────────────────────────────────────
      clearXpToast:      () => set({ xpToast: null }),
      clearLevelUpModal: () => set({ levelUpModal: null }),

      // ── Selectors ─────────────────────────────────────────────────────────
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
      partialize: (s) => ({ darkMode: s.darkMode, focusTaskId: s.focusTaskId }),
    }
  )
)

export default useStore
