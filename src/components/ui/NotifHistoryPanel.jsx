import { AnimatePresence, motion } from 'framer-motion'
import useStore from '../../store/useStore'

function timeAgo(at) {
  const diff = Date.now() - at
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Agora'
  if (m < 60) return `${m} min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

export default function NotifHistoryPanel() {
  const { notifHistoryOpen, setNotifHistoryOpen, notifHistory, clearNotifHistory } = useStore()

  return (
    <AnimatePresence>
      {notifHistoryOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="notif-bg"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-inverse-surface/30 backdrop-blur-sm"
            onClick={() => setNotifHistoryOpen(false)}
          />

          {/* Painel */}
          <motion.div
            key="notif-panel"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="fixed top-[4.5rem] right-4 md:right-10 z-[71] w-[min(360px,calc(100vw-2rem))]
                       rounded-2xl shadow-float overflow-hidden border"
            style={{ background: 'var(--clr-surface)', borderColor: 'var(--clr-outline-var)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'var(--clr-outline-var)' }}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
                <h3 className="font-display font-semibold text-on-surface text-base">Notificações</h3>
                {notifHistory.length > 0 && (
                  <span className="text-xs text-on-surface-variant font-label">
                    ({notifHistory.length})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifHistory.length > 0 && (
                  <button
                    onClick={clearNotifHistory}
                    className="text-xs text-on-surface-variant hover:text-error transition-colors px-2 py-1 rounded-lg font-label"
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--clr-surface-ctn)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    Limpar
                  </button>
                )}
                <button
                  onClick={() => setNotifHistoryOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant transition-colors"
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--clr-surface-ctn)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto custom-scrollbar max-h-[min(420px,60dvh)]">
              {notifHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant/30 text-[40px]">
                    notifications_off
                  </span>
                  <p className="text-sm text-on-surface-variant/60 font-label">
                    Nenhuma notificação ainda
                  </p>
                  <p className="text-xs text-on-surface-variant/40">
                    Os lembretes das suas tarefas aparecerão aqui
                  </p>
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--clr-outline-var)' }}>
                  {notifHistory.map((n) => (
                    <li key={n.id} className="flex items-start gap-3 px-5 py-3.5"
                      style={{ background: n.read ? 'transparent' : 'rgba(var(--clr-primary-rgb,103,80,164),0.04)' }}>
                      <span className="material-symbols-outlined text-primary text-[18px] mt-0.5 flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-on-surface leading-tight truncate">{n.title}</p>
                        {n.body && (
                          <p className="text-xs text-on-surface-variant mt-0.5 leading-tight">{n.body}</p>
                        )}
                        <p className="text-[10px] text-on-surface-variant/50 mt-1 font-label">
                          {timeAgo(n.at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
