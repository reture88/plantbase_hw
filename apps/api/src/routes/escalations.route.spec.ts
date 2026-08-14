import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiEnv } from '../config/env'

const listOpenEscalationsMock = vi.fn()
const resolveEscalationMock = vi.fn()

vi.mock('@plantbase/core', () => ({
  listOpenEscalations: listOpenEscalationsMock,
  resolveEscalation: resolveEscalationMock,
}))

const { registerInternalEscalationsRoute } = await import('./escalations.route')

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

beforeEach(() => {
  listOpenEscalationsMock.mockReset()
  resolveEscalationMock.mockReset()
})

function buildApp() {
  const app = Fastify()
  const escalationPool = {} as never
  registerInternalEscalationsRoute(app, env, escalationPool)
  return app
}

describe('belső eszkalációs végpontok', () => {
  it('GET /api/internal/escalations 401-et ad hiányzó/rossz token esetén', async () => {
    const app = buildApp()

    const noToken = await app.inject({ method: 'GET', url: '/api/internal/escalations' })
    expect(noToken.statusCode).toBe(401)

    const wrongToken = await app.inject({ method: 'GET', url: '/api/internal/escalations', headers: { authorization: 'Bearer rossz' } })
    expect(wrongToken.statusCode).toBe(401)
    expect(listOpenEscalationsMock).not.toHaveBeenCalled()
  })

  it('GET /api/internal/escalations helyes token esetén visszaadja a nyitott eseteket', async () => {
    listOpenEscalationsMock.mockResolvedValueOnce([{ id: 1, question: 'q', status: 'open' }])
    const app = buildApp()

    const response = await app.inject({ method: 'GET', url: '/api/internal/escalations', headers: { authorization: 'Bearer test-token' } })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ escalations: [{ id: 1, question: 'q', status: 'open' }] })
  })

  it('POST /api/internal/escalations/:id/resolve 401-et ad rossz token esetén', async () => {
    const app = buildApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/internal/escalations/1/resolve',
      payload: { reply: 'válasz' },
    })
    expect(response.statusCode).toBe(401)
    expect(resolveEscalationMock).not.toHaveBeenCalled()
  })

  it('POST /api/internal/escalations/:id/resolve feloldja az esetet helyes tokennel', async () => {
    resolveEscalationMock.mockResolvedValueOnce({ id: 1, status: 'resolved', reply: 'válasz' })
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/internal/escalations/1/resolve',
      headers: { authorization: 'Bearer test-token' },
      payload: { reply: 'válasz' },
    })

    expect(response.statusCode).toBe(200)
    expect(resolveEscalationMock).toHaveBeenCalledWith({}, 1, 'válasz')
  })

  it('POST /api/internal/escalations/:id/resolve 404-et ad, ha az eset nem létezik', async () => {
    resolveEscalationMock.mockResolvedValueOnce(null)
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/internal/escalations/999/resolve',
      headers: { authorization: 'Bearer test-token' },
      payload: { reply: 'válasz' },
    })

    expect(response.statusCode).toBe(404)
  })
})
