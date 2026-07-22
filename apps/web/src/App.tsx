import { useState } from 'react'
import { askCatalog, askKnowledgeBase } from './api/client'
import { ChatPanel } from './components/ChatPanel'

type Tab = 'catalog' | 'knowledge-base'

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('catalog')

  return (
    <div className="app">
      <header className="app-header">
        <h1>🌱 Plantbase</h1>
        <nav className="app-tabs">
          <button className={activeTab === 'catalog' ? 'active' : ''} onClick={() => setActiveTab('catalog')}>
            Katalógus &amp; árajánlat
          </button>
          <button className={activeTab === 'knowledge-base' ? 'active' : ''} onClick={() => setActiveTab('knowledge-base')}>
            Növényápolási tudásbázis
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'catalog' ? (
          <ChatPanel
            key="catalog"
            placeholder="Pl.: Milyen kaktuszok vannak 5000 Ft alatt?"
            emptyStateText="Kérdezz a növény-katalógusról — árak, készlet, kategóriák. Növény-témájú kérdéseknél a válasz webes kereséssel is kiegészülhet, exportkérésre pedig Excel árajánlatot generálok."
            onSend={askCatalog}
          />
        ) : (
          <ChatPanel
            key="knowledge-base"
            placeholder="Pl.: Milyen gyakran öntözzem az aloe verát?"
            emptyStateText="Kérdezz növényápolási témában — a válasz kizárólag a betöltött tudásbázis cikkein alapul. Ha nincs benne a válasz, ezt egyértelműen jelzem, nem találok ki semmit."
            onSend={askKnowledgeBase}
          />
        )}
      </main>
    </div>
  )
}
