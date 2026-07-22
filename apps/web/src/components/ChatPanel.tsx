import { useState, type FormEvent } from 'react'

export type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
  quoteUrl?: string
  grounded?: boolean
  sources?: { title: string; source: string }[]
}

type ChatDone = {
  quoteUrl?: string
  grounded?: boolean
  sources?: { title: string; source: string }[]
  /** Elutasításnál a textStream üres — ez az egyetlen hely, ahonnan a végleges szöveg jön. */
  answer?: string
}

type ChatPanelProps = {
  placeholder: string
  emptyStateText: string
  onSend: (question: string, onDelta: (text: string) => void) => Promise<ChatDone>
}

export function ChatPanel({ placeholder, emptyStateText, onSend }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function appendDeltaToLastMessage(delta: string) {
    setMessages((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      next[next.length - 1] = { ...last, text: last.text + delta }
      return next
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const question = input.trim()
    if (!question || isLoading) return

    setMessages((prev) => [...prev, { role: 'user', text: question }, { role: 'assistant', text: '' }])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const done = await onSend(question, appendDeltaToLastMessage)
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        next[next.length - 1] = {
          ...last,
          // Elutasításnál sosem jött delta — a `done.answer` adja az egyetlen szöveget.
          text: last.text || done.answer || '',
          quoteUrl: done.quoteUrl,
          grounded: done.grounded,
          sources: done.sources,
        }
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt.')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 && <p className="chat-empty">{emptyStateText}</p>}
        {messages.map((message, index) => (
          <div key={index} className={`chat-bubble chat-bubble--${message.role}`}>
            {message.role === 'assistant' && message.grounded === false && <span className="chat-refusal-badge">nincs a tudásbázisban</span>}
            {message.role === 'assistant' && message.text === '' && isLoading && index === messages.length - 1 ? (
              <p className="chat-bubble--pending">…</p>
            ) : (
              <p>{message.text}</p>
            )}
            {message.quoteUrl && (
              <a className="chat-quote-link" href={message.quoteUrl} download>
                📄 Excel árajánlat letöltése
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
