import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../../store/useStore'

const NAV = [
  { id: 'dashboard', icon: 'bolt',             label: 'Dashboard'    },
  { id: 'inbox',     icon: 'inbox',             label: 'Entrada'      },
  { id: 'planning',  icon: 'calendar_view_week',label: 'Planejamento' },
  { id: 'insights',  icon: 'query_stats',       label: 'Insights'     },
]

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, setPage, currentPage, user, getXpProgress } = useStore()
  const xp = getXpProgress()

  // close on outside click / esc
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setSidebarOpen])

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-50 bg-inverse-surface/30 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 w-80 bg-surface rounded-r-xl shadow-float flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-6 flex items-center justify-between border-b border-outline-variant/30">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-primary-glow">
                  <span className="material-symbols-outlined text-white text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    bolt
                  </span>
                </div>
                <div>
                  <p className="font-display font-bold text-primary text-lg tracking-tight leading-none">Forge</p>
                  <p className="text-on-surface-variant text-xs font-label mt-0.5">Olá, {user.name} 👋</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary-container/50 text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
              {NAV.map(({ id, icon, label }) => (
                <button
                  key={id}
                  onClick={() => { setPage(id) }}
                  className={`sidebar-item w-full text-left ${currentPage === id ? 'active' : ''}`}
                >
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={currentPage === id ? { fontVariationSettings: "'FILL' 1" } : {}}
                  >
                    {icon}
                  </span>
                  <span>{label}</span>
                </button>
              ))}

              <div className="mx-6 my-4 border-t border-outline-variant/30" />

              <button className="sidebar-item w-full text-left">
                <span className="material-symbols-outlined text-[22px]">settings</span>
                <span>Configurações</span>
              </button>
            </nav>

            {/* XP Bar */}
            <div className="mx-4 mb-6 p-4 bg-surface-container-low rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-label text-on-surface-variant font-medium">
                  Nível {xp.level}
                </span>
                <span className="text-xs font-label text-primary font-semibold">
                  {xp.earned}/{xp.needed} XP
                </span>
              </div>
              <div className="h-1.5 w-full bg-secondary-container rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${xp.pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <p className="text-[10px] text-on-surface-variant/60 font-label mt-1.5">
                🔥 {user.streak} dias de streak
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
