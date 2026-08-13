import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { REMINDER_OPTIONS, calcReminderMs } from '../../utils/notifications'
import { RECURRENCE_OPTIONS, DAYS_PT, formatDate, recurrenceInvalid } from '../../utils/dates'

// Controles compactos de tarefa, no estilo de gerenciadores como Todoist/TickTick:
// uma bandeira de prioridade ao lado do título + uma fileira de chips (Data, Horário,
// Lembrete, Repetir, Projeto) que abrem um seletor inline só quando tocados.
// Compartilhado entre QuickCapture e TaskDetailModal para manter consistência.

const PRIORITY_OPTS = [
  { value: 'critical', label: 'Crítico', cls: 'text-error' },
  { value: 'high',     label: 'Alto',    cls: 'text-tertiary' },
  { value: 'medium',   label: 'Médio',   cls: 'text-primary' },
  { value: 'low',      label: 'Baixo',   cls: 'text-on-surface-variant' },
]

// ── Textarea que cresce com o conteúdo (auto-resize) ────────────────────────
export function AutoTextarea({ value, onChange, minHeight = 80, className = '', ...props }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`
  }, [value, minHeight])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      className={`resize-none overflow-hidden ${className}`}
      style={{ minHeight }}
      {...props}
    />
  )
}

// ── Bandeira de prioridade (ao lado do título) ──────────────────────────────
const MENU_GAP = 4   // espaço entre botão e menu

export function PriorityFlag({ value, onChange }) {
  const [pos, setPos] = useState(null)   // null = fechado; senão { top|bottom, right }
  const btnRef = useRef(null)
  const cur = PRIORITY_OPTS.find(p => p.value === value) || PRIORITY_OPTS[2]
  const isDefault = (value || 'medium') === 'medium'

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const spaceBelow = window.innerHeight - r.bottom
    // Sem espaço suficiente abaixo → abre para cima (ancorado pela base do botão).
    const dropUp = spaceBelow < 200
    setPos({
      right: Math.max(8, window.innerWidth - r.right),  // alinhado à direita do botão
      ...(dropUp
        ? { bottom: window.innerHeight - r.top + MENU_GAP }
        : { top: r.bottom + MENU_GAP }),
    })
  }

  return (
    <div className="flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => (pos ? setPos(null) : openMenu())}
        title={`Prioridade: ${cur.label}`}
        aria-label={`Prioridade: ${cur.label}`}
        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors"
      >
        <span
          className={`material-symbols-outlined text-[20px] ${isDefault ? 'text-on-surface-variant/50' : cur.cls}`}
          style={!isDefault ? { fontVariationSettings: "'FILL' 1" } : {}}
        >
          flag
        </span>
      </button>
      {pos && createPortal(
        <>
          {/* overlay invisível: fecha ao clicar fora */}
          <div className="fixed inset-0 z-[1000]" onClick={() => setPos(null)} />
          <div
            className="fixed z-[1001] w-40 rounded-xl py-1 shadow-float border border-outline-variant/40"
            style={{ background: 'var(--clr-white-card)', right: pos.right, top: pos.top, bottom: pos.bottom }}
          >
            {PRIORITY_OPTS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => { onChange(p.value); setPos(null) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-surface-container transition-colors"
              >
                <span className={`material-symbols-outlined text-[18px] ${p.cls}`} style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                <span className="text-on-surface">{p.label}</span>
                {value === p.value && <span className="material-symbols-outlined text-[16px] text-primary ml-auto">check</span>}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

function Chip({ icon, filled, active, onClick, children, onClear }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-label font-medium transition-all whitespace-nowrap
        ${filled ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}
        ${active ? 'ring-2 ring-primary/40' : ''}`}
    >
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
        {children && <span>{children}</span>}
      </button>
      {filled && onClear && (
        <button type="button" onClick={onClear} aria-label="Limpar" className="inline-flex">
          <span className="material-symbols-outlined text-[15px] opacity-70 hover:opacity-100">close</span>
        </button>
      )}
    </span>
  )
}

function durationLabel(startTime, dueTime) {
  if (!startTime || !dueTime) return null
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = dueTime.split(':').map(Number)
  const diff = (eh * 60 + em) - (sh * 60 + sm)
  if (diff <= 0) return null
  const h = Math.floor(diff / 60), m = diff % 60
  return `${h > 0 ? `${h}h` : ''}${m > 0 ? ` ${m}min` : ''}`.trim()
}

