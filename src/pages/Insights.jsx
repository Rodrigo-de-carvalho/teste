import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import { getLast7Days, formatFocusTime } from '../utils/dates'
import { XP_TABLE } from '../store/useStore'

export default function Insights() {
  const { tasks, user, getXpProgress } = useStore()
  const xp = getXpProgress()
  const last7 = getLast7Days()

  // Tasks completed per day (last 7)
  const completedByDay = last7.map(d => ({
    ...d,
    count: tasks.filter(t => t.completed && t.completedAt?.startsWith(d.isoDate)).length,
  }))
  const maxCount = Math.max(...completedByDay.map(d => d.count), 1)

  // Priority distribution
  const totalTasks = tasks.length
  const byPriority = [
    { label: 'Crítico', color: 'bg-error',    pct: Math.round((tasks.filter(t => t.priority === 'critical').length / totalTasks) * 100) || 0 },
    { label: 'Alto',    color: 'bg-tertiary',  pct: Math.round((tasks.filter(t => t.priority === 'high').length / totalTasks) * 100) || 0 },
    { label: 'Médio',   color: 'bg-primary',   pct: Math.round((tasks.filter(t => t.priority === 'medium').length / totalTasks) * 100) || 0 },
    { label: 'Baixo',   color: 'bg-secondary', pct: Math.round((tasks.filter(t => t.priority === 'low').length / totalTasks) * 100) || 0 },
  ]

  // Projects breakdown
  const projectMap = {}
  tasks.forEach(t => { projectMap[t.project || 'Geral'] = (projectMap[t.project || 'Geral'] || 0) + 1 })
  const projectList = Object.entries(projectMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxProject = projectList[0]?.[1] || 1

  // Completion rate
  const completedTotal = tasks.filter(t => t.completed).length
  const completionRate = totalTasks > 0 ? Math.round((completedTotal / totalTasks) * 100) : 0

  // Total XP breakdown
  const totalXpEarned = tasks
    .filter(t => t.completed)
    .reduce((sum, t) => sum + (XP_TABLE[t.priority] || 20), 0)

  return (
    <div className="animate-fade-in">
      <section className="mb-8">
        <h2 className="font-display font-bold text-on-surface text-4xl md:text-5xl tracking-tight mb-2">
          Insights
        </h2>
        <p className="text-on-surface-variant">Entenda seus padrões de produtividade.</p>
      </section>

      {/* Top stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'XP Total',       value: user.xp,                            unit: 'xp',   icon: 'star',              color: 'text-primary'  },
          { label: 'Nível Atual',    value: xp.level,                           unit: '',     icon: 'emoji_events',      color: 'text-tertiary' },
          { label: 'Foco Total',     value: formatFocusTime(user.totalFocusSec) || '0m', unit: '', icon: 'timer',     color: 'text-success'  },
          { label: 'Streak',         value: user.streak,                        unit: 'dias', icon: 'local_fire_department', color: 'text-error' },
        ].map(({ label, value, unit, icon, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass rounded-2xl p-5 border border-white/60 shadow-card"
          >
            <span className={`material-symbols-outlined text-[20px] mb-2 block ${color}`}
              style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
            <p className={`font-display font-bold text-3xl ${color} leading-none`}>
              {value}<span className="text-sm font-body ml-1">{unit}</span>
            </p>
            <p className="text-on-surface-variant text-xs font-label mt-1">{label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left ── */}
        <div className="lg:col-span-8 space-y-6">

          {/* Bar chart: tasks per day */}
          <div className="forge-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-display font-semibold text-on-surface">Tarefas Concluídas (7 dias)</h4>
              <span className="chip bg-primary/10 text-primary">{completedTotal} total</span>
            </div>
            <div className="flex items-end justify-between gap-2 h-40">
              {completedByDay.map((d, i) => (
                <div key={d.isoDate} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-label text-primary font-semibold">
                    {d.count > 0 ? d.count : ''}
                  </span>
                  <div className="w-full relative flex items-end" style={{ height: '96px' }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.count / maxCount) * 96}px` }}
                      transition={{ delay: i * 0.05, duration: 0.6, ease: 'easeOut' }}
                      className={`w-full rounded-t-lg ${d.count > 0 ? 'bg-primary' : 'bg-surface-container'}`}
                      style={{ minHeight: '4px' }}
                    />
                  </div>
                  <span className={`text-[10px] font-label uppercase tracking-wider
                    ${new Date().toISOString().startsWith(d.isoDate) ? 'text-primary font-bold' : 'text-on-surface-variant/60'}`}>
                    {d.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Projects bar */}
          <div className="forge-card rounded-2xl p-6">
            <h4 className="font-display font-semibold text-on-surface mb-6">Distribuição por Projeto</h4>
            {projectList.length > 0 ? (
              <div className="space-y-4">
                {projectList.map(([name, count], i) => (
                  <div key={name}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm text-on-surface font-body">{name}</span>
                      <span className="text-xs font-label text-on-surface-variant">{count} tarefa{count > 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / maxProject) * 100}%` }}
                        transition={{ delay: i * 0.1, duration: 0.7, ease: 'easeOut' }}
                        className={`h-full rounded-full ${i === 0 ? 'bg-primary' : i === 1 ? 'bg-tertiary' : i === 2 ? 'bg-success' : 'bg-outline'}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-on-surface-variant text-sm">Nenhum projeto ainda.</p>
            )}
          </div>
        </div>

        {/* ── Right ── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Completion rate */}
          <div className="glass rounded-2xl p-6 border border-white/60 shadow-card text-center">
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg className="w-full h-full" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="54" fill="transparent" stroke="#e5eeff" strokeWidth="8" />
                <circle
                  cx="64" cy="64" r="54" fill="transparent"
                  stroke="#6b38d4" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 54}`}
                  strokeDashoffset={`${2 * Math.PI * 54 * (1 - completionRate / 100)}`}
                  transform="rotate(-90 64 64)"
                  style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display font-bold text-primary text-3xl leading-none">{completionRate}%</span>
                <span className="text-on-surface-variant text-[10px] font-label">concluído</span>
              </div>
            </div>
            <p className="font-display font-semibold text-on-surface">Taxa de Conclusão</p>
            <p className="text-on-surface-variant text-sm mt-1">
              {completedTotal} de {totalTasks} tarefas
            </p>
          </div>

          {/* Priority breakdown */}
          <div className="forge-card rounded-2xl p-6">
            <h4 className="font-label font-semibold text-on-surface-variant text-xs tracking-widest uppercase mb-4">
              Por Prioridade
            </h4>
            <div className="space-y-3">
              {byPriority.map(({ label, color, pct }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-on-surface">{label}</span>
                    <span className="text-xs font-label text-on-surface-variant">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className={`h-full rounded-full ${color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* XP level progress */}
          <div className="forge-card rounded-2xl p-6">
            <h4 className="font-label font-semibold text-on-surface-variant text-xs tracking-widest uppercase mb-4">
              Progresso XP
            </h4>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-primary-glow">
                <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  emoji_events
                </span>
              </div>
              <div>
                <p className="font-display font-bold text-on-surface text-2xl">Nível {xp.level}</p>
                <p className="text-on-surface-variant text-xs">{totalXpEarned} XP total ganho</p>
              </div>
            </div>
            <div className="h-2 w-full bg-secondary-container rounded-full overflow-hidden mb-2">
              <motion.div
                className="h-full bg-primary rounded-full"
                animate={{ width: `${xp.pct}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs text-on-surface-variant/70 font-label">
              {xp.earned}/{xp.needed} XP para nível {xp.level + 1}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
