import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function LgpdBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('forje_lgpd_consent')
    if (!consent) setShow(true)
  }, [])

  function accept() {
    localStorage.setItem('forje_lgpd_consent', 'true')
    setShow(false)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4"
        >
          <div className="max-w-2xl mx-auto rounded-2xl p-5 shadow-float border flex flex-col sm:flex-row items-start sm:items-center gap-4"
               style={{ background: 'var(--clr-white-card)', borderColor: 'var(--clr-outline-var)' }}>
            <div className="flex items-start gap-3 flex-1">
              <span className="material-symbols-outlined text-primary text-[22px] flex-shrink-0 mt-0.5"
                style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
              <div>
                <p className="font-semibold text-on-surface text-sm mb-0.5">Privacidade e Cookies</p>
                <p className="text-on-surface-variant text-xs leading-relaxed">
                  O Forje usa cookies essenciais para autenticação e armazena suas tarefas de forma segura.
                  Nenhum dado é compartilhado com terceiros. Em conformidade com a{' '}
                  <strong>LGPD (Lei nº 13.709/2018)</strong>.
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={accept}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                Entendi e aceito
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
