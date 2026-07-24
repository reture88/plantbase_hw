import { useState, type FormEvent } from 'react'
import type { ChatDone, ChatSource } from '../api/client'

export type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
  notice?: string
  source?: ChatSource
  sources?: { title: string; source: string }[]
  fileUrl?: string
  fileFormat?: 'xlsx' | 'pdf'
}

const SOURCE_BADGE: Record<ChatSource, string | null> = {
  catalog: null,
  knowledge_base: '📚 tudásbázis',
  web_search: '🌐 internetes keresés (a tudásbázis nem tudott válaszolni)',
}

const FILE_LABEL: Record<'xlsx' | 'pdf', string> = {
  xlsx: '📄 Excel letöltése',
  pdf: '📕 PDF letöltése',
}

type ChatPanelProps = {
  placeholder: string
  emptyStateText: string
  onSend: (question: string, onDelta: (text: string) => void, onNotice: (text: string) => void) => Promise<ChatDone>
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

  function setNoticeOnLastMessage(notice: string) {
    setMessages((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      next[next.length - 1] = { ...last, notice }
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
      const done = await onSend(question, appendDeltaToLastMessage, setNoticeOnLastMessage)
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        next[next.length - 1] = { ...last, source: done.source, sources: done.sources, fileUrl: done.fileUrl, fileFormat: done.fileFormat }
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
            {message.role === 'assistant' && message.source && SOURCE_BADGE[message.source] && (
              <span className="chat-source-badge">{SOURCE_BADGE[message.source]}</span>
            )}
            {message.notice && <p className="chat-notice">⚠️ {message.notice}</p>}
            {message.text === '' && isLoading && index === messages.length - 1 ? <p className="chat-pending">…</p> : <p>{message.text}</p>}
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
