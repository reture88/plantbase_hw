import { askUnified } from './api/client'
import { ChatPanel } from './components/ChatPanel'

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>🌱 Plantbase</h1>
      </header>

      <main className="app-main">
        <ChatPanel
          placeholder="Pl.: Milyen kaktuszok vannak 5000 Ft alatt? / Milyen gyakran öntözzem az aloe verát?"
          emptyStateText="Kérdezz bármit — ha termékadatról (ár, készlet, kategória) van szó, a katalógusból válaszolok; ha egyéb növényápolási témáról, a tudásbázisunkat használom. Ha a tudásbázis nem tud választ adni, ezt jelzem, és internetes kereséssel próbálkozom."
          onSend={(question, onDelta, onNotice) => askUnified(question, { onDelta, onNotice })}
        />
      </main>
    </div>
  )
}
