import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useStore from '../../store/useStore'

// Toast genérico de feedback de salvamento. Reaproveitável para erros
// ("Não foi possível salvar...") e avisos ("salvo localmente...").
// kind: 'error' (vermelho) | 'info' (neutro).
export default function ErrorToast() {
  const { errorToast, clearErrorToast } = useStore()

  useEffect(() => {
    if (!errorToast) return
    // Erros ficam mais tempo na tela; avisos saem mais rápido.
    const ms = errorToast.kind === 'info' ? 3500 : 5000
    const t = setTimeout(clearErrorToast, ms)
    return () => clearTimeout(t)
  }, [errorToast, clearErrorToast])

  const isError = errorToast?.kind !== 'info'

  return (
    <AnimatePresence>
      {errorToast && (
        <motion.div
          key={errorToast.key}
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          role="alert"
          onClick={clearErrorToast}
          className={`fixed bottom-28 md:bottom-10 left-1/2 -translate-x-1/2 z-[120]
                     max-w-[90vw] cursor-pointer rounded-xl px-5 py-3
                     flex items-center gap-3 shadow-float
                     ${isError ? 'bg-error text-on-error' : 'bg-inverse-surface text-inverse-on-surface'}`}
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {isError ? 'error' : 'cloud_off'}
          </span>
          <p className="font-label font-medium text-sm">{errorToast.message}</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
