import { useState } from 'react'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import { DAYS_PT, MONTHS_PT, localIso } from '../utils/dates'

const PRIORITY_COLORS = {
  critical: 'border-l-error bg-error-container/30',
  high:     'border-l-tertiary bg-tertiary/5',
  medium:   'border-l-primary bg-primary/5',
  low:      'border-l-outline bg-forge-card',
}

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const days     = []

  for (let i = firstDay.getDay() - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ date: d, isCurrentMonth: false, iso: localIso(d) })
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i)
    days.push({ date: d, isCurrentMonth: true, iso: localIso(d) })
  }
  const remaining = days.length % 7
  if (remaining > 0) {
    for (let i = 1; i <= 7 - remaining; i++) {
      const d = new Date(year, month + 1, i)
      days.push({ date: d, isCurrentMonth: false, iso: localIso(d) })
    }
  }
  return days
}

const isTouchOnly = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

export default function Planning() {
  const { tasks, updateTask, openQuickCapture, setEditingTask } = useStore()
  const today    = new Date()
  const todayIso = localIso(today)
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [dragging,  setDragging]  = useState(null)
  const [dragOver,  setDragOver]  = useState(null)

  const days = getMonthDays(viewYear, viewMonth)

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function getTasksForDate(iso)     { return tasks.filter(t => t.dueDate === iso && !t.completed) }
  function getCompletedForDate(iso) { return tasks.filter(t => t.dueDate === iso && t.completed) }

  function handleDrop(iso) {
    if (dragging !== null) {
      updateTask(dragging, { dueDate: iso })
      setDragging(null)
      setDragOver(null)
    }
  }

  const unscheduled = tasks.filter(t => !t.dueDate && !t.completed)

  return (
    <div className="animate-fade-in">
      <section className="mb-6">
        <h2 className="font-display font-bold text-on-surface text-4xl md:text-5xl tracking-tight mb-2">
          Planejamento
        </h2>
        <p className="text-on-surface-variant">Distribua suas intenções ao longo do mês.</p>
      </section>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant
                     hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        <h3 className="font-display font-semibold text-on-surface text-lg capitalize">
          {MONTHS_PT[viewMonth]} {viewYear}
        </h3>
        <button onClick={nextMonth}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant
                     hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_PT.map(d => (
          <div key={d} className="text-center text-[10px] font-label font-bold
                                  text-on-surface-variant/50 uppercase tracking-wide py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-8">
        {days.map(({ date, isCurrentMonth, iso }) => {
          const dayTasks  = getTasksForDate(iso)
          const doneTasks = getCompletedForDate(iso)
          const isToday   = iso === todayIso
          const isOver    = dragOver === iso

          return (
            <div
              key={iso}
              onDragOver={e => { e.preventDefault(); setDragOver(iso) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(iso)}
              className={`min-h-[80px] rounded-xl p-1.5 transition-all duration-200 border-2 group
                ${isToday
                  ? 'border-primary bg-primary/5'
                  : isOver
                    ? 'border-primary/40 bg-primary/5 scale-[1.01]'
                    : 'border-transparent'
                }
                ${isCurrentMonth ? 'bg-surface-container-low' : 'opacity-30'}`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-label font-bold leading-none
                  ${isToday ? 'text-primary' : 'text-on-surface'}`}>
                  {date.getDate()}
                </span>
                {doneTasks.length > 0 && (
                  <span className="text-[9px] text-success font-label leading-none">
                    {doneTasks.length}✓
                  </span>
                )}
              </div>

              {/* Tasks */}
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(task => (
                  <motion.div
                    key={task.id}
                    layout
                    draggable
                    onDragStart={() => setDragging(task.id)}
                    onDragEnd={() => { setDragging(null); setDragOver(null) }}
                    onClick={() => setEditingTask(task)}
                    className={`border-l-2 rounded px-1 py-0.5 cursor-grab active:cursor-grabbing
                                text-[10px] text-on-surface font-body truncate
                                hover:brightness-95 transition-all
                                ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}
                                ${dragging === task.id ? 'opacity-40 scale-95' : ''}`}
                  >
                    {task.title}
                  </motion.div>
                ))}
                {dayTasks.length > 3 && (
                  <p className="text-[9px] text-on-surface-variant/50 font-label pl-1">
                    +{dayTasks.length - 3}
                  </p>
                )}
              </div>

              {/* Add button — aparece no hover do dia */}
              <button
                onClick={() => openQuickCapture({ dueDate: iso })}
                className="mt-0.5 w-full flex items-center justify-center py-0.5 rounded
                           opacity-0 group-hover:opacity-100 text-primary/50 hover:text-primary
                           hover:bg-primary/10 transition-all"
              >
                <span className="material-symbols-outlined text-[12px]">add</span>
              </button>
            </div>
          )
        })}
      </div>

      {/* Unscheduled */}
      {unscheduled.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-outline" />
            <h3 className="font-display font-semibold text-on-surface">Sem data</h3>
            <span className="chip bg-secondary-container text-on-secondary-container">
              {unscheduled.length}
            </span>
          </div>
          <p className="text-on-surface-variant text-sm mb-4">
            {isTouchOnly ? 'Toque para editar e definir a data.' : 'Arraste para um dia do calendário ou clique para editar.'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unscheduled.map(task => (
              <motion.div
                key={task.id}
                layout
                draggable
                onDragStart={() => setDragging(task.id)}
                onDragEnd={() => { setDragging(null); setDragOver(null) }}
                onClick={() => setEditingTask(task)}
                className={`task-card px-4 py-3 flex items-center gap-3 cursor-grab active:cursor-grabbing
                            ${dragging === task.id ? 'opacity-40 scale-95' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0
                  ${task.priority === 'critical' ? 'bg-error' :
                    task.priority === 'high'     ? 'bg-tertiary' :
                    task.priority === 'medium'   ? 'bg-primary' : 'bg-outline'}`} />
                <span className="text-on-surface text-sm flex-1 truncate">{task.title}</span>
                <span className="text-on-surface-variant/40 text-xs font-label">
                  {task.project || 'Geral'}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {tasks.filter(t => !t.completed).length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-primary text-[28px]">calendar_month</span>
          </div>
          <p className="font-display font-semibold text-on-surface text-xl mb-2">Mês livre!</p>
          <p className="text-on-surface-variant text-sm mb-6">
            Adicione tarefas para planejar seu mês
          </p>
          <button onClick={() => openQuickCapture()} className="btn-primary mx-auto">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Planejar tarefa
          </button>
        </div>
      )}
    </div>
  )
}
