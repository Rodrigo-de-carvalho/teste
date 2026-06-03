import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from './lib/supabase'
import useStore from './store/useStore'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Inbox from './pages/Inbox'
import Planning from './pages/Planning'
import Insights from './pages/Insights'
import Settings from './pages/Settings'
import LoginPage from './pages/LoginPage'
import AuthCallback from './pages/AuthCallback'
import QuickCapture from './components/tasks/QuickCapture'
import TaskDetailModal from './components/tasks/TaskDetailModal'
import XpToast from './components/ui/XpToast'
import LevelUpModal from './components/ui/LevelUpModal'
import InstallButton from './components/ui/InstallButton'
import LgpdBanner from './components/ui/LgpdBanner'
import { registerSW } from './utils/swUpdate'

const PAGES = { dashboard: Dashboard, inbox: Inbox, planning: Planning, insights: Insights, settings: Settings }

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.18 } },
}

export default function App() {
  const { currentPage, setPage, initTheme, loadAll, setSession, applyRealtimeChange, authUser } = useStore()
  const realtimeRef = useRef(null)
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    registerSW()
    initTheme()

    // Detecta rota /auth/callback (retorno do Google OAuth)
    if (window.location.pathname === '/auth/callback') {
      setPage('auth_callback')
      return
    }

    // INITIAL_SESSION é disparado na montagem lendo o localStorage — sem rede.
    // Substitui initAuth()+timeout: o app abre imediatamente se houver sessão
    // salva; o refresh do token acontece em background via autoRefreshToken.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session) {
          await loadAll(session)
        } else {
          setPage('login')
        }
      } else if (event === 'SIGNED_IN' && session) {
        await loadAll(session)
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Realtime: sincroniza com outros dispositivos ─────────────────────────────
  useEffect(() => {
    if (!authUser?.id) return

    // Remove subscription anterior se existir
    if (realtimeRef.current) {
      supabase.removeChannel(realtimeRef.current)
    }

    const channel = supabase
      .channel(`forge:${authUser.id}`)
      // Tarefas
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${authUser.id}` },
        ({ eventType, new: newRow, old: oldRow }) => {
          applyRealtimeChange(eventType, 'tasks', newRow, oldRow)
        }
      )
      // Stats do usuário
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_stats', filter: `id=eq.${authUser.id}` },
        ({ eventType, new: newRow }) => {
          applyRealtimeChange(eventType, 'user_stats', newRow, null)
        }
      )
      .subscribe()

    realtimeRef.current = channel

    return () => {
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current)
    }
  }, [authUser?.id])

  // ── Loading screen ────────────────────────────────────────────────────────────────
  if (currentPage === 'loading') {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--clr-bg)' }}>
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-primary-glow animate-pulse">
            <span className="material-symbols-outlined text-white text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
          </div>
          <p className="font-display font-semibold text-on-surface text-lg">Forjando seu dia...</p>
        </div>
      </div>
    )
  }

  // ── Auth callback ────────────────────────────────────────────────────────────────
  if (currentPage === 'auth_callback') return <AuthCallback />

  // ── Login ──────────────────────────────────────────────────────────────────────
  if (currentPage === 'login') return (
    <>
      <LoginPage />
      <LgpdBanner />
    </>
  )

  // ── App principal ────────────────────────────────────────────────────────────────
  const Page = PAGES[currentPage] || Dashboard

  return (
    <>
      <AnimatePresence>
        {offline && (
          <motion.div
            key="offline-banner"
            initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2
                       bg-on-surface text-surface text-xs font-label font-semibold py-2 px-4"
          >
            <span className="material-symbols-outlined text-[14px]">wifi_off</span>
            Sem conexão — alterações serão salvas quando reconectar
          </motion.div>
        )}
      </AnimatePresence>
      <Layout>
        <AnimatePresence mode="wait">
          <motion.div key={currentPage} variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Page />
          </motion.div>
        </AnimatePresence>
      </Layout>
      <QuickCapture />
      <TaskDetailModal />
      <XpToast />
      <LevelUpModal />
      <InstallButton />
      <LgpdBanner />
    </>
  )
}
