import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function LgpdBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('forje_lgpd_consent')) setShow(true)
  }, [])

  function accept() {
    localStorage.setItem('forje_lgpd_consent', JSON.stringify({ accepted: true, date: new Date().toISOString() }))
    setShow(false)
  }

  return (
    <AnimatePresence>
      {show && (
        // Um único motion.div engloba backdrop + modal para AnimatePresence
        // remover o elemento inteiro ao sair — sem risco de overlay fantasma
        <motion.div
          key="lgpd-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[200] flex items-end justify-center p-4 pb-6"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
          {/* Modal — não propaga o clique para fechar */}
          <motion.div
            initial={{ y: 40, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl p-6 shadow-float border"
            style={{ background: 'var(--clr-white-card)', borderColor: 'var(--clr-outline-var)' }}
          >
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-primary-glow flex-shrink-0">
                <span className="material-symbols-outlined text-white text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
              </div>
              <div>
                <p className="font-display font-bold text-on-surface text-base leading-tight">Privacidade e Termos de Uso</p>
                <p className="text-on-surface-variant text-xs">Forje — Lei nº 13.709/2018 (LGPD)</p>
              </div>
            </div>

            {/* Texto */}
            <div className="space-y-2 mb-5 text-sm text-on-surface-variant leading-relaxed">
              <p>
                Ao usar o <strong className="text-on-surface">Forje</strong>, você concorda com a coleta e uso dos seguintes dados:
              </p>
              <ul className="space-y-1.5 pl-1">
                {[
                  'Nome e e-mail (para identificação da conta)',
                  'Foto de perfil, se usar login com Google',
                  'Tarefas, subtarefas, XP e estatísticas de uso',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-[14px] mt-0.5 flex-shrink-0"
                      style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-on-surface-variant/70 pt-1">
                Nenhum dado é compartilhado com terceiros. Você pode excluir tudo em <strong>Perfil → Excluir minha conta</strong>.
              </p>
            </div>

            {/* Botão obrigatório */}
            <button
              onClick={accept}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-label font-semibold text-sm
                         transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Entendi e aceito os termos de uso
            </button>
            <p className="text-center text-xs text-on-surface-variant/50 mt-3">
              Você precisa aceitar para usar o Forje
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
