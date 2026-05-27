// Supabase redireciona aqui após o login Google
// O SDK detecta automaticamente o token na URL e cria a sessão
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

export default function AuthCallback() {
  const { loadAll, setPage } = useStore()

  useEffect(() => {
    async function handle() {
      // Supabase troca o código por uma sessão (PKCE flow)
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        // Tenta o exchangeCodeForSession se vier como ?code= na URL
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        if (code) {
          const { data, error: err2 } = await supabase.auth.exchangeCodeForSession(code)
          if (!err2 && data.session) {
            await loadAll(data.session)
            window.history.replaceState({}, '', '/')
            return
          }
        }
        setPage('login')
        return
      }

      await loadAll(session)
      window.history.replaceState({}, '', '/')
    }

    handle()
  }, [])

  return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--clr-bg)' }}>
      <div className="text-center">
        <div className="w-16 h-16 bg-primary rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-primary-glow animate-pulse">
          <span className="material-symbols-outlined text-white text-[28px]"
            style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
        </div>
        <p className="font-display font-semibold text-on-surface text-lg">Entrando no Forje...</p>
        <p className="text-on-surface-variant text-sm mt-1">Aguarde um instante ✨</p>
      </div>
    </div>
  )
}
