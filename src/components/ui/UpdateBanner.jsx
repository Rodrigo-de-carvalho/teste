import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { hasUpdate, onUpdateReady, applyUpdate } from '../../utils/swUpdate'

export default function UpdateBanner() {
  const [show, setShow] = useState(hasUpdate())

  useEffect(() => {
    const unsub = onUpdateReady(() => setShow(true))
    return unsub
  }, [])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -60 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[100]"
        >
          <div
            className="rounded-2xl p-4 shadow-float border flex items-center gap-3"
            style={{ background: 'var(--clr-white-card)', borderColor: 'var(--clr-outline-var)' }}
          >
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-primary-glow flex-shrink-0">
              <span
                className="material-symbols-outlined text-white text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                system_update
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-on-surface text-sm">Nova versão disponível</p>
              <p className="text-on-surface-variant text-xs">Atualize para ter as últimas melhorias</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setShow(false)}
                className="text-on-surface-variant text-xs px-2 py-1.5 rounded-lg transition-colors"
                style={{ background: 'var(--clr-surface-ctn)' }}
              >
                Depois
              </button>
              <button
                onClick={applyUpdate}
                className="bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90"
              >
                Atualizar
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
