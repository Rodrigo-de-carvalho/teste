import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useStore from '../store/useStore'
import { AutoTextarea } from '../components/tasks/TaskFields'

function previewText(body) {
  const t = (body || '').trim()
  if (!t) return 'Sem conteúdo'
  return t.split('\n').filter(Boolean)[0]?.slice(0, 140) || 'Sem conteúdo'
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function Notes() {
  const { notes, addNote, updateNote, deleteNote } = useStore()
  const [openId, setOpenId]       = useState(null)
  const [buf, setBuf]             = useState({ title: '', body: '' })
  const [composing, setComposing] = useState(false)
  const [draft, setDraft]         = useState({ title: '', body: '' })
  const [confirmId, setConfirmId] = useState(null)

  function openNote(n) {
    // salva a nota aberta anteriormente antes de trocar
    if (openId && openId !== n.id) updateNote(openId, buf)
    setOpenId(n.id)
    setBuf({ title: n.title || '', body: n.body || '' })
    setConfirmId(null)
  }

  function closeOpen() {
    if (openId) updateNote(openId, buf)
    setOpenId(null)
  }

  function startCompose() {
    if (openId) closeOpen()
    setDraft({ title: '', body: '' })
    setComposing(true)
  }

  function saveCompose() {
    if (draft.title.trim() || draft.body.trim()) addNote(draft)
    setComposing(false)
    setDraft({ title: '', body: '' })
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <section className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-on-surface text-4xl md:text-5xl tracking-tight mb-2">
            Notas
          </h2>
          <p className="text-on-surface-variant">Um espaço livre para ideias, listas e rascunhos.</p>
        </div>
        <button onClick={startCompose} className="btn-primary flex-shrink-0">
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span className="hidden sm:inline">Nova nota</span>
        </button>
      </section>

      {/* Composer (nova nota) */}
      <AnimatePresence>
        {composing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="forge-card p-4 mb-4"
          >
            <input
              autoFocus
              className="w-full bg-transparent outline-none font-display font-semibold text-lg text-on-surface placeholder-on-surface-variant/40 mb-2"
              placeholder="Título (opcional)"
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              maxLength={200}
            />
            <AutoTextarea
              className="w-full bg-transparent outline-none text-sm text-on-surface placeholder-on-surface-variant/40 font-body"
              minHeight={96}
              placeholder="Escreva à vontade..."
              value={draft.body}
              onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
              maxLength={20000}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => { setComposing(false); setDraft({ title: '', body: '' }) }} className="btn-ghost py-2 px-4 text-sm">
                Cancelar
              </button>
              <button onClick={saveCompose} className="btn-primary py-2 px-5 text-sm">Salvar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista */}
      {notes.length === 0 && !composing ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-primary text-[28px]">sticky_note_2</span>
          </div>
          <p className="font-display font-semibold text-on-surface text-xl mb-2">Nenhuma nota ainda</p>
          <p className="text-on-surface-variant text-sm mb-6">Crie sua primeira nota para começar.</p>
          <button onClick={startCompose} className="btn-primary mx-auto">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nova nota
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {notes.map(n => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                className="forge-card overflow-hidden"
              >
                {openId === n.id ? (
                  /* Editor inline */
                  <div className="p-4">
                    <input
                      className="w-full bg-transparent outline-none font-display font-semibold text-lg text-on-surface placeholder-on-surface-variant/40 mb-2"
                      placeholder="Título (opcional)"
                      value={buf.title}
                      onChange={e => setBuf(b => ({ ...b, title: e.target.value }))}
                      maxLength={200}
                    />
                    <AutoTextarea
                      autoFocus
                      className="w-full bg-transparent outline-none text-sm text-on-surface placeholder-on-surface-variant/40 font-body"
                      minHeight={120}
                      placeholder="Escreva à vontade..."
                      value={buf.body}
                      onChange={e => setBuf(b => ({ ...b, body: e.target.value }))}
                      maxLength={20000}
                    />
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant/30">
                      {confirmId === n.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-error font-label">Excluir?</span>
                          <button onClick={() => { deleteNote(n.id); setOpenId(null); setConfirmId(null) }}
                            className="text-xs font-semibold text-error px-2 py-1 rounded-lg hover:bg-error-container/40">Sim</button>
                          <button onClick={() => setConfirmId(null)}
                            className="text-xs font-semibold text-on-surface-variant px-2 py-1 rounded-lg hover:bg-surface-container">Não</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmId(n.id)}
                          className="flex items-center gap-1 text-error text-sm font-label hover:opacity-80">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                          Excluir
                        </button>
                      )}
                      <button onClick={closeOpen} className="btn-primary py-2 px-5 text-sm">Concluir</button>
                    </div>
                  </div>
                ) : (
                  /* Card resumido */
                  <button onClick={() => openNote(n)} className="w-full text-left p-4 hover:bg-surface-container/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display font-semibold text-on-surface truncate">
                        {n.title?.trim() || 'Sem título'}
                      </h3>
                      <span className="text-[11px] text-on-surface-variant/60 font-label flex-shrink-0 mt-0.5">{fmtDate(n.updatedAt)}</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mt-1 line-clamp-2 whitespace-pre-line">{previewText(n.body)}</p>
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
