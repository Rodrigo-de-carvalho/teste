import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50"
        >
          <div className="rounded-2xl p-4 shadow-float border flex items-center gap-3"
               style={{ background: 'var(--clr-white-card)', borderColor: 'var(--clr-outline-var)' }}>
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-primary-glow flex-shrink-0">
              <span className="material-symbols-outlined text-white text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-on-surface text-sm">Instalar o Forje</p>
              <p className="text-on-surface-variant text-xs">Adicionar à tela inicial</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setShow(false)}
                className="text-on-surface-variant text-xs px-2 py-1 rounded-lg transition-colors"
                style={{ background: 'var(--clr-surface-ctn)' }}>
                Agora não
              </button>
              <button onClick={handleInstall}
                className="bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity">
                Instalar
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
