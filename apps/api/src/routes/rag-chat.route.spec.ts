import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiEnv } from '../config/env'

const streamAskRagMock = vi.fn()

vi.mock('@plantbase/core', () => ({
  streamAskRag: streamAskRagMock,
  createReadonlyPool: vi.fn(() => ({})),
  EMBEDDING_MODEL_ID: 'text-embedding-3-small',
}))

const { registerRagChatRoute } = await import('./rag-chat.route')

const env: ApiEnv = {
  port: 3333,
  corsOrigin: 'http://localhost:5173',
  anthropicApiKey: 'test-key',
  anthropicModel: 'claude-test',
  openaiApiKey: 'test-openai-key',
  databaseUrlReadonly: 'postgres://test',
}

async function* textStream(...chunks: string[]) {
  for (const chunk of chunks) yield chunk
}

function parseSseEvents(body: string): unknown[] {
  return body
    .split('\n\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice('data: '.length)))
}

beforeEach(() => {
  streamAskRagMock.mockReset()
})

function buildApp() {
  const app = Fastify()
  const logger = { filePath: 'fake.jsonl', append: vi.fn() }
  registerRagChatRoute(app, env, logger)
  return app
}

describe('POST /api/rag/chat', () => {
  it('returns 400 when the question is missing', async () => {
    const app = buildApp()
    const response = await app.inject({ method: 'POST', url: '/api/rag/chat', payload: {} })

    expect(response.statusCode).toBe(400)
    expect(streamAskRagMock).not.toHaveBeenCalled()
  })

  it('streams the grounded answer and finishes with sources', async () => {
    streamAskRagMock.mockResolvedValueOnce({
      textStream: textStream('Az aloe vera-t ', 'ritkán kell öntözni.'),
      result: Promise.resolve({
        answer: 'Az aloe vera-t ritkán kell öntözni.',
        grounded: true,
        sources: [{ title: 'Aloe vera gondozása', source: 'https://example.com/aloe' }],
      }),
    })
    const app = buildApp()

    const response = await app.inject({ method: 'POST', url: '/api/rag/chat', payload: { question: 'Milyen gyakran öntözzem az aloe verát?' } })
    const events = parseSseEvents(response.body)

    expect(events).toEqual([
      { type: 'text-delta', text: 'Az aloe vera-t ' },
      { type: 'text-delta', text: 'ritkán kell öntözni.' },
      {
        type: 'done',
        answer: 'Az aloe vera-t ritkán kell öntözni.',
        grounded: true,
        sources: [{ title: 'Aloe vera gondozása', source: 'https://example.com/aloe' }],
      },
    ])
  })

  it('sends no text deltas for a refusal, only the done event carries the refusal message', async () => {
    streamAskRagMock.mockResolvedValueOnce({
      textStream: textStream(),
      result: Promise.resolve({
        answer: 'A növényápolási tudásbázis nem tartalmaz elég információt ehhez a kérdéshez.',
        grounded: false,
        sources: [],
      }),
    })
    const app = buildApp()

    const response = await app.inject({ method: 'POST', url: '/api/rag/chat', payload: { question: 'Mennyi a föld átlagos súlya egy cserépben?' } })
    const events = parseSseEvents(response.body)

    expect(events).toEqual([
      { type: 'done', answer: 'A növényápolási tudásbázis nem tartalmaz elég információt ehhez a kérdéshez.', grounded: false, sources: [] },
    ])
  })
})
