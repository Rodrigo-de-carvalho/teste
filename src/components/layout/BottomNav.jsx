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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-white/60 h-20 flex items-center justify-around px-2">
      {NAV.slice(0, 2).map(({ id, icon, label }) => (
        <button
          key={id}
          onClick={() => setPage(id)}
          className={`nav-item ${currentPage === id ? 'active' : ''} flex-1`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={currentPage === id ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            {icon}
          </span>
          <span className="text-[10px] font-label font-medium uppercase tracking-wider">{label}</span>
        </button>
      ))}

      {/* FAB center */}
      <button
        onClick={() => setQuickCaptureOpen(true)}
        className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-primary-glow
                   transition-all duration-200 hover:scale-110 active:scale-95 -mt-6 mx-2"
      >
        <span className="material-symbols-outlined text-white text-[28px]">add</span>
      </button>

      {NAV.slice(2).map(({ id, icon, label }) => (
        <button
          key={id}
          onClick={() => setPage(id)}
          className={`nav-item ${currentPage === id ? 'active' : ''} flex-1`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={currentPage === id ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            {icon}
          </span>
          <span className="text-[10px] font-label font-medium uppercase tracking-wider">{label}</span>
        </button>
      ))}
    </nav>
  )
}
