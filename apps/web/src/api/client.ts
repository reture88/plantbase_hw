export type AskDone = {
  quoteUrl?: string
}

export type RagDone = {
  answer: string
  grounded: boolean
  sources: { title: string; source: string }[]
}

type SseEvent = { type: 'text-delta'; text: string } | { type: 'error'; message: string } | ({ type: 'done' } & Record<string, unknown>)

async function streamSse<TDone>(url: string, body: unknown, onDelta: (text: string) => void): Promise<TDone> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
  let doneEvent: TDone | undefined

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
        onDelta(event.text)
      } else if (event.type === 'error') {
        throw new Error(event.message)
      } else if (event.type === 'done') {
        doneEvent = event as TDone
      }
    }
  }

  if (!doneEvent) {
    throw new Error('A szerver váratlanul lezárta a kapcsolatot.')
  }
  return doneEvent
}

export function askCatalog(question: string, onDelta: (text: string) => void): Promise<AskDone> {
  return streamSse<AskDone>('/api/ask', { question }, onDelta)
}

export function askKnowledgeBase(question: string, onDelta: (text: string) => void): Promise<RagDone> {
  return streamSse<RagDone>('/api/rag/chat', { question }, onDelta)
}
