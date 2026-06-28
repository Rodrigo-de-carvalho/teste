import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useStore from '../../store/useStore'
import { addTaskToCalendar } from '../../utils/calendar'
import { PriorityFlag, MetaChips, AutoTextarea } from './TaskFields'
import { recurrenceInvalid } from '../../utils/dates'

export default function TaskDetailModal() {
  const { editingTask, setEditingTask, updateTask, deleteTask, completeTask, uncompleteTask, toggleSubtask } = useStore()
  const [form, setForm]                   = useState(null)
  const [newSub, setNewSub]               = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmUncheck, setConfirmUncheck] = useState(false)

  useEffect(() => {
    if (editingTask) {
      setForm({ ...editingTask })
      setNewSub('')
      setConfirmDelete(false)
      setConfirmUncheck(false)
    }
  }, [editingTask])

  const invalid = recurrenceInvalid(form)

  function save() {
    if (!form || !form.title.trim() || invalid) return
    updateTask(form.id, form)
    setEditingTask(null)
  }

  function handleDeleteConfirmed() {
    deleteTask(editingTask.id)
    setEditingTask(null)
  }

  function handleToggleComplete() {
    if (editingTask.completed) {
      setConfirmUncheck(true)
    } else {
      const id = editingTask.id
      // Salva alterações do form antes de completar — apenas se algo mudou
      const hasChanges = form && form.title.trim() && (
        form.title          !== editingTask.title          ||
        form.notes          !== editingTask.notes          ||
        form.priority       !== editingTask.priority       ||
        form.project        !== editingTask.project        ||
        form.dueDate        !== editingTask.dueDate        ||
        form.startTime      !== editingTask.startTime      ||
        form.dueTime        !== editingTask.dueTime        ||
        form.reminderOffset !== editingTask.reminderOffset ||
        form.reminderAnchor !== editingTask.reminderAnchor ||
        form.recurrence     !== editingTask.recurrence     ||
        JSON.stringify(form.recurrenceDays || []) !== JSON.stringify(editingTask.recurrenceDays || [])
      )
      if (hasChanges) updateTask(form.id, form)
      completeTask(id)
      setEditingTask(null)
    }
  }

  function doUncheck() {
    uncompleteTask(editingTask.id)
    setEditingTask(null)
  }

  function addSubtask() {
    if (!newSub.trim()) return
    const sub = { id: Date.now().toString(), title: newSub.trim(), done: false }
    setForm(f => ({ ...f, subtasks: [...(f.subtasks || []), sub] }))
    setNewSub('')
  }

  if (!form) return null

  const isCompleted = editingTask?.completed
  const noConfirm   = !confirmDelete && !confirmUncheck

  return (
    <AnimatePresence>
      {editingTask && (
        <motion.div
          key="detail-bg"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-inverse-surface/40 backdrop-blur-sm"
          onClick={() => { save(); setEditingTask(null) }}
        />
      )}

      {editingTask && (
        <motion.div
          key="detail-panel"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="fixed right-0 top-0 bottom-0 z-[81] w-full max-w-md shadow-float flex flex-col overflow-hidden"
          style={{ background: 'var(--clr-surface)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--clr-outline-var)' }}>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-on-surface text-lg">Detalhes</h3>
              {isCompleted && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-label font-semibold bg-success-container text-success">
                  CONCLUÍDA
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setConfirmDelete(true); setConfirmUncheck(false) }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-error hover:bg-error-container transition-colors"
                title="Excluir tarefa"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
              <button
                onClick={() => { save(); setEditingTask(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-secondary-container/50 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

            {/* Confirmação de exclusão */}
            <AnimatePresence>
              {confirmDelete && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-xl p-4 border border-error/30"
                  style={{ background: 'rgba(211,47,47,0.06)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-error text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                    <p className="font-semibold text-on-surface text-sm">Excluir esta tarefa?</p>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-4">Esta ação não pode ser desfeita.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold text-on-surface-variant transition-all"
                      style={{ background: 'var(--clr-surface-ctn)' }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleDeleteConfirmed}
                      className="flex-1 py-2 rounded-xl bg-error text-white text-sm font-semibold transition-all hover:opacity-90"
                    >
                      Sim, excluir
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Confirmação de desmarcar */}
            <AnimatePresence>
              {confirmUncheck && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-xl p-4 border border-error/30"
                  style={{ background: 'rgba(211,47,47,0.06)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-error text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                    <p className="font-semibold text-on-surface text-sm">Remover o XP desta tarefa?</p>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-4">
                    Desmarcar vai subtrair o XP que foi ganho ao concluir.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmUncheck(false)}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold text-on-surface-variant transition-all"
                      style={{ background: 'var(--clr-surface-ctn)' }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={doUncheck}
                      className="flex-1 py-2 rounded-xl bg-error text-white text-sm font-semibold transition-all hover:opacity-90"
                    >
                      Sim, desmarcar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Completed toggle */}
            {noConfirm && (
              <button
                onClick={handleToggleComplete}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all
                  ${isCompleted
                    ? 'bg-success-container border-success/30 text-success'
                    : 'border-outline-variant text-on-surface-variant hover:border-primary/40'}`}
              >
                <span className="material-symbols-outlined text-[20px]" style={isCompleted ? { fontVariationSettings: "'FILL' 1" } : {}}>
                  {isCompleted ? 'task_alt' : 'radio_button_unchecked'}
                </span>
                <span className="font-label font-medium text-sm">
                  {isCompleted ? 'Concluída ✓ — toque para desmarcar' : 'Marcar como concluída'}
                </span>
              </button>
            )}

            {/* Banner: tarefa concluída — campos ainda editáveis */}
            {isCompleted && noConfirm && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-primary/20"
                style={{ background: 'rgba(var(--clr-primary-rgb, 103,80,164), 0.06)' }}
              >
                <span className="material-symbols-outlined text-primary text-[18px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Esta tarefa está concluída. Você ainda pode editar os detalhes — desmarque acima para remover o XP e reativá-la.
                </p>
              </motion.div>
            )}

            {/* Title */}
            <div>
              <label className="text-xs font-label text-on-surface-variant font-semibold tracking-wider uppercase mb-2 block">Título</label>
              <div className="flex items-center gap-2">
                <input
                  className="input-forge text-lg font-semibold flex-1"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && save()}
                  placeholder="Nome da tarefa"
                  maxLength={200}
                />
                <PriorityFlag value={form.priority} onChange={(p) => setForm(f => ({ ...f, priority: p }))} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-label text-on-surface-variant font-semibold tracking-wider uppercase mb-2 block">Notas</label>
              <AutoTextarea
                className="input-field text-sm"
                minHeight={88}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Adicione contexto, links, ideias..."
                maxLength={2000}
              />
            </div>

            {/* Detalhes — chips compactos (data, horário, lembrete, repetir, projeto) */}
            <MetaChips form={form} setForm={setForm} />

            {form.recurrence && form.recurrence !== 'none' && (
              <p className="text-[11px] text-on-surface-variant/60 -mt-3">
                Ao concluir, uma nova tarefa é criada automaticamente para a próxima data.
              </p>
            )}

            {/* Adicionar ao calendário do celular */}
            {form.dueDate && (
              <button
                type="button"
                onClick={() => addTaskToCalendar(form)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-label font-medium
                           text-on-surface-variant transition-colors hover:bg-secondary-container/40"
                style={{ border: '1px solid var(--clr-outline-var)' }}
              >
                <span className="material-symbols-outlined text-[18px]">event</span>
                Adicionar ao calendário do celular
              </button>
            )}

            {/* Subtasks */}
            <div>
              <label className="text-xs font-label text-on-surface-variant font-semibold tracking-wider uppercase mb-2 block">Subtarefas</label>
              <div className="space-y-2 mb-3">
                {(form.subtasks || []).map(sub => (
                  <div key={sub.id} className="flex items-center gap-3 group">
                    <button
                      onClick={() => {
                        toggleSubtask(editingTask.id, sub.id)
                        setForm(f => ({ ...f, subtasks: f.subtasks.map(s => s.id === sub.id ? { ...s, done: !s.done } : s) }))
                      }}
                      className={`forge-checkbox w-5 h-5 ${sub.done ? 'checked' : ''}`}
                    >
                      <span className="check-icon material-symbols-outlined text-[12px]">check</span>
                    </button>
                    <span className={`flex-1 text-sm ${sub.done ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                      {sub.title}
                    </span>
                    <button
                      onClick={() => setForm(f => ({ ...f, subtasks: f.subtasks.filter(s => s.id !== sub.id) }))}
                      className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input-field text-sm flex-1"
                  value={newSub}
                  onChange={e => setNewSub(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSubtask()}
                  placeholder="Adicionar subtarefa..."
                  maxLength={200}
                />
                <button
                  onClick={addSubtask}
                  className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center hover:bg-primary/20 transition-colors flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-outline-variant/30 flex gap-3">
            <button onClick={() => setEditingTask(null)} className="btn-ghost flex-1 justify-center">Cancelar</button>
            <button
              onClick={save}
              disabled={invalid}
              className={`btn-primary flex-1 justify-center ${invalid ? 'opacity-40 cursor-not-allowed shadow-none' : ''}`}
            >
              Salvar
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
