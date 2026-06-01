import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

export default function Settings() {
  const { user, darkMode, toggleDarkMode, logout, deleteAccount } = useStore()
  const [name, setName]       = useState(user.name || '')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  async function handleSaveName(e) {
    e.preventDefault()
    if (!name.trim() || name.trim() === user.name) return
    setSaving(true)
    await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    useStore.setState(s => ({ user: { ...s.user, name: name.trim() }, authUser: { ...s.authUser, name: name.trim() } }))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    await deleteAccount()
    setDeleting(false)
  }

  return (
    <div className="animate-fade-in max-w-lg mx-auto pb-16">
      <div className="mb-8">
        <p className="font-label text-primary text-xs font-semibold tracking-[0.2em] uppercase mb-1">Configurações</p>
        <h2 className="font-display font-bold text-on-surface text-3xl tracking-tight">Seu Perfil</h2>
      </div>

      {/* ── Perfil ── */}
      <section className="glass rounded-2xl p-6 border border-white/60 shadow-card mb-4">
        <h3 className="font-display font-semibold text-on-surface mb-5">Foto e Nome</h3>

        <div className="flex items-center gap-4 mb-6">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name}
              className="w-20 h-20 rounded-2xl object-cover ring-2 ring-primary/30 flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-primary-glow flex-shrink-0">
              <span className="font-display font-bold text-white text-2xl">{initials}</span>
            </div>
          )}
          <div>
            <p className="font-semibold text-on-surface">{user.name}</p>
            <p className="text-on-surface-variant text-sm">{user.email}</p>
            {user.avatar && (
              <p className="text-on-surface-variant/50 text-xs mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">verified</span>
                Foto sincronizada com o Google
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveName}>
          <label className="block text-xs font-label font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wider">
            Nome de exibição
          </label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu nome"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none border transition-all"
              style={{ background: 'var(--clr-surface-low)', borderColor: 'var(--clr-outline-var)', color: 'var(--clr-on-surface)' }}
            />
            <button type="submit" disabled={saving || !name.trim()}
              className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 min-w-[80px]">
              {saving ? '...' : saved ? '✓ Salvo' : 'Salvar'}
            </button>
          </div>
        </form>
      </section>

      {/* ── Preferências ── */}
      <section className="glass rounded-2xl p-6 border border-white/60 shadow-card mb-4">
        <h3 className="font-display font-semibold text-on-surface mb-4">Preferências</h3>

        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium text-on-surface text-sm">Modo noturno</p>
            <p className="text-on-surface-variant/60 text-xs mt-0.5">Reduz cansaço visual à noite</p>
          </div>
          <button onClick={toggleDarkMode}
            className={`w-12 h-6 rounded-full transition-all duration-300 relative ${darkMode ? 'bg-primary' : 'bg-outline-variant'}`}>
            <motion.div
              animate={{ x: darkMode ? 24 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
            />
          </button>
        </div>
      </section>

      {/* ── Conquistas ── */}
      <section className="glass rounded-2xl p-6 border border-white/60 shadow-card mb-4">
        <h3 className="font-display font-semibold text-on-surface mb-4">Conquistas</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Nível', value: user.level, icon: 'military_tech' },
            { label: 'XP Total', value: user.xp, icon: 'bolt' },
            { label: 'Streak', value: `${user.streak}🔥`, icon: 'local_fire_department' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--clr-surface-ctn)' }}>
              <span className="material-symbols-outlined text-primary text-[20px] block mb-1"
                style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              <p className="font-display font-bold text-primary text-xl">{value}</p>
              <p className="text-on-surface-variant text-[10px] font-label">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── LGPD / Privacidade ── */}
      <section className="glass rounded-2xl p-6 border border-white/60 shadow-card mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
          <h3 className="font-display font-semibold text-on-surface">Privacidade e LGPD</h3>
        </div>

        <div className="space-y-3 text-sm text-on-surface-variant mb-5">
          <p className="flex items-start gap-2">
            <span className="material-symbols-outlined text-primary/70 text-[16px] mt-0.5 flex-shrink-0">check_circle</span>
            Seus dados são armazenados de forma segura no Supabase e nunca compartilhados com terceiros.
          </p>
          <p className="flex items-start gap-2">
            <span className="material-symbols-outlined text-primary/70 text-[16px] mt-0.5 flex-shrink-0">check_circle</span>
            Coletamos apenas: nome, e-mail, foto de perfil (via Google) e suas tarefas criadas no app.
          </p>
          <p className="flex items-start gap-2">
            <span className="material-symbols-outlined text-primary/70 text-[16px] mt-0.5 flex-shrink-0">check_circle</span>
            Você pode solicitar a exclusão total dos seus dados a qualquer momento.
          </p>
          <p className="flex items-start gap-2">
            <span className="material-symbols-outlined text-primary/70 text-[16px] mt-0.5 flex-shrink-0">check_circle</span>
            Em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
          </p>
        </div>

        <div className="rounded-xl p-4 text-xs text-on-surface-variant/70 leading-relaxed"
          style={{ background: 'var(--clr-surface-ctn)' }}>
          <strong className="text-on-surface-variant">Dados coletados:</strong> nome, e-mail, foto de perfil,
          tarefas, subtarefas, tempo de foco, XP e nível. Esses dados são usados exclusivamente
          para funcionamento do Forje e nunca vendidos ou compartilhados.
        </div>
      </section>

      {/* ── Conta ── */}
      <section className="glass rounded-2xl p-6 border border-white/60 shadow-card">
        <h3 className="font-display font-semibold text-on-surface mb-4">Conta</h3>

        <button onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold
                     text-on-surface-variant transition-all hover:bg-secondary-container/30 mb-3"
          style={{ borderColor: 'var(--clr-outline-var)' }}>
          <span className="material-symbols-outlined text-[18px]">logout</span>
          Sair da conta
        </button>

        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold
                       text-error transition-all hover:bg-error/10"
            style={{ borderColor: 'rgba(var(--clr-error-rgb, 211,47,47), 0.3)' }}>
            <span className="material-symbols-outlined text-[18px]">delete_forever</span>
            Excluir minha conta e dados
          </button>
        ) : (
          <div className="rounded-xl p-4 border border-error/30" style={{ background: 'rgba(211,47,47,0.05)' }}>
            <p className="text-sm text-on-surface font-semibold mb-1">Tem certeza?</p>
            <p className="text-xs text-on-surface-variant mb-4">
              Isso apagará <strong>permanentemente</strong> todas as suas tarefas e dados. Não há como desfazer.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-on-surface-variant transition-all"
                style={{ background: 'var(--clr-surface-ctn)' }}>
                Cancelar
              </button>
              <button onClick={handleDeleteAccount} disabled={deleting}
                className="flex-1 py-2 rounded-xl bg-error text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60">
                {deleting ? 'Excluindo...' : 'Sim, excluir tudo'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