// ── Fileira de chips + seletores inline ─────────────────────────────────────
export function MetaChips({ form, setForm }) {
  const [open, setOpen] = useState(null)   // 'date' | 'time' | 'reminder' | 'recurrence' | 'project' | null
  const set = (patch) => setForm(f => ({ ...f, ...patch }))
  const toggle = (k) => setOpen(o => (o === k ? null : k))

  const reminderLabel = REMINDER_OPTIONS.find(o => o.value === form.reminderOffset)?.label
  const recurrenceLabel = RECURRENCE_OPTIONS.find(o => o.value === form.recurrence)?.label
  const dur = durationLabel(form.startTime, form.dueTime)
  const timeText = form.startTime
    ? (form.dueTime ? `${form.startTime}–${form.dueTime}` : form.startTime)
    : (form.dueTime ? `até ${form.dueTime}` : null)

  const panelCls = "mt-3 rounded-xl p-3 border border-outline-variant/40"
  const panelStyle = { background: 'var(--clr-surface-low)' }

  // Lembrete configurado para um momento que já passou — não vai tocar.
  // Antes era salvo em silêncio e o usuário achava que a notificação "falhou".
  const fireMs = form.reminderOffset != null && form.dueDate ? calcReminderMs(form) : null
  const reminderInPast = fireMs != null && fireMs <= Date.now()

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Chip icon="event" filled={!!form.dueDate} active={open === 'date'}
          onClick={() => toggle('date')}
          onClear={() => set({ dueDate: null, reminderOffset: null, recurrence: 'none', recurrenceDays: null })}>
          {form.dueDate ? formatDate(form.dueDate) : 'Data'}
        </Chip>

        <Chip icon="schedule" filled={!!(form.startTime || form.dueTime)} active={open === 'time'}
          onClick={() => toggle('time')}
          onClear={() => set({ startTime: null, dueTime: null })}>
          {timeText || 'Horário'}
        </Chip>

        {form.dueDate && (
          <Chip icon="notifications" filled={form.reminderOffset != null} active={open === 'reminder'}
            onClick={() => toggle('reminder')}
            onClear={() => set({ reminderOffset: null })}>
            {form.reminderOffset != null ? (reminderLabel || 'Lembrete') : 'Lembrete'}
          </Chip>
        )}

        {form.dueDate && (
          <Chip icon="repeat" filled={form.recurrence && form.recurrence !== 'none'} active={open === 'recurrence'}
            onClick={() => toggle('recurrence')}
            onClear={() => set({ recurrence: 'none', recurrenceDays: null })}>
            {form.recurrence && form.recurrence !== 'none' ? (recurrenceLabel || 'Repetir') : 'Repetir'}
          </Chip>
        )}

        <Chip icon="folder" filled={!!form.project} active={open === 'project'}
          onClick={() => toggle('project')}
          onClear={() => set({ project: '' })}>
          {form.project || 'Projeto'}
        </Chip>
      </div>

      {reminderInPast && (
        <p className="text-[11px] text-error font-label mt-2 flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px]">warning</span>
          Esse horário já passou — o lembrete não será enviado. Ajuste a data ou o horário.
        </p>
      )}

      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            key={open}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {open === 'date' && (
              <div className={panelCls} style={panelStyle}>
                <input
                  type="date"
                  autoFocus
                  className="input-field text-sm w-full"
                  value={form.dueDate || ''}
                  onChange={e => set({ dueDate: e.target.value || null })}
                />
              </div>
            )}

            {open === 'time' && (
              <div className={panelCls} style={panelStyle}>
                <div className="flex items-center gap-2">
                  <input type="time" className="input-field text-sm flex-1" value={form.startTime || ''}
                    onChange={e => set({ startTime: e.target.value || null })} />
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">arrow_forward</span>
                  <input type="time" className="input-field text-sm flex-1" value={form.dueTime || ''}
                    onChange={e => set({ dueTime: e.target.value || null })} />
                </div>
                {dur && (
                  <p className="text-[11px] text-primary font-label mt-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">schedule</span>
                    Duração: {dur}
                  </p>
                )}
              </div>
            )}

            {open === 'reminder' && (
              <div className={panelCls} style={panelStyle}>
                <select
                  className="input-field text-sm w-full"
                  value={form.reminderOffset ?? ''}
                  onChange={e => set({ reminderOffset: e.target.value === '' ? null : Number(e.target.value) })}
                >
                  <option value="">Sem lembrete</option>
                  {REMINDER_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {form.reminderOffset != null && (form.startTime || form.dueTime) && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] text-on-surface-variant font-label">Em relação a:</span>
                    <div className="flex gap-1.5">
                      {[{ v: 'start', l: 'Início' }, { v: 'end', l: 'Término' }].map(o => (
                        <button key={o.v} type="button"
                          onClick={() => set({ reminderAnchor: o.v })}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-label font-medium transition-all
                            ${(form.reminderAnchor || 'start') === o.v ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {open === 'recurrence' && (
              <div className={panelCls} style={panelStyle}>
                <select
                  className="input-field text-sm w-full"
                  value={form.recurrence || 'none'}
                  onChange={e => {
                    const v = e.target.value
                    setForm(f => ({
                      ...f,
                      recurrence: v,
                      recurrenceDays: v === 'custom'
                        ? (Array.isArray(f.recurrenceDays) && f.recurrenceDays.length ? f.recurrenceDays : [1, 2, 3, 4, 5])
                        : f.recurrenceDays,
                    }))
                  }}
                >
                  {RECURRENCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {form.recurrence === 'custom' && (
                  <div className="mt-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {DAYS_PT.map((d, i) => {
                        const sel = (form.recurrenceDays || []).includes(i)
                        return (
                          <button key={i} type="button"
                            onClick={() => setForm(f => {
                              const c = Array.isArray(f.recurrenceDays) ? f.recurrenceDays : []
                              const next = c.includes(i) ? c.filter(x => x !== i) : [...c, i].sort((a, b) => a - b)
                              return { ...f, recurrenceDays: next }
                            })}
                            className={`px-2.5 py-1.5 rounded-full text-xs font-label font-medium transition-all
                              ${sel ? 'bg-primary text-white ring-2 ring-primary/40 scale-105' : 'bg-surface-container text-on-surface-variant'}`}>
                            {d}
                          </button>
                        )
                      })}
                    </div>
                    {recurrenceInvalid(form) && (
                      <p className="text-[11px] text-error mt-1.5 font-label">Selecione ao menos um dia.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {open === 'project' && (
              <div className={panelCls} style={panelStyle}>
                <input
                  autoFocus
                  className="input-field text-sm w-full"
                  placeholder="Ex: Trabalho"
                  value={form.project}
                  onChange={e => set({ project: e.target.value })}
                  maxLength={100}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
