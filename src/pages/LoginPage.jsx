import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { api, isAuthenticated } from '../lib/api'
import useStore from '../store/useStore'

export default function LoginPage() {
  const { darkMode, toggleDarkMode } = useStore()

  useEffect(() => {
    if (isAuthenticated()) {
      useStore.getState().setPage('dashboard')
    }
  }, [])

  function handleGoogleLogin() {
    window.location.href = api.auth.googleUrl()
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 relative overflow-hidden"
         style={{ background: 'var(--clr-bg)' }}>

      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Dark mode toggle */}
      <button
        onClick={toggleDarkMode}
        className="absolute top-6 right-6 w-10 h-10 rounded-xl flex items-center justify-center text-on-surface-variant transition-all hover:bg-secondary-container"
      >
        <motion.span
          key={darkMode ? 'sun' : 'moon'}
          initial={{ rotate: -30, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          className="material-symbols-outlined text-[20px]"
          style={darkMode ? { fontVariationSettings: "'FILL' 1" } : {}}
        >
          {darkMode ? 'light_mode' : 'dark_mode'}
        </motion.span>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', damping: 18, stiffness: 300 }}
            className="w-20 h-20 bg-primary rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-primary-glow"
          >
            <span className="material-symbols-outlined text-white text-[36px]"
              style={{ fontVariationSettings: "'FILL' 1" }}>
              bolt
            </span>
          </motion.div>
          <h1 className="font-display font-bold text-on-surface text-4xl tracking-tighter mb-2">
            Forge
          </h1>
          <p className="text-on-surface-variant text-base">
            Forje seu dia com intenção.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-float border"
             style={{ background: 'var(--clr-white-card)', borderColor: 'var(--clr-outline-var)' }}>
          <h2 className="font-display font-semibold text-on-surface text-xl mb-2">
            Bem-vindo de volta
          </h2>
          <p className="text-on-surface-variant text-sm mb-8">
            Entre para sincronizar suas tarefas em todos os dispositivos.
          </p>

          {/* Google Button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl
                       border font-body font-medium text-on-surface transition-all duration-200
                       hover:shadow-card-hover hover:-translate-y-0.5 active:scale-95"
            style={{ borderColor: 'var(--clr-outline-var)', background: 'var(--clr-surface-low)' }}
          >
            {/* Google logo SVG */}
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span>Continuar com Google</span>
          </button>

          <p className="text-on-surface-variant/60 text-xs text-center mt-6">
            Ao entrar, você concorda em usar o Forge com responsabilidade. 🔥
          </p>
        </div>

        {/* Features list */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: 'sync', label: 'Sync em tempo real' },
            { icon: 'devices',   label: 'Multi-dispositivo' },
            { icon: 'lock',      label: 'Seus dados seguros' },
          ].map(({ icon, label }) => (
            <div key={label} className="text-center">
              <span className="material-symbols-outlined text-primary/70 text-[18px] block mb-1">{icon}</span>
              <p className="text-on-surface-variant/60 text-[10px] font-label">{label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
