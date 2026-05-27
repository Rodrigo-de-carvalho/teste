import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useStore from '../store/useStore'
import TaskCard from '../components/tasks/TaskCard'

const FILTERS = [
  { id: 'all',       label: 'Todas'       },
  { id: 'today',     label: 'Hoje'        },
  { id: 'upcoming',  label: 'Em breve'    },
  { id: 'completed', label: 'Concluídas'  },
]

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

export default function Inbox() {
  const { tasks, setQuickCaptureOpen } = useStore()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const today = new Date().toISOString().split('T')[0]

  function filterTasks(t) {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'all')       return !t.completed
    if (filter === 'today')     return !t.completed && t.dueDate === today
    if (filter === 'upcoming')  return !t.completed && t.dueDate && t.dueDate > today
    if (filter === 'completed') return t.completed
    return true
  }

  const filtered = tasks.filter(filterTasks).sort((a, b) => {
    if (filter === 'completed') return new Date(b.completedAt) - new Date(a.completedAt)
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  })

  // Group by priority when showing all/today
  const shouldGroup = filter === 'all' || filter === 'today'

  const groups = shouldGroup ? [
    { key: 'critical', label: 'Foco Urgente',          dot: 'bg-error',     tasks: filtered.filter(t => t.priority === 'critical') },
    { key: 'high',     label: 'Alta Prioridade',        dot: 'bg-tertiary',  tasks: filtered.filter(t => t.priority === 'high') },
    { key: 'medium',   label: 'Crescimento',            dot: 'bg-primary',   tasks: filtered.filter(t => t.priority === 'medium') },
    { key: 'low',      label: 'Quando der',             dot: 'bg-secondary', tasks: filtered.filter(t => t.priority === 'low') },
  ].filter(g => g.tasks.length > 0) : null

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <section className="mb-8">
        <h2 className="font-display font-bold text-on-surface text-4xl md:text-5xl tracking-tight mb-2">
          Entrada
        </h2>
        <p className="text-on-surface-variant">Capture tudo, organize com intenção.</p>
      </section>

      {/* Search + Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">
            search
          </span>
          <input
            className="input-field pl-10 w-full"
            placeholder="Buscar tarefas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-lg text-sm font-label font-medium whitespace-nowrap transition-all duration-200
                ${filter === f.id
                  ? 'bg-primary text-white shadow-primary-glow'
                  : 'text-on-surface-variant shadow-card'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-10">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-primary text-[28px]">
                  {filter === 'completed' ? 'task_alt' : 'inbox'}
                </span>
              </div>
              <p className="font-display font-semibold text-on-surface text-xl mb-2">
                {filter === 'completed' ? 'Nada concluído ainda' : 'Entrada vazia!'}
              </p>
              <p className="text-on-surface-variant text-sm mb-6">
                {filter === 'completed'
                  ? 'Complete tarefas para vê-las aqui'
                  : search ? 'Nenhuma tarefa encontrada' : 'Hora de adicionar algo ao Forje'
                }
              </p>
              {filter !== 'completed' && !search && (
                <button onClick={() => setQuickCaptureOpen(true)} className="btn-primary mx-auto">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Criar tarefa
                </button>
              )}
            </motion.div>
          ) : shouldGroup && groups ? (
            groups.map(group => (
              <div key={group.key} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${group.dot}`} />
                    <h3 className="font-display font-semibold text-on-surface text-lg">{group.label}</h3>
                  </div>
                  <span className="chip bg-secondary-container text-on-secondary-container">
                    {group.tasks.length} tarefa{group.tasks.length > 1 ? 's' : ''}
                  </span>
                </div>
                <AnimatePresence>
                  {group.tasks.map(t => (
                    <TaskCard key={t.id} task={t} />
                  ))}
                </AnimatePresence>
              </div>
            ))
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {filtered.map(t => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right sidebar: quick stats */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass rounded-2xl p-6 border border-white/60 shadow-card sticky top-24">
            <h4 className="font-label font-semibold text-on-surface-variant text-xs tracking-widest uppercase mb-4">
              Resumo
            </h4>
            <div className="space-y-4">
              {[
                { label: 'Total pendentes',  value: tasks.filter(t => !t.completed).length,  color: 'text-primary'  },
                { label: 'Críticas',         value: tasks.filter(t => !t.completed && t.priority === 'critical').length, color: 'text-error' },
                { label: 'Para hoje',        value: tasks.filter(t => !t.completed && t.dueDate === today).length, color: 'text-tertiary' },
                { label: 'Concluídas hoje',  value: tasks.filter(t => t.completed && t.completedAt?.startsWith(today)).length, color: 'text-success' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-on-surface-variant">{label}</span>
                  <span className={`font-display font-bold text-xl ${color}`}>{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-outline-variant/30">
              <button
                onClick={() => setQuickCaptureOpen(true)}
                className="btn-primary w-full justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Capturar tarefa
                <kbd className="text-white/50 text-[10px] ml-1">Ctrl+K</kbd>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
