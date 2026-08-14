import { useRef, useState, type FormEvent } from 'react'
import type { ChatDone, ChatSource } from '../api/client'

export type ChatMessage = {
  id: number
  role: 'user' | 'assistant'
  text: string
  notice?: string
  source?: ChatSource
  sources?: { title: string; source: string }[]
  fileUrl?: string
  fileFormat?: 'xlsx' | 'pdf'
  awaitingEscalation?: boolean
}

const SOURCE_BADGE: Record<ChatSource, string | null> = {
  catalog: null,
  knowledge_base: '📚 tudásbázis',
  web_search: '🌐 internetes keresés (a tudásbázis nem tudott válaszolni)',
  escalated: '🧑‍💼 munkatársunk válaszol',
}

const FILE_LABEL: Record<'xlsx' | 'pdf', string> = {
  xlsx: '📄 Excel letöltése',
  pdf: '📕 PDF letöltése',
}

const ESCALATION_POLL_INTERVAL_MS = 4000

type ChatPanelProps = {
  placeholder: string
  emptyStateText: string
  onSend: (question: string, onDelta: (text: string) => void, onNotice: (text: string) => void) => Promise<ChatDone>
  /**
   * Ha meg van adva, egy eszkalált (`escalationToken`-t kapott) üzenetnél a
   * panel ezt hívja néhány másodpercenként, amíg a válasz fel nem oldódik —
   * ekkor a munkatárs válasza az üzenet szövegeként jelenik meg.
   */
  pollEscalation?: (escalationToken: string) => Promise<{ status: 'open' | 'resolved'; reply: string | null }>
}

export function ChatPanel({ placeholder, emptyStateText, onSend, pollEscalation }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nextMessageId = useRef(0)

  function updateMessage(id: number, patch: Partial<ChatMessage>) {
    setMessages((prev) => prev.map((message) => (message.id === id ? { ...message, ...patch } : message)))
  }

  function appendDelta(id: number, delta: string) {
    setMessages((prev) => prev.map((message) => (message.id === id ? { ...message, text: message.text + delta } : message)))
  }

  function pollEscalationUntilResolved(messageId: number, escalationToken: string) {
    if (!pollEscalation) return
    const interval = setInterval(async () => {
      try {
        const status = await pollEscalation(escalationToken)
        if (status.status === 'resolved') {
          clearInterval(interval)
          updateMessage(messageId, { text: status.reply ?? '', awaitingEscalation: false })
        }
      } catch {
        // Átmeneti hálózati hiba a pollozásnál — a következő körben újrapróbáljuk.
      }
    }, ESCALATION_POLL_INTERVAL_MS)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const question = input.trim()
    if (!question || isLoading) return

    const userMessageId = nextMessageId.current++
    const assistantMessageId = nextMessageId.current++
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: 'user', text: question },
      { id: assistantMessageId, role: 'assistant', text: '' },
    ])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const done = await onSend(
        question,
        (delta) => appendDelta(assistantMessageId, delta),
        (notice) => updateMessage(assistantMessageId, { notice }),
      )
      updateMessage(assistantMessageId, {
        source: done.source,
        sources: done.sources,
        fileUrl: done.fileUrl,
        fileFormat: done.fileFormat,
        awaitingEscalation: done.escalationToken !== undefined,
      })
      if (done.escalationToken !== undefined) {
        pollEscalationUntilResolved(assistantMessageId, done.escalationToken)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt.')
      setMessages((prev) => prev.filter((m) => m.id !== userMessageId && m.id !== assistantMessageId))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 && <p className="chat-empty">{emptyStateText}</p>}
        {messages.map((message, index) => (
          <div key={message.id} className={`chat-bubble chat-bubble--${message.role}`}>
            {message.role === 'assistant' && message.source && SOURCE_BADGE[message.source] && (
              <span className="chat-source-badge">{SOURCE_BADGE[message.source]}</span>
            )}
            {message.notice && <p className="chat-notice">⚠️ {message.notice}</p>}
            {message.text === '' && message.awaitingEscalation ? (
              <p className="chat-pending">⏳ várakozás egy munkatárs válaszára…</p>
            ) : message.text === '' && isLoading && index === messages.length - 1 ? (
              <p className="chat-pending">…</p>
            ) : (
              <p>{message.text}</p>
            )}
            {message.fileUrl && message.fileFormat && (
              <a className="chat-file-link" href={message.fileUrl} download>
                {FILE_LABEL[message.fileFormat]}
              </a>
            )}
            {message.sources && message.sources.length > 0 && (
              <ul className="chat-sources">
                {message.sources.map((source) => (
                  <li key={source.source}>
                    <a href={source.source} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {error && <div className="chat-error">Hiba: {error}</div>}
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || input.trim().length === 0}>
          Küldés
        </button>
      </form>
    </div>
  )
}
