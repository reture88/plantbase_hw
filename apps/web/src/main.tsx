import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { CustomerChatPage } from './pages/CustomerChatPage'
import { InternalEscalationsPage } from './pages/InternalEscalationsPage'
import './styles.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('A #root elem hiányzik az index.html-ből.')
}

/**
 * Nincs router-függőség bekötve (a projekt eddig sem használt egyet) — egy
 * ilyen kis, három-nézetes PoC-nál egy egyszerű útvonal-kapcsoló ugyanazt
 * tudja, extra függőség nélkül. `/customer` = ügyfélirányú chat,
 * `/internal/escalations` = belső eszkalációs sor, minden más = a belső
 * (kolléga) chat (`App.tsx`, változatlan).
 */
function resolvePage() {
  switch (window.location.pathname) {
    case '/customer':
      return <CustomerChatPage />
    case '/internal/escalations':
      return <InternalEscalationsPage />
    default:
      return <App />
  }
}

createRoot(rootElement).render(<StrictMode>{resolvePage()}</StrictMode>)
