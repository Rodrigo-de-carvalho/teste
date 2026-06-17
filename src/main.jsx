import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import useStore from './store/useStore.js'

// Aplica o tema salvo antes do primeiro render (evita flash)
useStore.getState().initTheme()

if (import.meta.env.DEV) {
  console.log('%c✅ Forje (dev)', 'color:#6b38d4;font-weight:bold;font-size:14px')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
