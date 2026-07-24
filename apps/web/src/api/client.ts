export type ChatSource = 'catalog' | 'knowledge_base' | 'web_search'

export type ChatDone = {
  source: ChatSource
  sources?: { title: string; source: string }[]
  fileUrl?: string
  fileFormat?: 'xlsx' | 'pdf'
}

export type ChatCallbacks = {
  onDelta: (text: string) => void
  onNotice: (text: string) => void
}

type SseEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'notice'; text: string }
  | { type: 'error'; message: string }
  | ({ type: 'done' } & ChatDone)

async function streamChatSse(question: string, callbacks: ChatCallbacks): Promise<ChatDone> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(errorBody.error ?? `A szerver hibát adott vissza (HTTP ${response.status}).`)
  }
  if (!response.body) {
    throw new Error('A szerver nem adott vissza streamelhető választ.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let doneEvent: ChatDone | undefined

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let separatorIndex: number
    while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)
      if (!rawEvent.startsWith('data: ')) continue

      const event = JSON.parse(rawEvent.slice('data: '.length)) as SseEvent
      if (event.type === 'text-delta') {
        callbacks.onDelta(event.text)
      } else if (event.type === 'notice') {
        callbacks.onNotice(event.text)
      } else if (event.type === 'error') {
        throw new Error(event.message)
      } else if (event.type === 'done') {
        doneEvent = { source: event.source, sources: event.sources, fileUrl: event.fileUrl, fileFormat: event.fileFormat }
      }
    }
  }

  if (!doneEvent) {
    throw new Error('A szerver váratlanul lezárta a kapcsolatot.')
  }
  return doneEvent
}

export function askUnified(question: string, callbacks: ChatCallbacks): Promise<ChatDone> {
  return streamChatSse(question, callbacks)
}
