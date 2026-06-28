import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useStore from '../../store/useStore'
import { PriorityFlag, MetaChips } from './TaskFields'
import { recurrenceInvalid } from '../../utils/dates'

const EMPTY = { title: '', notes: '', priority: 'medium', project: '', dueDate: '', startTime: '', dueTime: '', reminderOffset: null, reminderAnchor: 'start', recurrence: 'none', recurrenceDays: null }

export default function QuickCapture() {
  const { quickCaptureOpen, setQuickCaptureOpen, quickCaptureDefaults, addTask } = useStore()
  const [form, setForm]         = useState(EMPTY)
  const [expanded, setExpanded] = useState(false)
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
      setForm(quickCaptureDefaults ? { ...EMPTY, ...quickCaptureDefaults } : EMPTY)
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setForm(EMPTY)
      setExpanded(false)
    }
  }, [quickCaptureOpen, quickCaptureDefaults])

  const invalid = recurrenceInvalid(form)

  function submit() {
    if (!form.title.trim() || invalid) return
    // Dispara sem esperar a rede: a tarefa já entra na lista de forma otimista
    // (síncrono, no início de addTask) e fechamos o modal na hora. Se o salvamento
    // falhar de verdade, o próprio addTask exibe o toast de erro — não duplicamos aqui.
    addTask(form).catch(() => {})
    setQuickCaptureOpen(false)
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
          style={bottomOffset > 0 ? { bottom: bottomOffset } : undefined}
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
                  maxLength={200}
                />
                <PriorityFlag value={form.priority} onChange={(p) => setForm(f => ({ ...f, priority: p }))} />
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

              {/* Detalhes opcionais — chips compactos + notas */}
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden overflow-y-auto"
                  >
                    <div className="px-5 pb-3 space-y-3">
                      <MetaChips form={form} setForm={setForm} />
                      <textarea
                        className="input-field text-sm resize-none"
                        style={{ minHeight: '64px' }}
                        placeholder="Notas..."
                        value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        maxLength={2000}
                      />
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
                    disabled={!form.title.trim() || invalid}
                    className={`btn-primary py-2.5 px-6 text-sm
                      ${!form.title.trim() || invalid ? 'opacity-40 cursor-not-allowed shadow-none' : ''}`}
                  >
                    Adicionar
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
