import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Apply dark mode class on html element
function applyTheme(dark) {
  if (dark) document.documentElement.classList.add('dark')
  else       document.documentElement.classList.remove('dark')
}

// ── XP & Level ──────────────────────────────────────────────────────────────
const XP_TABLE = {
  critical: 50,
  high:     30,
  medium:   20,
  low:      10,
}

function xpForLevel(level) {
  if (level <= 1) return 0
  return Math.floor(100 * (level - 1) * 1.4)
}

function totalXpToReach(level) {
  let total = 0
  for (let l = 2; l <= level; l++) total += xpForLevel(l)
  return total
}

function levelFromXp(xp) {
  let level = 1
  while (totalXpToReach(level + 1) <= xp) level++
  return level
}

function xpProgressInLevel(xp) {
  const level  = levelFromXp(xp)
  const start  = totalXpToReach(level)
  const end    = totalXpToReach(level + 1)
  const earned = xp - start
  const needed = end - start
  return { level, earned, needed, pct: Math.round((earned / needed) * 100) }
}

// ── Seed tasks ───────────────────────────────────────────────────────────────
const SEED_TASKS = [
  {
    id: '1',
    title: 'Definir identidade visual do Forge',
    notes: 'Escolher paleta final, tipografia e grids para o design system.',
    priority: 'critical',
    project: 'Forge App',
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '18:00',
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    weekDay: new Date().getDay(),
    subtasks: [
      { id: 's1', title: 'Revisar paleta de cores', done: false },
      { id: 's2', title: 'Testar tipografia mobile', done: false },
    ],
  },
  {
    id: '2',
    title: 'Implementar Quick Capture com atalho Ctrl+K',
    notes: '',
    priority: 'high',
    project: 'Forge App',
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: null,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    weekDay: new Date().getDay(),
    subtasks: [],
  },
  {
    id: '3',
    title: 'Pesquisar concorrentes: Things 3, Notion, Linear',
    notes: 'Mapear features que fazem o usuário querer abrir o app todo dia.',
    priority: 'medium',
    project: 'Pesquisa',
    dueDate: null,
    dueTime: null,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    weekDay: (new Date().getDay() + 1) % 7,
    subtasks: [],
  },
  {
    id: '4',
    title: 'Configurar repositório GitHub',
    notes: '',
    priority: 'low',
    project: 'Forge App',
    dueDate: null,
    dueTime: null,
    completed: true,
    completedAt: new Date(Date.now() - 3_600_000).toISOString(),
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    weekDay: null,
    subtasks: [],
  },
  {
    id: '5',
    title: 'Criar apresentação para cliente Nexo',
    notes: 'Slides com resultados do Q2 e proposta Q3.',
    priority: 'critical',
    project: 'Nexo',
    dueDate: new Date(Date.now() + 86_400_000).toISOString().split('T')[0],
    dueTime: '10:00',
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    weekDay: (new Date().getDay() + 1) % 7,
    subtasks: [],
  },
  {
    id: '6',
    title: 'Revisar contrato de serviço',
    notes: '',
    priority: 'medium',
    project: 'Nexo',
    dueDate: new Date(Date.now() + 2 * 86_400_000).toISOString().split('T')[0],
    dueTime: null,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    weekDay: (new Date().getDay() + 2) % 7,
    subtasks: [],
  },
]

