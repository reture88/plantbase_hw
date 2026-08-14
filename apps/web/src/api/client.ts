export type ChatSource = 'catalog' | 'knowledge_base' | 'web_search' | 'escalated'

export type ChatDone = {
  source: ChatSource
  sources?: { title: string; source: string }[]
  fileUrl?: string
  fileFormat?: 'xlsx' | 'pdf'
  /** Opaque token a GET /api/customer/escalations/:token pollozásához — SOSEM a sorszámozott id. */
  escalationToken?: string
}

export type ChatCallbacks = {
  onDelta: (text: string) => void
  onNotice: (text: string) => void
}

type SseEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'notice'; text: string }
  | { type: 'escalated'; escalationToken: string }
  | { type: 'error'; message: string }
  | ({ type: 'done' } & ChatDone)

async function streamChatSse(endpoint: string, question: string, callbacks: ChatCallbacks): Promise<ChatDone> {
  const response = await fetch(endpoint, {
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
      } else if (event.type === 'escalated') {
        // Nincs külön kezelés itt — a `done` esemény úgyis hozza az escalationTokent.
      } else if (event.type === 'error') {
        throw new Error(event.message)
      } else if (event.type === 'done') {
        doneEvent = {
          source: event.source,
          sources: event.sources,
          fileUrl: event.fileUrl,
          fileFormat: event.fileFormat,
          escalationToken: event.escalationToken,
        }
      }
    }
  }

  if (!doneEvent) {
    throw new Error('A szerver váratlanul lezárta a kapcsolatot.')
  }
  return doneEvent
}

export function askUnified(question: string, callbacks: ChatCallbacks): Promise<ChatDone> {
  return streamChatSse('/api/chat', question, callbacks)
}

export function askCustomer(question: string, callbacks: ChatCallbacks): Promise<ChatDone> {
  return streamChatSse('/api/customer/chat', question, callbacks)
}

export type EscalationStatus = { status: 'open' | 'resolved'; reply: string | null }

export async function pollEscalation(escalationToken: string): Promise<EscalationStatus> {
  const response = await fetch(`/api/customer/escalations/${encodeURIComponent(escalationToken)}`)
  if (!response.ok) {
    throw new Error(`Nem sikerült lekérdezni az eszkaláció státuszát (HTTP ${response.status}).`)
  }
  return (await response.json()) as EscalationStatus
}

export type OpenEscalation = {
  id: number
  question: string
  contextSnapshot: string
  reason: string
  createdAt: string
}

async function internalFetch(path: string, internalToken: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${internalToken}` },
  })
  if (response.status === 401) {
    throw new Error('Érvénytelen belső token.')
  }
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(errorBody.error ?? `A szerver hibát adott vissza (HTTP ${response.status}).`)
  }
  return response
}

export async function fetchOpenEscalations(internalToken: string): Promise<OpenEscalation[]> {
  const response = await internalFetch('/api/internal/escalations', internalToken)
  const body = (await response.json()) as { escalations: OpenEscalation[] }
  return body.escalations
}

export async function resolveEscalationApi(internalToken: string, escalationId: number, reply: string): Promise<void> {
  await internalFetch(`/api/internal/escalations/${escalationId}/resolve`, internalToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply }),
  })
}
