import { Component } from 'react'

// Captura erros de render em qualquer lugar da árvore e mostra uma tela de
// recuperação em vez de uma tela branca.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error('[Forje] erro de render:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-dvh flex items-center justify-center p-6" style={{ background: 'var(--clr-bg)' }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
               style={{ background: 'color-mix(in srgb, var(--clr-primary) 12%, transparent)' }}>
            <span className="material-symbols-outlined text-primary text-[28px]">error</span>
          </div>
          <h1 className="font-display font-bold text-on-surface text-xl mb-2">Algo deu errado</h1>
          <p className="text-on-surface-variant text-sm mb-6">
            Tivemos um problema ao exibir esta tela. Seus dados estão salvos — é só recarregar.
          </p>
          <button onClick={this.handleReload} className="btn-primary mx-auto">
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Recarregar
          </button>
        </div>
      </div>
    )
  }
}
