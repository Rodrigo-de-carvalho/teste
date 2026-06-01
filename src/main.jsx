import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import useStore from './store/useStore.js'

// Aplica o tema salvo antes do primeiro render (evita flash)
useStore.getState().initTheme()

console.log('%c✅ Forje v1.3.0 carregado', 'color:#6b38d4;font-weight:bold;font-size:14px')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