// ── Store ────────────────────────────────────────────────────────────────────
const useStore = create(
  persist(
    (set, get) => ({
      // ─ State ─
      tasks:        SEED_TASKS,
      user: {
        name:        'Visitante',
        xp:          0,
        streak:      0,
        totalFocusSec: 0,
        todayFocusSec: 0,
        avatar:      null,
        email:       null,
      },
      isLoggedIn:   false,   // true quando autenticado via Google
      isLoading:    false,
      focusTaskId:  null,
      darkMode:     false,
      currentPage:  'dashboard',
      sidebarOpen:  false,
      quickCaptureOpen: false,
      xpToast:      null,   // { amount, taskTitle }
      levelUpModal: null,   // { from, to }
      editingTask:  null,   // task object being edited in modal

      // ─ Theme ─
      toggleDarkMode: () => set((s) => {
        const next = !s.darkMode
        applyTheme(next)
        return { darkMode: next }
      }),
      initTheme: () => {
        const dark = useStore.getState().darkMode
        applyTheme(dark)
      },

      // ─ API Sync ─
      loadUserFromApi: async () => {
        try {
          const { api } = await import('../lib/api.js')
          const userData = await api.auth.me()
          if (!userData) return
          set({ user: { ...userData }, isLoggedIn: true })
        } catch { /* offline ou não autenticado */ }
      },

      loadTasksFromApi: async () => {
        try {
          const { api, isAuthenticated } = await import('../lib/api.js')
          if (!isAuthenticated()) return
          set({ isLoading: true })
          const tasks = await api.tasks.list()
          if (tasks) set({ tasks, isLoading: false })
        } catch { set({ isLoading: false }) }
      },

      logout: () => {
        import('../lib/api.js').then(({ clearToken }) => clearToken())
        set({ isLoggedIn: false, tasks: SEED_TASKS, user: { name: 'Visitante', xp: 0, streak: 0, totalFocusSec: 0, todayFocusSec: 0, avatar: null, email: null }, currentPage: 'login' })
      },

      // ─ Navigation ─
      setPage: (page) => set({ currentPage: page, sidebarOpen: false }),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      setQuickCaptureOpen: (v) => set({ quickCaptureOpen: v }),
      setEditingTask: (task) => set({ editingTask: task }),

      // ─ Focus task ─
      setFocusTask: (id) => set({ focusTaskId: id }),

      // ─ Focus timer ─
      addFocusTime: (seconds) => set((s) => ({
        user: {
          ...s.user,
          totalFocusSec: s.user.totalFocusSec + seconds,
          todayFocusSec: s.user.todayFocusSec + seconds,
        },
      })),

      // ─ Tasks CRUD (optimistic updates + API sync) ─
      addTask: async (data) => {
        const tempId = `temp_${Date.now()}`
        const task = {
          id: tempId, title: data.title.trim(), notes: data.notes || '',
          priority: data.priority || 'medium', project: data.project || 'Geral',
          dueDate: data.dueDate || null, dueTime: data.dueTime || null,
          completed: false, completedAt: null,
          createdAt: new Date().toISOString(), weekDay: data.weekDay ?? null,
          subtasks: data.subtasks || [],
        }
        // Optimistic
        set((s) => ({ tasks: [task, ...s.tasks] }))

        // Sync to API if logged in
        try {
          const { api, isAuthenticated } = await import('../lib/api.js')
          if (isAuthenticated()) {
            const saved = await api.tasks.create(data)
            if (saved) set((s) => ({ tasks: s.tasks.map(t => t.id === tempId ? saved : t) }))
          }
        } catch { /* keep local */ }
        return task
      },

      updateTask: async (id, patch) => {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          editingTask: s.editingTask?.id === id ? { ...s.editingTask, ...patch } : s.editingTask,
        }))
        try {
          const { api, isAuthenticated } = await import('../lib/api.js')
          if (isAuthenticated()) await api.tasks.update(id, patch)
        } catch { /* keep local */ }
      },

      deleteTask: async (id) => {
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
          focusTaskId: s.focusTaskId === id ? null : s.focusTaskId,
          editingTask: s.editingTask?.id === id ? null : s.editingTask,
        }))
        try {
          const { api, isAuthenticated } = await import('../lib/api.js')
          if (isAuthenticated()) await api.tasks.delete(id)
        } catch { /* keep local */ }
      },

      completeTask: async (id) => {
        const { tasks, user } = get()
        const task = tasks.find((t) => t.id === id)
        if (!task || task.completed) return

        const xpGain   = XP_TABLE[task.priority] ?? 20
        const oldLevel = levelFromXp(user.xp)
        const newXp    = user.xp + xpGain
        const newLevel = levelFromXp(newXp)

        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t
          ),
          user: { ...s.user, xp: newXp },
          xpToast: { amount: xpGain, taskTitle: task.title, key: Date.now() },
          levelUpModal: newLevel > oldLevel ? { from: oldLevel, to: newLevel } : null,
          focusTaskId: s.focusTaskId === id
            ? (s.tasks.find((t) => !t.completed && t.id !== id)?.id || null)
            : s.focusTaskId,
        }))

        // Sync to API
        try {
          const { api, isAuthenticated } = await import('../lib/api.js')
          if (isAuthenticated()) {
            await api.tasks.update(id, { completed: true })
            await api.auth.updateMe({ xp: newXp, level: newLevel })
          }
        } catch { /* keep local */ }
      },

      uncompleteTask: async (id) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, completed: false, completedAt: null } : t
          ),
        }))
        try {
          const { api, isAuthenticated } = await import('../lib/api.js')
          if (isAuthenticated()) await api.tasks.update(id, { completed: false })
        } catch { /* keep local */ }
      },

      clearXpToast:      () => set({ xpToast: null }),
      clearLevelUpModal: () => set({ levelUpModal: null }),

      // ─ Subtasks ─
      toggleSubtask: (taskId, subId) => set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: t.subtasks.map((st) => st.id === subId ? { ...st, done: !st.done } : st) }
            : t
        ),
      })),

      // ─ Selectors (computed helpers) ─
      getActiveTasks:    () => get().tasks.filter((t) => !t.completed),
      getCompletedToday: () => {
        const today = new Date().toDateString()
        return get().tasks.filter((t) => t.completed && new Date(t.completedAt).toDateString() === today)
      },
      getFocusTask: () => get().tasks.find((t) => t.id === get().focusTaskId) || null,
      getXpProgress: () => xpProgressInLevel(get().user.xp),
    }),
    {
      name: 'forge-storage',
      partialize: (s) => ({ tasks: s.tasks, user: s.user, focusTaskId: s.focusTaskId, darkMode: s.darkMode }),
    }
  )
)

export default useStore
export { xpProgressInLevel, levelFromXp, XP_TABLE }
