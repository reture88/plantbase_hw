export type AskResponse = {
  answer: string
  quoteUrl?: string
}

export type RagResponse = {
  answer: string
  grounded: boolean
  sources: { title: string; source: string }[]
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(errorBody.error ?? `A szerver hibát adott vissza (HTTP ${response.status}).`)
  }
  return response.json() as Promise<T>
}

export function askCatalog(question: string): Promise<AskResponse> {
  return postJson<AskResponse>('/api/ask', { question })
}

export function askKnowledgeBase(question: string): Promise<RagResponse> {
  return postJson<RagResponse>('/api/rag/chat', { question })
}
