import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { version } from '../../package.json'
import { supabase, isValidAvatarUrl } from '../lib/supabase'
import useStore from '../store/useStore'
import { canInstall, installApp, onInstallReady } from '../utils/pwa'
import {
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
} from '../utils/notifications'

export default function Settings() {
  const { user, darkMode, toggleDarkMode, logout, deleteAccount, resetXp } = useStore()
  const [name, setName]             = useState(user.name || '')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [confirmDelete, setConfirmDelete]   = useState(false)
  const [confirmResetXp, setConfirmResetXp] = useState(false)
  const [resettingXp, setResettingXp]       = useState(false)
  const [resetDone, setResetDone]           = useState(false)
  const [showInstall, setShowInstall]       = useState(canInstall())
  const [notifPerm, setNotifPerm]           = useState(notificationPermission())
  const [notifLoading, setNotifLoading]     = useState(false)

  useEffect(() => {
    const unsub = onInstallReady(() => setShowInstall(true))
    return unsub
  }, [])

  async function handleRequestNotifications() {
    setNotifLoading(true)
    const granted = await requestNotificationPermission()
    setNotifPerm(granted ? 'granted' : 'denied')
    setNotifLoading(false)
  }

  const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  async function handleSaveName(e) {
    e.preventDefault()
    if (!name.trim() || name.trim() === user.name) return
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
      if (error) throw error
      useStore.setState(s => ({ user: { ...s.user, name: name.trim() }, authUser: { ...s.authUser, name: name.trim() } }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Forje] handleSaveName failed:', err)
      setName(user.name || '')
    } finally {
      setSaving(false)
    }
  }

  async function handleInstall() {
    const installed = await installApp()
    if (installed) setShowInstall(false)
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    await deleteAccount()
    setDeleting(false)
  }

  async function handleResetXp() {
    setResettingXp(true)
    try {
      await resetXp()
      setConfirmResetXp(false)
      setResetDone(true)
      setTimeout(() => setResetDone(false), 3500)
    } finally {
      setResettingXp(false)
    }
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
          {isValidAvatarUrl(user.avatar) ? (
            <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer"
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
            className={`w-12 h-6 rounded-full transition-all duration-300 relative flex-shrink-0 ${darkMode ? 'bg-primary' : 'bg-outline-variant'}`}>
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
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Nível', value: user.level, icon: 'military_tech' },
            { label: 'XP Total', value: user.xp,   icon: 'bolt' },
            { label: 'Streak',  value: `${user.streak}🔥`, icon: 'local_fire_department' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--clr-surface-ctn)' }}>
              <span className="material-symbols-outlined text-primary text-[20px] block mb-1"
                style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              <p className="font-display font-bold text-primary text-xl">{value}</p>
              <p className="text-on-surface-variant text-[10px] font-label">{label}</p>
            </div>
          ))}
        </div>

        {/* Reset XP — três estados: botão / confirmação / sucesso */}
        {resetDone ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(76,175,80,0.1)', color: 'var(--clr-success, #4caf50)' }}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            XP e nível resetados com sucesso!
          </motion.div>
        ) : !confirmResetXp ? (
          <button
            onClick={() => setConfirmResetXp(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold
                       text-on-surface-variant transition-all hover:bg-secondary-container/30"
            style={{ borderColor: 'var(--clr-outline-var)' }}
          >
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            Resetar XP e nível
          </button>
        ) : (
          <div className="rounded-xl p-4 border border-error/30" style={{ background: 'rgba(211,47,47,0.05)' }}>
            <p className="text-sm text-on-surface font-semibold mb-1">Resetar conquistas?</p>
            <p className="text-xs text-on-surface-variant mb-4">
              Seu XP e nível voltarão a zero. As tarefas não são afetadas.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmResetXp(false)}
                disabled={resettingXp}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-on-surface-variant transition-all disabled:opacity-50"
                style={{ background: 'var(--clr-surface-ctn)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleResetXp}
                disabled={resettingXp}
                className="flex-1 py-2 rounded-xl bg-error text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
              >
                {resettingXp ? 'Resetando...' : 'Sim, resetar'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Notificações ── */}
      {notificationsSupported() && (
        <section className="glass rounded-2xl p-6 border border-white/60 shadow-card mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
            <h3 className="font-display font-semibold text-on-surface">Notificações</h3>
          </div>

          {notifPerm === 'granted' ? (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--clr-surface-ctn)' }}>
              <span className="material-symbols-outlined text-success text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Notificações ativadas</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Você será avisado quando tarefas vencerem</p>
              </div>
            </div>
          ) : notifPerm === 'denied' ? (
            <div>
              <div className="flex items-center gap-3 p-3 rounded-xl mb-3" style={{ background: 'rgba(186,26,26,0.08)' }}>
                <span className="material-symbols-outlined text-error text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>notifications_off</span>
                <div>
                  <p className="text-sm font-medium text-on-surface">Notificações bloqueadas</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Para ativar, vá em Configurações do navegador → Notificações</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-on-surface-variant mb-4">
                Receba lembretes quando suas tarefas estiverem prestes a vencer, mesmo com o app em segundo plano.
              </p>
              <button
                onClick={handleRequestNotifications}
                disabled={notifLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-semibold
                           transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
                {notifLoading ? 'Aguardando...' : 'Ativar notificações'}
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Instalar o app ── */}
      <section className="glass rounded-2xl p-6 border border-white/60 shadow-card mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>install_mobile</span>
          <h3 className="font-display font-semibold text-on-surface">Instalar o Forje</h3>
        </div>

        {showInstall ? (
          <div>
            <p className="text-sm text-on-surface-variant mb-4">
              Instale o Forje na sua tela inicial para acesso rápido, sem abrir o navegador.
            </p>
            <button
              onClick={handleInstall}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-semibold
                         transition-all hover:opacity-90 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
              Instalar agora
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-on-surface-variant mb-4">
              Para instalar o Forje na sua tela inicial, siga os passos abaixo:
            </p>
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--clr-surface-ctn)' }}>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-on-surface">Abra o menu do Chrome</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Toque nos três pontos ⋮ no canto superior direito</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-on-surface">Adicionar à tela inicial</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Selecione "Adicionar à tela inicial" ou "Instalar aplicativo"</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-on-surface">Confirmar instalação</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Toque em "Instalar" na janela que aparecer</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant/60 mt-3 text-center">
              O Forje abrirá como app nativo, sem barra de endereço
            </p>
          </div>
        )}
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
            Você pode solicitar a exclusão total dos seus dados a qualquer momento pelo botão abaixo.
          </p>
          <p className="flex items-start gap-2">
            <span className="material-symbols-outlined text-primary/70 text-[16px] mt-0.5 flex-shrink-0">check_circle</span>
            Em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
          </p>
        </div>

        <div className="rounded-xl p-4 text-xs text-on-surface-variant/70 leading-relaxed"
          style={{ background: 'var(--clr-surface-ctn)' }}>
          <strong className="text-on-surface-variant">Dados coletados:</strong> nome, e-mail, foto de perfil,
          tarefas, subtarefas, tempo de foco, XP e nível. Usados exclusivamente para o funcionamento do Forje
          e nunca vendidos ou compartilhados com terceiros.
        </div>
      </section>

      {/* ── Conta ── */}
      <section className="glass rounded-2xl p-6 border border-white/60 shadow-card">
        <h3 className="font-display font-semibold text-on-surface mb-4">Conta</h3>
        <p className="text-xs text-on-surface-variant/40 text-right mb-4">v{version}</p>

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
            style={{ borderColor: 'rgba(211,47,47,0.3)' }}>
            <span className="material-symbols-outlined text-[18px]">delete_forever</span>
            Excluir minha conta e dados (LGPD)
          </button>
        ) : (
          <div className="rounded-xl p-4 border border-error/30" style={{ background: 'rgba(211,47,47,0.05)' }}>
            <p className="text-sm text-on-surface font-semibold mb-1">Tem certeza?</p>
            <p className="text-xs text-on-surface-variant mb-4">
              Seus dados e tarefas serão removidos imediatamente. O encerramento completo do acesso pode levar até 24h.
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
