import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useStore from '../../store/useStore'

const PRIORITIES = [
  { value: 'critical', label: '🔴 Crítico', color: 'bg-error-container text-on-error-container' },
  { value: 'high',     label: '🟠 Alto',    color: 'bg-tertiary/10 text-tertiary'               },
  { value: 'medium',   label: '🔵 Médio',   color: 'bg-primary/10 text-primary'                 },
  { value: 'low',      label: '⚪ Baixo',   color: 'bg-secondary-container text-secondary'       },
]

const EMPTY = { title: '', notes: '', priority: 'medium', project: '', dueDate: '', dueTime: '' }

export default function QuickCapture() {
  const { quickCaptureOpen, setQuickCaptureOpen, addTask } = useStore()
  const [form, setForm] = useState(EMPTY)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef(null)

  // Global Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setQuickCaptureOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setQuickCaptureOpen])

  // Auto-focus
  useEffect(() => {
    if (quickCaptureOpen) {
      setTimeout(() => inputRef.current?.focus(), 80)
    } else {
      setForm(EMPTY)
      setExpanded(false)
    }
  }, [quickCaptureOpen])

  function submit() {
    if (!form.title.trim()) return
    addTask(form)
    setQuickCaptureOpen(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
    if (e.key === 'Escape') setQuickCaptureOpen(false)
  }

  return (
    <AnimatePresence>
      {quickCaptureOpen && (
        <>
          <motion.div
            key="qc-bg"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[90] bg-inverse-surface/30 backdrop-blur-sm"
            onClick={() => setQuickCaptureOpen(false)}
          />

          <motion.div
            key="qc-modal"
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-[91] w-full max-w-lg px-4"
          >
            <div className="rounded-2xl shadow-float overflow-hidden" style={{ background: 'var(--clr-white-card)' }}>
              {/* Main input */}
              <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                <span className="material-symbols-outlined text-primary text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  add_task
                </span>
                <input
                  ref={inputRef}
                  className="flex-1 text-lg font-body text-on-surface placeholder-on-surface-variant/40
                             outline-none bg-transparent"
                  placeholder="O que precisa ser feito?"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  onKeyDown={handleKey}
                />
                {form.title && (
                  <button onClick={() => setForm(f => ({ ...f, title: '' }))}
                    className="text-on-surface-variant/50 hover:text-on-surface-variant transition-colors">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>

              {/* Priority quick-select */}
              <div className="flex gap-2 px-5 pb-3">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                    className={`chip transition-all text-[10px]
                      ${form.priority === p.value
                        ? p.color + ' ring-2 ring-primary/40 scale-105'
                        : 'bg-surface-container text-on-surface-variant hover:bg-secondary-container/60'
                      }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Expanded fields */}
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-3 grid grid-cols-2 gap-3">
                      <input
                        className="input-field text-sm"
                        placeholder="Projeto"
                        value={form.project}
                        onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
                      />
                      <input
                        type="date"
                        className="input-field text-sm"
                        value={form.dueDate}
                        onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                      />
                      <input
                        type="time"
                        className="input-field text-sm"
                        value={form.dueTime}
                        onChange={e => setForm(f => ({ ...f, dueTime: e.target.value }))}
                      />
                      <textarea
                        className="input-field text-sm resize-none col-span-2 h-20"
                        placeholder="Notas (opcional)"
                        value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: 'var(--clr-outline-var)' }}>
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="text-on-surface-variant text-sm font-label flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">{expanded ? 'expand_less' : 'expand_more'}</span>
                  {expanded ? 'Menos detalhes' : 'Mais detalhes'}
                </button>

                <div className="flex gap-2">
                  <button onClick={() => setQuickCaptureOpen(false)} className="btn-ghost py-2 px-4 text-sm">
                    Cancelar
                  </button>
                  <button
                    onClick={submit}
                    disabled={!form.title.trim()}
                    className={`btn-primary py-2 px-5 text-sm ${!form.title.trim() ? 'opacity-40 cursor-not-allowed shadow-none' : ''}`}
                  >
                    Adicionar
                    <kbd className="ml-1 text-white/60 text-[10px]">↵</kbd>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
