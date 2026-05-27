import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useStore from './store/useStore'
import { isAuthenticated } from './lib/api'
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

const PAGES = {
  dashboard: Dashboard,
  inbox:     Inbox,
  planning:  Planning,
  insights:  Insights,
}

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.18 } },
}

export default function App() {
  const { currentPage, setPage, loadUserFromApi, loadTasksFromApi, isLoggedIn } = useStore()

  // Detect /auth/callback route
  useEffect(() => {
    const path = window.location.pathname
    if (path === '/auth/callback') {
      setPage('auth_callback')
      return
    }

    // Se não está logado, vai para login
    if (!isAuthenticated()) {
      setPage('login')
      return
    }

    // Está logado: carrega dados
    loadUserFromApi()
    loadTasksFromApi()
  }, [])

  // Auth callback page (fora do Layout)
  if (currentPage === 'auth_callback') {
    return <AuthCallback />
  }

  // Login page (fora do Layout)
  if (currentPage === 'login') {
    return <LoginPage />
  }

  const Page = PAGES[currentPage] || Dashboard

  return (
    <>
      <Layout>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Page />
          </motion.div>
        </AnimatePresence>
      </Layout>

      {/* Global overlays */}
      <QuickCapture />
      <TaskDetailModal />
      <XpToast />
      <LevelUpModal />
    </>
  )
}
