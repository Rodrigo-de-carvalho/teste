import { useState } from 'react'
import { motion } from 'framer-motion'
import useStore from '../../store/useStore'
import { formatDate, isOverdue } from '../../utils/dates'

const PRIORITY_CONFIG = {
  critical: { label: 'Crítico',  bg: 'bg-error-container',      text: 'text-on-error-container' },
  high:     { label: 'Alto',     bg: 'bg-tertiary/10',           text: 'text-tertiary'           },
  medium:   { label: 'Médio',    bg: 'bg-primary/10',            text: 'text-primary'            },
  low:      { label: 'Baixo',    bg: 'bg-secondary-container',   text: 'text-secondary'          },
}

export default function TaskCard({ task, compact = false }) {
  const { completeTask, uncompleteTask, setEditingTask } = useStore()
  const [justCompleted, setJustCompleted] = useState(false)

  const cfg    = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
  const overdue = !task.completed && isOverdue(task.dueDate)

  function handleCheck(e) {
    e.stopPropagation()
    if (task.completed) {
      uncompleteTask(task.id)
    } else {
      setJustCompleted(true)
      setTimeout(() => completeTask(task.id), 400)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: task.completed ? 0.55 : 1, y: 0 }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.3 }}
      onClick={() => setEditingTask(task)}
      className={`task-card p-4 md:p-5 flex items-center gap-4 group cursor-pointer
                  ${justCompleted ? 'scale-95 opacity-60' : ''}`}
    >
      {/* Checkbox */}
      <button
        onClick={handleCheck}
        className={`forge-checkbox flex-shrink-0 ${task.completed || justCompleted ? 'checked' : ''}`}
        style={{ transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        <span className="check-icon material-symbols-outlined text-[14px]">check</span>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className={`font-body font-semibold text-base text-on-surface group-hover:text-primary transition-colors truncate
                        ${task.completed ? 'line-through text-on-surface-variant' : ''}`}>
          {task.title}
        </h4>

        {!compact && (
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {task.project && (
              <span className="text-xs text-on-surface-variant font-label">{task.project}</span>
            )}
            {task.dueDate && (
              <span className={`text-xs font-label flex items-center gap-1
                                ${overdue ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>
                <span className="material-symbols-outlined text-[12px]">schedule</span>
                {formatDate(task.dueDate)}
                {task.dueTime && ` · ${task.dueTime}`}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span className="text-xs text-on-surface-variant font-label flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">task_alt</span>
                {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Priority chip */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`chip ${cfg.bg} ${cfg.text} hidden md:inline-flex`}>
          {cfg.label}
        </span>
        <div className={`w-2 h-2 rounded-full md:hidden flex-shrink-0
          ${task.priority === 'critical' ? 'bg-error' :
            task.priority === 'high' ? 'bg-tertiary' :
            task.priority === 'medium' ? 'bg-primary' : 'bg-secondary'}`}
        />
        <button
          onClick={(e) => { e.stopPropagation(); setEditingTask(task) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant
                     hover:text-primary w-7 h-7 flex items-center justify-center rounded"
        >
          <span className="material-symbols-outlined text-[18px]">more_vert</span>
        </button>
      </div>
    </motion.div>
  )
}
