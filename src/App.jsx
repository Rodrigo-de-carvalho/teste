import { AnimatePresence, motion } from 'framer-motion'
import useStore from './store/useStore'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Inbox from './pages/Inbox'
import Planning from './pages/Planning'
import Insights from './pages/Insights'
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
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
}

export default function App() {
  const { currentPage } = useStore()
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
