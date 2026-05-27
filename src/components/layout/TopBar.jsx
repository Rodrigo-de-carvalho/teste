import { motion } from 'framer-motion'
import useStore from '../../store/useStore'
import { todayString } from '../../utils/dates'

export default function TopBar() {
  const { setSidebarOpen, setQuickCaptureOpen, currentPage, darkMode, toggleDarkMode } = useStore()

  const titles = {
    dashboard: 'Dashboard',
    inbox:     'Entrada',
    planning:  'Planejamento',
    insights:  'Insights',
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 glass border-b h-16 flex items-center justify-between px-5 md:px-10"
      style={{ borderColor: 'var(--clr-glass-border)' }}
    >
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-primary"
          style={{ '--hover-bg': 'var(--clr-secondary-ctn)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--clr-secondary-ctn)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          aria-label="Menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div>
          <h1 className="font-display font-bold text-primary text-2xl leading-none tracking-tighter">
            Forje
          </h1>
          <p className="text-on-surface-variant text-[10px] font-label tracking-widest uppercase hidden md:block">
            {todayString()}
          </p>
        </div>
      </div>

      {/* Center (desktop nav) */}
      <nav className="hidden md:flex items-center gap-1">
        {['dashboard', 'inbox', 'planning', 'insights'].map((p) => (
          <button
            key={p}
            onClick={() => useStore.getState().setPage(p)}
            className={`px-4 py-2 rounded-lg text-sm font-label font-medium transition-all duration-200 ${
              currentPage === p ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'
            }`}
            onMouseEnter={e => { if (currentPage !== p) e.currentTarget.style.background = 'var(--clr-secondary-ctn)' }}
            onMouseLeave={e => { if (currentPage !== p) e.currentTarget.style.background = 'transparent' }}
          >
            {titles[p]}
          </button>
        ))}
      </nav>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Quick capture hint (desktop) */}
        <button
          onClick={() => setQuickCaptureOpen(true)}
          className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-label
                     text-on-surface-variant transition-colors"
          style={{ borderColor: 'var(--clr-outline-var)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--clr-secondary-ctn)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>Nova tarefa</span>
          <kbd className="ml-1 px-1.5 py-0.5 rounded text-[10px]"
            style={{ background: 'var(--clr-surface-ctn)', color: 'var(--clr-on-variant)' }}>
            Ctrl+K
          </kbd>
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 text-on-surface-variant hover:text-primary"
          onMouseEnter={e => e.currentTarget.style.background = 'var(--clr-secondary-ctn)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          aria-label={darkMode ? 'Modo claro' : 'Modo noturno'}
          title={darkMode ? 'Ativar modo claro' : 'Ativar modo noturno'}
        >
          <motion.span
            key={darkMode ? 'moon' : 'sun'}
            initial={{ rotate: -30, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="material-symbols-outlined text-[20px]"
            style={darkMode ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            {darkMode ? 'light_mode' : 'dark_mode'}
          </motion.span>
        </button>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-primary/10 overflow-hidden ring-2 ring-primary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[20px]">person</span>
        </div>
      </div>
    </header>
  )
}
