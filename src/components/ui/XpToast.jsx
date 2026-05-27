import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useStore from '../../store/useStore'

export default function XpToast() {
  const { xpToast, clearXpToast } = useStore()

  useEffect(() => {
    if (!xpToast) return
    const t = setTimeout(clearXpToast, 2200)
    return () => clearTimeout(t)
  }, [xpToast, clearXpToast])

  return (
    <AnimatePresence>
      {xpToast && (
        <motion.div
          key={xpToast.key}
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-28 md:bottom-10 right-5 md:right-10 z-[100]
                     bg-inverse-surface text-inverse-on-surface rounded-xl px-5 py-3
                     flex items-center gap-3 shadow-float"
        >
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-primary-glow">
            <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              star
            </span>
          </div>
          <div>
            <p className="font-label font-bold text-sm">+{xpToast.amount} XP</p>
            <p className="text-inverse-on-surface/60 text-xs font-body truncate max-w-[180px]">
              {xpToast.taskTitle}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
