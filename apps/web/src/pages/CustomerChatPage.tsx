import { askCustomer, pollEscalation } from '../api/client'
import { ChatPanel } from '../components/ChatPanel'

/**
 * Ügyfélirányú belépési pont (`docs/final_hw/`) — az `apps/web` egyik útvonala,
 * nem külön alkalmazás. A belső chattől (`App.tsx`) abban tér el, hogy a
 * `/api/customer/chat`-et hívja: nincs Excel-export, nincs `web_search`
 * fallback (helyette emberi eszkaláció + pollozás a válaszra).
 */
export function CustomerChatPage() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>🌱 Plantbase — kérdezz a növényeidről</h1>
      </header>

      <main className="app-main">
        <ChatPanel
          placeholder="Pl.: Milyen kaktuszok vannak 5000 Ft alatt? / Mérgező-e a filodendron a macskámnak?"
          emptyStateText="Kérdezz bármit a termékeinkről vagy a növényápolásról — ha most nem tudunk biztos választ adni, egy munkatársunk hamarosan jelentkezik."
          onSend={(question, onDelta, onNotice) => askCustomer(question, { onDelta, onNotice })}
          pollEscalation={pollEscalation}
        />
      </main>
    </div>
  )
}
