import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiEnv } from '../config/env'

const streamUnifiedChatMock = vi.fn()
const saveGeneratedDocumentMock = vi.fn()

vi.mock('@plantbase/core', () => ({
  streamUnifiedChat: streamUnifiedChatMock,
  saveGeneratedDocument: saveGeneratedDocumentMock,
  EMBEDDING_MODEL_ID: 'text-embedding-3-small',
  HELPER_MODEL_ID: 'gpt-5.4-mini',
}))

const { registerChatRoute } = await import('./chat.route')

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
  streamUnifiedChatMock.mockReset()
  saveGeneratedDocumentMock.mockReset()
})

function buildApp() {
  const app = Fastify()
  const logger = { filePath: 'fake.jsonl', append: vi.fn() }
  const ragLogger = { filePath: 'fake-rag.jsonl', append: vi.fn() }
  const pool = {} as never
  registerChatRoute(app, env, pool, logger, ragLogger)
  return app
}

describe('POST /api/chat', () => {
  it('returns 400 when the question is missing', async () => {
    const app = buildApp()
    const response = await app.inject({ method: 'POST', url: '/api/chat', payload: {} })

    expect(response.statusCode).toBe(400)
    expect(streamUnifiedChatMock).not.toHaveBeenCalled()
  })

  it('streams catalog events and saves an xlsx document when exported', async () => {
    streamUnifiedChatMock.mockResolvedValueOnce({
      events: events({ type: 'text-delta', text: 'Van ' }, { type: 'text-delta', text: 'kaktuszunk.' }),
      result: Promise.resolve({ answer: 'Van kaktuszunk.', source: 'catalog', wantsFileExport: true }),
    })
    saveGeneratedDocumentMock.mockResolvedValueOnce({ filename: 'arajanlat.xlsx', filePath: 'quotes/arajanlat.xlsx' })
    const app = buildApp()

    const response = await app.inject({ method: 'POST', url: '/api/chat', payload: { question: 'Van kaktuszotok, mentsd ki fájlba?' } })
    const parsed = parseSseEvents(response.body)

    expect(parsed.slice(0, 2)).toEqual([
      { type: 'text-delta', text: 'Van ' },
      { type: 'text-delta', text: 'kaktuszunk.' },
    ])
    expect(parsed.at(-1)).toEqual({
      type: 'done',
      source: 'catalog',
      sources: undefined,
      fileUrl: '/api/quotes/arajanlat.xlsx',
      fileFormat: 'xlsx',
    })
    expect(saveGeneratedDocumentMock).toHaveBeenCalledWith('Van kaktuszunk.', 'xlsx', true, { apiKey: 'test-key', model: 'claude-test' })
  })

  it('streams knowledge_base/web_search events and saves a pdf document when exported', async () => {
    streamUnifiedChatMock.mockResolvedValueOnce({
      events: events(
        { type: 'notice', text: 'A tudásbázis alapján nem találtam választ…' },
        { type: 'text-delta', text: 'Válasz a webről.' },
      ),
      result: Promise.resolve({ answer: 'Válasz a webről.', source: 'web_search', wantsFileExport: true }),
    })
    saveGeneratedDocumentMock.mockResolvedValueOnce({ filename: 'valasz.pdf', filePath: 'quotes/valasz.pdf' })
    const app = buildApp()

    const response = await app.inject({ method: 'POST', url: '/api/chat', payload: { question: 'Mekkora a Mars átmérője, mentsd ki?' } })
    const parsed = parseSseEvents(response.body)

    expect(parsed[0]).toEqual({ type: 'notice', text: 'A tudásbázis alapján nem találtam választ…' })
    expect(parsed.at(-1)).toEqual({
      type: 'done',
      source: 'web_search',
      sources: undefined,
      fileUrl: '/api/quotes/valasz.pdf',
      fileFormat: 'pdf',
    })
    expect(saveGeneratedDocumentMock).toHaveBeenCalledWith('Válasz a webről.', 'pdf', true, { apiKey: 'test-key', model: 'claude-test' })
  })

  it('omits fileUrl/fileFormat when no export was requested', async () => {
    streamUnifiedChatMock.mockResolvedValueOnce({
      events: events({ type: 'text-delta', text: 'ok' }),
      result: Promise.resolve({ answer: 'ok', source: 'knowledge_base', wantsFileExport: false, sources: [{ title: 'X', source: 'https://x' }] }),
    })
    saveGeneratedDocumentMock.mockResolvedValueOnce(undefined)
    const app = buildApp()

    const response = await app.inject({ method: 'POST', url: '/api/chat', payload: { question: 'Milyen gyakran öntözzem az aloe verát?' } })
    const parsed = parseSseEvents(response.body)

    expect(parsed.at(-1)).toEqual({
      type: 'done',
      source: 'knowledge_base',
      sources: [{ title: 'X', source: 'https://x' }],
      fileUrl: undefined,
      fileFormat: undefined,
    })
  })
})
