import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiEnv } from '../config/env'

const askAgentMock = vi.fn()
const saveGeneratedQuoteMock = vi.fn()

vi.mock('@plantbase/core', () => ({
  askAgent: askAgentMock,
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

beforeEach(() => {
  askAgentMock.mockReset()
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
    expect(askAgentMock).not.toHaveBeenCalled()
  })

  it('returns the answer without a quoteUrl when no export was requested', async () => {
    askAgentMock.mockResolvedValueOnce({ answer: 'Van kaktuszunk 3500 Ft-ért.', wantsFileExport: false })
    saveGeneratedQuoteMock.mockResolvedValueOnce(undefined)
    const app = buildApp()

    const response = await app.inject({ method: 'POST', url: '/api/ask', payload: { question: 'Van kaktuszotok?' } })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ answer: 'Van kaktuszunk 3500 Ft-ért.', quoteUrl: undefined })
  })

  it('returns a quoteUrl pointing at the download route when an export was saved', async () => {
    askAgentMock.mockResolvedValueOnce({ answer: 'Íme az árajánlat.', wantsFileExport: true })
    saveGeneratedQuoteMock.mockResolvedValueOnce({ filename: 'arajanlat.xlsx', filePath: 'quotes/arajanlat.xlsx' })
    const app = buildApp()

    const response = await app.inject({ method: 'POST', url: '/api/ask', payload: { question: 'Mentsd ki fájlba!' } })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ answer: 'Íme az árajánlat.', quoteUrl: '/api/quotes/arajanlat.xlsx' })
  })
})
