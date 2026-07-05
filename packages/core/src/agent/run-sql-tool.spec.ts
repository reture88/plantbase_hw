import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { createRunSqlHandler } from './run-sql-tool'

function createFakePool(rows: Record<string, unknown>[]) {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  } as unknown as Pool
}

describe('createRunSqlHandler', () => {
  it('should run the query and return rows for a valid SELECT', async () => {
    const pool = createFakePool([{ name: 'Aloe vera' }])
    const runSql = createRunSqlHandler(pool)

    const result = await runSql({ query: 'SELECT name FROM products' })

    expect(result.rows).toEqual([{ name: 'Aloe vera' }])
    expect(result.rowCount).toBe(1)
    expect(pool.query).toHaveBeenCalledWith('SELECT name FROM products LIMIT 50')
  })

  it('should reject a write attempt before ever calling the pool', async () => {
    const pool = createFakePool([])
    const runSql = createRunSqlHandler(pool)

    await expect(runSql({ query: 'DELETE FROM products' })).rejects.toThrow()
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('should reject an invalid (non-string) input via zod', async () => {
    const pool = createFakePool([])
    const runSql = createRunSqlHandler(pool)

    await expect(runSql({ query: 123 })).rejects.toThrow()
    expect(pool.query).not.toHaveBeenCalled()
  })
})
