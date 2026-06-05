import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../../store/useStore'
import { formatDate, isOverdue } from '../../utils/dates'

const PRIORITY_CONFIG = {
  critical: { label: 'Crítico', bg: 'bg-error-container',    text: 'text-on-error-container' },
  high:     { label: 'Alto',    bg: 'bg-tertiary/10',         text: 'text-tertiary'           },
  medium:   { label: 'Médio',   bg: 'bg-primary/10',          text: 'text-primary'            },
  low:      { label: 'Baixo',   bg: 'bg-secondary-container', text: 'text-secondary'          },
}

export default function TaskCard({ task, compact = false }) {
  const { completeTask, uncompleteTask, setEditingTask } = useStore()
  const [justCompleted, setJustCompleted]     = useState(false)
  const [confirmUncheck, setConfirmUncheck]   = useState(false)
  const uncheckTimerRef  = useRef(null)
  const completeTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      clearTimeout(completeTimerRef.current)
      clearTimeout(uncheckTimerRef.current)
    }
  }, [])

  const cfg     = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
  const overdue = !task.completed && isOverdue(task.dueDate)

  function handleCheck(e) {
    e.stopPropagation()
    if (task.completed) {
      // Primeira pressão: mostra confirmação
      setConfirmUncheck(true)
      clearTimeout(uncheckTimerRef.current)
      uncheckTimerRef.current = setTimeout(() => setConfirmUncheck(false), 5000)
    } else {
      setJustCompleted(true)
      completeTimerRef.current = setTimeout(() => completeTask(task.id), 400)
    }
  }

  function doUncheck(e) {
    e.stopPropagation()
    clearTimeout(uncheckTimerRef.current)
    setConfirmUncheck(false)
    uncompleteTask(task.id)
  }

  function cancelUncheck(e) {
    e.stopPropagation()
    clearTimeout(uncheckTimerRef.current)
    setConfirmUncheck(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: task.completed ? 0.55 : 1, y: 0 }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.3 }}
      className={`task-card group cursor-pointer ${justCompleted ? 'scale-95 opacity-60' : ''}`}
      onClick={() => setEditingTask(task)}
    >
      <div className="p-4 md:p-5 flex items-center gap-4">
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
          <span className={`chip ${cfg.bg} ${cfg.text} hidden md:inline-flex`}>{cfg.label}</span>
          <div className={`w-2 h-2 rounded-full md:hidden flex-shrink-0
            ${task.priority === 'critical' ? 'bg-error' :
              task.priority === 'high'     ? 'bg-tertiary' :
              task.priority === 'medium'   ? 'bg-primary' : 'bg-secondary'}`}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setEditingTask(task) }}
            className="opacity-40 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-on-surface-variant
                       hover:text-primary w-7 h-7 flex items-center justify-center rounded"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Confirmação de desmarcar */}
      <AnimatePresence>
        {confirmUncheck && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-4 mb-3 px-3 py-2.5 rounded-xl flex items-center justify-between gap-3"
                 style={{ background: 'rgba(211,47,47,0.07)', border: '1px solid rgba(211,47,47,0.2)' }}>
              <p className="text-xs text-on-surface-variant">
                Desmarcar vai <span className="text-error font-semibold">remover XP</span>. Confirmar?
              </p>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={cancelUncheck}
                  className="text-xs font-label font-semibold text-on-surface-variant px-2.5 py-1 rounded-lg
                             hover:bg-secondary-container/50 transition-colors"
                >
                  Não
                </button>
                <button
                  onClick={doUncheck}
                  className="text-xs font-label font-semibold text-error px-2.5 py-1 rounded-lg
                             bg-error/10 hover:bg-error/20 transition-colors"
                >
                  Sim
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
