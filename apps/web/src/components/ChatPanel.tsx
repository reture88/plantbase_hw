import { useState, type FormEvent } from 'react'

export type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
  quoteUrl?: string
  grounded?: boolean
  sources?: { title: string; source: string }[]
}

export type ChatReply = {
  answer: string
  quoteUrl?: string
  grounded?: boolean
  sources?: { title: string; source: string }[]
}

type ChatPanelProps = {
  placeholder: string
  emptyStateText: string
  onSend: (question: string) => Promise<ChatReply>
}

export function ChatPanel({ placeholder, emptyStateText, onSend }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const question = input.trim()
    if (!question || isLoading) return

    setMessages((prev) => [...prev, { role: 'user', text: question }])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const reply = await onSend(question)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: reply.answer, quoteUrl: reply.quoteUrl, grounded: reply.grounded, sources: reply.sources },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt.')
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
            <p>{message.text}</p>
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
        {isLoading && <div className="chat-bubble chat-bubble--assistant chat-bubble--pending">…</div>}
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
