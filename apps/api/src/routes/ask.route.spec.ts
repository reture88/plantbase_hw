import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiEnv } from '../config/env'

const streamAskAgentMock = vi.fn()
const saveGeneratedQuoteMock = vi.fn()

vi.mock('@plantbase/core', () => ({
  streamAskAgent: streamAskAgentMock,
  saveGeneratedQuote: saveGeneratedQuoteMock,
}))

const { registerAskRoute } = await import('./ask.route')

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
  streamAskAgentMock.mockReset()
  saveGeneratedQuoteMock.mockReset()
})

function buildApp() {
  const app = Fastify()
  const logger = { filePath: 'fake.jsonl', append: vi.fn() }
  const pool = {} as never
  registerAskRoute(app, env, logger, pool)
  return app
}

describe('POST /api/ask', () => {
  it('returns 400 when the question is missing', async () => {
    const app = buildApp()
    const response = await app.inject({ method: 'POST', url: '/api/ask', payload: {} })

    expect(response.statusCode).toBe(400)
    expect(streamAskAgentMock).not.toHaveBeenCalled()
  })

  it('streams text deltas as SSE and finishes with a done event without a quoteUrl', async () => {
    streamAskAgentMock.mockResolvedValueOnce({
      textStream: textStream('Van ', 'kaktuszunk ', '3500 Ft-ért.'),
      result: Promise.resolve({ answer: 'Van kaktuszunk 3500 Ft-ért.', wantsFileExport: false }),
    })
    saveGeneratedQuoteMock.mockResolvedValueOnce(undefined)
    const app = buildApp()

    const response = await app.inject({ method: 'POST', url: '/api/ask', payload: { question: 'Van kaktuszotok?' } })
    const events = parseSseEvents(response.body)

    expect(events).toEqual([
      { type: 'text-delta', text: 'Van ' },
      { type: 'text-delta', text: 'kaktuszunk ' },
      { type: 'text-delta', text: '3500 Ft-ért.' },
      { type: 'done', quoteUrl: undefined },
    ])
  })

  it('includes a quoteUrl in the done event when an export was saved', async () => {
    streamAskAgentMock.mockResolvedValueOnce({
      textStream: textStream('Íme az árajánlat.'),
      result: Promise.resolve({ answer: 'Íme az árajánlat.', wantsFileExport: true }),
    })
    saveGeneratedQuoteMock.mockResolvedValueOnce({ filename: 'arajanlat.xlsx', filePath: 'quotes/arajanlat.xlsx' })
    const app = buildApp()

    const response = await app.inject({ method: 'POST', url: '/api/ask', payload: { question: 'Mentsd ki fájlba!' } })
    const events = parseSseEvents(response.body)

    expect(events.at(-1)).toEqual({ type: 'done', quoteUrl: '/api/quotes/arajanlat.xlsx' })
  })
})
