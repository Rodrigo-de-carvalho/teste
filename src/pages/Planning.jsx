import { useState } from 'react'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import { getWeekDays, DAYS_FULL_PT } from '../utils/dates'

export default function Planning() {
  const { tasks, updateTask, addTask, setQuickCaptureOpen, setEditingTask } = useStore()
  const weekDays = getWeekDays()
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  function getTasksForDay(dayIndex) {
    return tasks.filter(t => t.weekDay === dayIndex && !t.completed)
  }

  function getCompletedForDay(dayIndex) {
    return tasks.filter(t => t.weekDay === dayIndex && t.completed)
  }

  function handleDrop(dayIndex) {
    if (dragging !== null) {
      updateTask(dragging, { weekDay: dayIndex })
      setDragging(null)
      setDragOver(null)
    }
  }

  const unscheduled = tasks.filter(t => t.weekDay === null && !t.completed)

  const PRIORITY_COLORS = {
    critical: 'border-l-error bg-error-container/30',
    high:     'border-l-tertiary bg-tertiary/5',
    medium:   'border-l-primary bg-primary/5',
    low:      'border-l-outline bg-forge-card',
  }

  return (
    <div className="animate-fade-in">
      <section className="mb-8">
        <h2 className="font-display font-bold text-on-surface text-4xl md:text-5xl tracking-tight mb-2">
          Planejamento
        </h2>
        <p className="text-on-surface-variant">Distribua suas intenções ao longo da semana.</p>
      </section>

      {/* Week grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {weekDays.map(day => {
          const dayTasks   = getTasksForDay(day.index)
          const doneTasks  = getCompletedForDay(day.index)
          const isOver     = dragOver === day.index

          return (
            <div
              key={day.index}
              onDragOver={e => { e.preventDefault(); setDragOver(day.index) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(day.index)}
              className={`min-h-[200px] rounded-2xl p-3 transition-all duration-200 border-2
                ${day.isToday
                  ? 'border-primary bg-primary/5'
                  : isOver
                    ? 'border-primary/40 bg-primary/3 scale-[1.02]'
                    : 'border-transparent bg-surface-container-low'
                }`}
            >
              {/* Day header */}
              <div className="mb-3">
                <p className={`font-label font-bold text-xs tracking-widest uppercase
                  ${day.isToday ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {day.label}
                </p>
                <p className={`font-display font-bold text-2xl leading-none
                  ${day.isToday ? 'text-primary' : 'text-on-surface'}`}>
                  {day.date}
                </p>
                {doneTasks.length > 0 && (
                  <p className="text-[10px] text-success font-label mt-0.5">
                    {doneTasks.length} ✓
                  </p>
                )}
              </div>

              {/* Tasks */}
              <div className="space-y-2">
                {dayTasks.map(task => (
                  <motion.div
                    key={task.id}
                    layout
                    draggable
                    onDragStart={() => setDragging(task.id)}
                    onDragEnd={() => { setDragging(null); setDragOver(null) }}
                    onClick={() => setEditingTask(task)}
                    className={`border-l-2 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing
                                text-xs text-on-surface font-body truncate hover:brightness-95 transition-all
                                ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}
                                ${dragging === task.id ? 'opacity-40 scale-95' : ''}`}
                  >
                    {task.title}
                  </motion.div>
                ))}
              </div>

              {/* Add button */}
              <button
                onClick={() => {
                  useStore.getState().setQuickCaptureOpen(true)
                }}
                className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg
                           text-on-surface-variant/40 hover:text-primary hover:bg-primary/5
                           transition-colors text-xs font-label"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
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
          <p className="text-on-surface-variant text-sm mb-4">Arraste para um dia da semana ou clique para editar.</p>
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
                    task.priority === 'high' ? 'bg-tertiary' :
                    task.priority === 'medium' ? 'bg-primary' : 'bg-outline'}`} />
                <span className="text-on-surface text-sm flex-1 truncate">{task.title}</span>
                <span className="text-on-surface-variant/40 text-xs font-label">{task.project || 'Geral'}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {tasks.filter(t => !t.completed).length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-primary text-[28px]">calendar_view_week</span>
          </div>
          <p className="font-display font-semibold text-on-surface text-xl mb-2">Semana livre!</p>
          <p className="text-on-surface-variant text-sm mb-6">Adicione tarefas para planejar sua semana</p>
          <button onClick={() => setQuickCaptureOpen(true)} className="btn-primary mx-auto">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Planejar tarefa
          </button>
        </div>
      )}
    </div>
  )
}
