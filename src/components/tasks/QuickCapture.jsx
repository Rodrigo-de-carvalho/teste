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
  const [form, setForm]         = useState(EMPTY)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [bottomOffset, setBottomOffset] = useState(0)
  const inputRef = useRef(null)

  // Empurra o modal acima do teclado virtual
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const kb = window.innerHeight - vv.height - vv.offsetTop
      setBottomOffset(Math.max(0, kb))
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

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

  useEffect(() => {
    if (quickCaptureOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setForm(EMPTY)
      setExpanded(false)
      setLoading(false)
    }
  }, [quickCaptureOpen])

  async function submit() {
    if (!form.title.trim() || loading) return
    setLoading(true)
    try {
      await addTask(form)
    } finally {
      setQuickCaptureOpen(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
    if (e.key === 'Escape') setQuickCaptureOpen(false)
  }

  return (
    <AnimatePresence>
      {/* Backdrop — filho direto do AnimatePresence com key explícita */}
      {quickCaptureOpen && (
        <motion.div
          key="qc-bg"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[90] bg-inverse-surface/40 backdrop-blur-sm"
          onClick={() => setQuickCaptureOpen(false)}
        />
      )}

      {/* Mobile: bottom sheet | Desktop: centered modal — filho direto com key explícita */}
      {quickCaptureOpen && (
        <motion.div
          key="qc-modal"
          className="fixed z-[91] w-full
                     bottom-0 left-0 right-0
                     md:bottom-auto md:top-[12vh] md:left-1/2 md:-translate-x-1/2 md:max-w-lg md:px-4"
          style={{ bottom: bottomOffset }}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        >
            <div
              className="shadow-float overflow-hidden
                         rounded-t-3xl md:rounded-2xl
                         max-h-[90dvh] md:max-h-none flex flex-col"
              style={{ background: 'var(--clr-white-card)' }}
            >
              {/* Handle bar (mobile only) */}
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-10 h-1 rounded-full bg-outline-variant" />
              </div>

              {/* Header */}
              <div className="flex items-center gap-3 px-5 pt-3 pb-2 md:pt-5">
                <span className="material-symbols-outlined text-primary text-[22px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}>add_task</span>
                <input
                  ref={inputRef}
                  className="flex-1 text-base md:text-lg font-body text-on-surface
                             placeholder-on-surface-variant/40 outline-none bg-transparent"
                  placeholder="O que precisa ser feito? *"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  onKeyDown={handleKey}
                />
                {form.title ? (
                  <button onClick={() => setForm(f => ({ ...f, title: '' }))}
                    className="w-8 h-8 flex items-center justify-center rounded-full
                               text-on-surface-variant/50 hover:text-on-surface-variant transition-colors">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                ) : (
                  <button onClick={() => setQuickCaptureOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full
                               text-on-surface-variant/50 md:hidden">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>

              {/* Required hint */}
              <p className="px-5 pb-1 text-[11px] text-on-surface-variant/50 font-label">
                * Obrigatório · todo o resto é opcional
              </p>

              {/* Priority chips */}
              <div className="flex gap-2 px-5 pb-3 overflow-x-auto scrollbar-none flex-shrink-0">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-label font-medium transition-all
                      ${form.priority === p.value
                        ? p.color + ' ring-2 ring-primary/40 scale-105'
                        : 'bg-surface-container text-on-surface-variant'
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
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden overflow-y-auto"
                  >
                    <div className="px-5 pb-3 grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-label text-on-surface-variant/60 uppercase tracking-wide">Projeto</label>
                        <input
                          className="input-field text-sm"
                          placeholder="Ex: Trabalho"
                          value={form.project}
                          onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-label text-on-surface-variant/60 uppercase tracking-wide">Data de entrega</label>
                        <input
                          type="date"
                          className="input-field text-sm"
                          value={form.dueDate}
                          onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-label text-on-surface-variant/60 uppercase tracking-wide">Hora</label>
                        <input
                          type="time"
                          className="input-field text-sm"
                          value={form.dueTime}
                          onChange={e => setForm(f => ({ ...f, dueTime: e.target.value }))}
                        />
                      </div>
                      <div className="flex flex-col gap-1 col-span-2">
                        <label className="text-[10px] font-label text-on-surface-variant/60 uppercase tracking-wide">Notas</label>
                        <textarea
                          className="input-field text-sm resize-none"
                          style={{ minHeight: '72px' }}
                          placeholder="Detalhes adicionais..."
                          value={form.notes}
                          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4 border-t"
                   style={{ borderColor: 'var(--clr-outline-var)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="text-on-surface-variant text-sm font-label flex items-center gap-1
                             hover:text-primary transition-colors py-2"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {expanded ? 'expand_less' : 'tune'}
                  </span>
                  <span className="hidden sm:inline">{expanded ? 'Menos' : 'Detalhes opcionais'}</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setQuickCaptureOpen(false)}
                    className="btn-ghost py-2.5 px-4 text-sm hidden md:flex"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={submit}
                    disabled={!form.title.trim() || loading}
                    className={`btn-primary py-2.5 px-6 text-sm
                      ${!form.title.trim() || loading ? 'opacity-40 cursor-not-allowed shadow-none' : ''}`}
                  >
                    {loading ? 'Salvando...' : 'Adicionar'}
                    <kbd className="ml-1 text-white/60 text-[10px] hidden md:inline">↵</kbd>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  )
}
