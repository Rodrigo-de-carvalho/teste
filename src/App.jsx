import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from './lib/supabase'
import useStore from './store/useStore'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Inbox from './pages/Inbox'
import Planning from './pages/Planning'
import Insights from './pages/Insights'
import LoginPage from './pages/LoginPage'
import AuthCallback from './pages/AuthCallback'
import QuickCapture from './components/tasks/QuickCapture'
import TaskDetailModal from './components/tasks/TaskDetailModal'
import XpToast from './components/ui/XpToast'
import LevelUpModal from './components/ui/LevelUpModal'

const PAGES = { dashboard: Dashboard, inbox: Inbox, planning: Planning, insights: Insights }

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.18 } },
}

export default function App() {
  const { currentPage, setPage, initTheme, initAuth, loadAll, setSession, applyRealtimeChange, authUser } = useStore()
  const realtimeRef = useRef(null)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    initTheme()

    // Detecta rota /auth/callback (retorno do Google OAuth)
    if (window.location.pathname === '/auth/callback') {
      setPage('auth_callback')
      return
    }

    // Inicializa auth (verifica sessão salva)
    initAuth()

    // Escuta mudanças de auth (login/logout em qualquer aba)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await loadAll(session)
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Realtime: sincroniza com outros dispositivos ───────────────────────────
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

  // ── Loading screen ────────────────────────────────────────────────────────
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

  // ── Auth callback ─────────────────────────────────────────────────────────
  if (currentPage === 'auth_callback') return <AuthCallback />

  // ── Login ─────────────────────────────────────────────────────────────────
  if (currentPage === 'login') return <LoginPage />

  // ── App principal ─────────────────────────────────────────────────────────
  const Page = PAGES[currentPage] || Dashboard

  return (
    <>
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
    </>
  )
}
