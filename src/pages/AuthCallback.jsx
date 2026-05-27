// Página que recebe o token após o login Google e redireciona para o app
import { useEffect } from 'react'
import { saveToken } from '../lib/api'
import useStore from '../store/useStore'

export default function AuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token  = params.get('token')
    const error  = params.get('error')

    if (error || !token) {
      useStore.getState().setPage('login')
      return
    }

    saveToken(token)
    // Carrega dados do usuário e vai para o dashboard
    useStore.getState().loadUserFromApi().then(() => {
      useStore.getState().setPage('dashboard')
    })
  }, [])

  return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--clr-bg)' }}>
      <div className="text-center">
        <div className="w-16 h-16 bg-primary rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-primary-glow animate-pulse">
          <span className="material-symbols-outlined text-white text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            bolt
          </span>
        </div>
        <p className="font-display font-semibold text-on-surface text-lg">Entrando no Forge...</p>
        <p className="text-on-surface-variant text-sm mt-1">Aguarde um instante</p>
      </div>
    </div>
  )
}
