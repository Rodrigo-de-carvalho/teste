import { AnimatePresence, motion } from 'framer-motion'
import useStore from '../../store/useStore'

export default function LevelUpModal() {
  const { levelUpModal, clearLevelUpModal } = useStore()

  return (
    <AnimatePresence>
      {levelUpModal && (
        <>
          <motion.div
            key="lv-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-inverse-surface/50 backdrop-blur-sm"
            onClick={clearLevelUpModal}
          />
          <motion.div
            key="lv-card"
            initial={{ opacity: 0, scale: 0.7, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 280 }}
            className="fixed inset-0 z-[111] flex items-center justify-center p-6"
          >
            <div className="rounded-2xl p-8 max-w-sm w-full text-center shadow-float relative overflow-hidden" style={{ background: 'var(--clr-white-card)' }}>
              {/* Glow */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/20 rounded-full blur-3xl" />

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', damping: 15, stiffness: 300 }}
                className="w-20 h-20 bg-primary rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-primary-glow relative z-10"
              >
                <span className="material-symbols-outlined text-white text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  emoji_events
                </span>
              </motion.div>

              <p className="font-label text-primary text-sm font-semibold tracking-widest uppercase mb-1 relative z-10">
                Nível acima!
              </p>
              <h2 className="font-display font-bold text-on-surface text-4xl tracking-tight mb-2 relative z-10">
                Nível {levelUpModal.to}
              </h2>
              <p className="text-on-surface-variant text-sm mb-8 relative z-10">
                Você forjou mais um nível. Continue assim! 🔥
              </p>

              <button
                onClick={clearLevelUpModal}
                className="btn-primary w-full justify-center py-3 relative z-10"
              >
                Continuar forjando
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
