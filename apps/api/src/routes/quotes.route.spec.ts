import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { registerQuotesRoute } from './quotes.route'

describe('GET /api/quotes/:filename', () => {
  it('returns 404 for a non-existent file', async () => {
    const app = Fastify()
    registerQuotesRoute(app)

    const response = await app.inject({ method: 'GET', url: '/api/quotes/nincs-ilyen.xlsx' })

    expect(response.statusCode).toBe(404)
  })

  it('strips path segments from the filename to prevent path traversal', async () => {
    const app = Fastify()
    registerQuotesRoute(app)

    const response = await app.inject({ method: 'GET', url: '/api/quotes/..%2F..%2Fpackage.json' })

    expect(response.statusCode).toBe(404)
  })
})
