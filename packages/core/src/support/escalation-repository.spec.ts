import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { createEscalation, getEscalation, listOpenEscalations, resolveEscalation } from './escalation-repository'

function fakePool(queryImpl: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>): Pool {
  return { query: vi.fn(queryImpl) } as unknown as Pool
}

const now = new Date('2026-08-14T12:00:00Z')

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    question: 'Mérgező-e a filodendron a macskámnak?',
    contextSnapshot: 'nincs releváns chunk a tudásbázisban',
    reason: 'nem grounded',
    status: 'open',
    reply: null,
    createdAt: now,
    resolvedAt: null,
    ...overrides,
  }
}

describe('escalation-repository', () => {
  it('creates an escalation and returns the inserted record', async () => {
    const pool = fakePool(async (sql) => {
      expect(sql).toContain('INSERT INTO escalations')
      return { rows: [row()] }
    })

    const result = await createEscalation(pool, {
      question: 'Mérgező-e a filodendron a macskámnak?',
      contextSnapshot: 'nincs releváns chunk a tudásbázisban',
      reason: 'nem grounded',
    })

    expect(result).toEqual({
      id: 1,
      question: 'Mérgező-e a filodendron a macskámnak?',
      contextSnapshot: 'nincs releváns chunk a tudásbázisban',
      reason: 'nem grounded',
      status: 'open',
      reply: null,
      createdAt: now,
      resolvedAt: null,
    })
  })

  it('lists only open escalations, oldest first', async () => {
    const pool = fakePool(async (sql) => {
      expect(sql).toContain("WHERE status = 'open'")
      expect(sql).toContain('ORDER BY "createdAt" ASC')
      return { rows: [row({ id: 1 }), row({ id: 2 })] }
    })

    const result = await listOpenEscalations(pool)

    expect(result.map((r) => r.id)).toEqual([1, 2])
    expect(result.every((r) => r.status === 'open')).toBe(true)
  })

  it('returns a single escalation by id, or null when not found', async () => {
    const foundPool = fakePool(async () => ({ rows: [row({ id: 5 })] }))
    expect((await getEscalation(foundPool, 5))?.id).toBe(5)

    const missingPool = fakePool(async () => ({ rows: [] }))
    expect(await getEscalation(missingPool, 999)).toBeNull()
  })

  it('resolves an escalation with a reply and marks it resolved', async () => {
    const pool = fakePool(async (sql, params) => {
      expect(sql).toContain("SET status = 'resolved'")
      expect(params).toEqual([1, 'A filodendron enyhén mérgező a macskákra, tartsd elzárva.'])
      return {
        rows: [
          row({
            status: 'resolved',
            reply: 'A filodendron enyhén mérgező a macskákra, tartsd elzárva.',
            resolvedAt: now,
          }),
        ],
      }
    })

    const result = await resolveEscalation(pool, 1, 'A filodendron enyhén mérgező a macskákra, tartsd elzárva.')

    expect(result?.status).toBe('resolved')
    expect(result?.reply).toBe('A filodendron enyhén mérgező a macskákra, tartsd elzárva.')
    expect(result?.resolvedAt).toEqual(now)
  })

  it('returns null when resolving a non-existent escalation', async () => {
    const pool = fakePool(async () => ({ rows: [] }))
    expect(await resolveEscalation(pool, 999, 'válasz')).toBeNull()
  })
})
