import useStore from '../../store/useStore'

const NAV = [
  { id: 'dashboard', icon: 'bolt',              label: 'Foco'    },
  { id: 'inbox',     icon: 'inbox',              label: 'Entrada' },
  { id: 'planning',  icon: 'calendar_view_week', label: 'Semana'  },
  { id: 'insights',  icon: 'query_stats',        label: 'Stats'   },
]

export default function BottomNav() {
  const { currentPage, setPage, setQuickCaptureOpen } = useStore()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-white/60 flex items-center justify-around px-2"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))', paddingTop: '0.5rem', height: 'auto', minHeight: '72px' }}
    >
      {NAV.slice(0, 2).map(({ id, icon, label }) => (
        <button
          key={id}
          onClick={() => setPage(id)}
          className={`nav-item flex-1 py-2 min-h-[56px] ${currentPage === id ? 'active' : ''}`}
        >
          <span
            className="material-symbols-outlined text-[26px]"
            style={currentPage === id ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            {icon}
          </span>
          <span className="text-[10px] font-label font-medium uppercase tracking-wider mt-0.5">{label}</span>
        </button>
      ))}

      {/* FAB center */}
      <button
        onClick={() => setQuickCaptureOpen(true)}
        className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-primary-glow
                   transition-all duration-200 active:scale-95 -mt-8 mx-3 flex-shrink-0"
        style={{ boxShadow: '0 4px 24px rgba(107,56,212,0.5)' }}
      >
        <span className="material-symbols-outlined text-white text-[30px]">add</span>
      </button>

      {NAV.slice(2).map(({ id, icon, label }) => (
        <button
          key={id}
          onClick={() => setPage(id)}
          className={`nav-item flex-1 py-2 min-h-[56px] ${currentPage === id ? 'active' : ''}`}
        >
          <span
            className="material-symbols-outlined text-[26px]"
            style={currentPage === id ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            {icon}
          </span>
          <span className="text-[10px] font-label font-medium uppercase tracking-wider mt-0.5">{label}</span>
        </button>
      ))}
    </nav>
  )
}
