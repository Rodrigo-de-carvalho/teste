import { useState, useEffect } from 'react'
import useStore from '../../store/useStore'

const NAV = [
  { id: 'dashboard', icon: 'bolt',              label: 'Foco'    },
  { id: 'inbox',     icon: 'inbox',             label: 'Entrada' },
  { id: 'planning',  icon: 'calendar_view_week', label: 'Semana'  },
  { id: 'settings',  icon: 'account_circle',    label: 'Perfil'  },
]

export default function BottomNav() {
  const { currentPage, setPage, setQuickCaptureOpen, user } = useStore()
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const handler = () => setKeyboardOpen(vv.height < window.innerHeight - 100)
    vv.addEventListener('resize', handler)
    return () => vv.removeEventListener('resize', handler)
  }, [])

  if (keyboardOpen) return null

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

      {/* Semana */}
      <button
        onClick={() => setPage('planning')}
        className={`nav-item flex-1 py-2 min-h-[56px] ${currentPage === 'planning' ? 'active' : ''}`}
      >
        <span
          className="material-symbols-outlined text-[26px]"
          style={currentPage === 'planning' ? { fontVariationSettings: "'FILL' 1" } : {}}
        >
          calendar_view_week
        </span>
        <span className="text-[10px] font-label font-medium uppercase tracking-wider mt-0.5">Semana</span>
      </button>

      {/* Perfil / Settings — mostra avatar real se disponível */}
      <button
        onClick={() => setPage('settings')}
        className={`nav-item flex-1 py-2 min-h-[56px] ${currentPage === 'settings' ? 'active' : ''}`}
      >
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className={`w-7 h-7 rounded-full object-cover ${currentPage === 'settings' ? 'ring-2 ring-primary' : 'ring-1 ring-outline-variant'}`}
          />
        ) : (
          <span
            className="material-symbols-outlined text-[26px]"
            style={currentPage === 'settings' ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            account_circle
          </span>
        )}
        <span className="text-[10px] font-label font-medium uppercase tracking-wider mt-0.5">Perfil</span>
      </button>
    </nav>
  )
}
