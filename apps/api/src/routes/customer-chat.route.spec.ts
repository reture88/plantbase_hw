import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiEnv } from '../config/env'

const streamCustomerChatMock = vi.fn()
const saveGeneratedDocumentMock = vi.fn()
const getEscalationByTokenMock = vi.fn()

vi.mock('@plantbase/core', () => ({
  streamCustomerChat: streamCustomerChatMock,
  saveGeneratedDocument: saveGeneratedDocumentMock,
  getEscalationByToken: getEscalationByTokenMock,
  EMBEDDING_MODEL_ID: 'text-embedding-3-small',
  HELPER_MODEL_ID: 'gpt-5.4-mini',
}))

const { registerCustomerChatRoute } = await import('./customer-chat.route')

const env: ApiEnv = {
  port: 3333,
  corsOrigin: 'http://localhost:5173',
  anthropicApiKey: 'test-key',
  anthropicModel: 'claude-test',
  openaiApiKey: 'test-openai-key',
  databaseUrlReadonly: 'postgres://test',
  databaseUrl: 'postgres://test-write',
  customerChatEnabled: true,
  internalToken: 'test-token',
}

async function* events(...values: unknown[]) {
  for (const value of values) yield value
}

function parseSseEvents(body: string): unknown[] {
  return body
    .split('\n\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice('data: '.length)))
}

beforeEach(() => {
  streamCustomerChatMock.mockReset()
  saveGeneratedDocumentMock.mockReset()
  getEscalationByTokenMock.mockReset()
})

function buildApp() {
  const app = Fastify()
  const logger = { filePath: 'fake.jsonl', append: vi.fn() }
  const ragLogger = { filePath: 'fake-rag.jsonl', append: vi.fn() }
  const pool = {} as never
  const escalationPool = {} as never
  registerCustomerChatRoute(app, env, pool, escalationPool, logger, ragLogger)
  return app
}

describe('POST /api/customer/chat', () => {
  it('returns 400 when the question is missing', async () => {
    const app = buildApp()
    const response = await app.inject({ method: 'POST', url: '/api/customer/chat', payload: {} })

    expect(response.statusCode).toBe(400)
    expect(streamCustomerChatMock).not.toHaveBeenCalled()
  })

  it('returns 400 when the question exceeds the 500-character cap', async () => {
    const app = buildApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/customer/chat',
      payload: { question: 'a'.repeat(501) },
    })

    expect(response.statusCode).toBe(400)
    expect(streamCustomerChatMock).not.toHaveBeenCalled()
  })

  it('streams a grounded knowledge_base answer and saves a pdf document when exported', async () => {
    streamCustomerChatMock.mockResolvedValueOnce({
      events: events({ type: 'text-delta', text: 'Az aloe verát ' }, { type: 'text-delta', text: 'ritkán öntözd.' }),
      result: Promise.resolve({
        answer: 'Az aloe verát ritkán öntözd.',
        source: 'knowledge_base',
        wantsFileExport: true,
        sources: [{ title: 'Aloe', source: 'https://example.com' }],
      }),
    })
    saveGeneratedDocumentMock.mockResolvedValueOnce({ filename: 'gondozas.pdf', filePath: 'quotes/gondozas.pdf' })
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/customer/chat',
      payload: { question: 'Milyen gyakran öntözzem az aloe verát? Mentsd ki PDF-be.' },
    })
    const parsed = parseSseEvents(response.body)

    expect(parsed.at(-1)).toEqual({
      type: 'done',
      source: 'knowledge_base',
      sources: [{ title: 'Aloe', source: 'https://example.com' }],
      escalationToken: undefined,
      fileUrl: '/api/quotes/gondozas.pdf',
      fileFormat: 'pdf',
    })
    expect(saveGeneratedDocumentMock).toHaveBeenCalledWith('Az aloe verát ritkán öntözd.', 'pdf', true, { apiKey: 'test-key', model: 'claude-test' })
  })

  it('streams an escalated answer without ever calling saveGeneratedDocument (no export on escalation)', async () => {
    streamCustomerChatMock.mockResolvedValueOnce({
      events: events(
        { type: 'notice', text: 'egy kollégánk hamarosan válaszol' },
        { type: 'escalated', escalationToken: 'opaque-token-42' },
      ),
      result: Promise.resolve({
        answer: 'egy kollégánk hamarosan válaszol',
        source: 'escalated',
        wantsFileExport: false,
        escalationToken: 'opaque-token-42',
      }),
    })
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/customer/chat',
      payload: { question: 'Mérgező-e a filodendron a macskámnak?' },
    })
    const parsed = parseSseEvents(response.body)

    expect(parsed[0]).toEqual({ type: 'notice', text: 'egy kollégánk hamarosan válaszol' })
    expect(parsed[1]).toEqual({ type: 'escalated', escalationToken: 'opaque-token-42' })
    expect(parsed.at(-1)).toEqual({
      type: 'done',
      source: 'escalated',
      sources: undefined,
      escalationToken: 'opaque-token-42',
      fileUrl: undefined,
      fileFormat: undefined,
    })
    expect(saveGeneratedDocumentMock).not.toHaveBeenCalled()
  })

  it('never offers xlsx export on the customer path, even for a catalog answer', async () => {
    streamCustomerChatMock.mockResolvedValueOnce({
      events: events({ type: 'text-delta', text: 'Van kaktuszunk.' }),
      result: Promise.resolve({ answer: 'Van kaktuszunk.', source: 'catalog', wantsFileExport: true }),
    })
    const app = buildApp()

    const response = await app.inject({ method: 'POST', url: '/api/customer/chat', payload: { question: 'Van kaktuszotok?' } })
    const parsed = parseSseEvents(response.body)

    expect(parsed.at(-1)).toEqual({
      type: 'done',
      source: 'catalog',
      sources: undefined,
      escalationToken: undefined,
      fileUrl: undefined,
      fileFormat: undefined,
    })
    expect(saveGeneratedDocumentMock).not.toHaveBeenCalled()
  })
})

describe('GET /api/customer/escalations/:token', () => {
  it('returns 404 for an unknown/guessed token — no id-enumeration path', async () => {
    getEscalationByTokenMock.mockResolvedValueOnce(null)
    const app = buildApp()

    const response = await app.inject({ method: 'GET', url: '/api/customer/escalations/guessed-token' })

    expect(response.statusCode).toBe(404)
  })

  it('returns only status+reply for a valid token, nothing else about the case', async () => {
    getEscalationByTokenMock.mockResolvedValueOnce({
      id: 42,
      pollToken: 'opaque-token-42',
      question: 'Mérgező-e a filodendron a macskámnak?',
      contextSnapshot: 'x',
      reason: 'nem grounded',
      status: 'resolved',
      reply: 'Igen, enyhén mérgező.',
      createdAt: new Date(),
      resolvedAt: new Date(),
    })
    const app = buildApp()

    const response = await app.inject({ method: 'GET', url: '/api/customer/escalations/opaque-token-42' })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ status: 'resolved', reply: 'Igen, enyhén mérgező.' })
    expect(getEscalationByTokenMock).toHaveBeenCalledWith({}, 'opaque-token-42')
  })
})
