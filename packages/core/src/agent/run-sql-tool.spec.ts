import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import type { ToolCallLogEntry } from '../logging/jsonl-logger'
import { createRunSqlTool } from './run-sql-tool'

function createFakePool(rows: Record<string, unknown>[]) {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  } as unknown as Pool
}

const testOptions = { toolCallId: 'test-call', messages: [], context: undefined }

describe('createRunSqlTool', () => {
  it('should run the query and return rows for a valid SELECT', async () => {
    const pool = createFakePool([{ name: 'Aloe vera' }])
    const logSink: ToolCallLogEntry[] = []
    const runSql = createRunSqlTool(pool, logSink)

    const result = await runSql.execute!({ query: 'SELECT name FROM products' }, testOptions)

    expect(result.rows).toEqual([{ name: 'Aloe vera' }])
    expect(result.rowCount).toBe(1)
    expect(pool.query).toHaveBeenCalledWith('SELECT name FROM products LIMIT 50')
    expect(logSink).toHaveLength(1)
    expect(logSink[0]).toMatchObject({ tool: 'runSql', resultRowCount: 1 })
  })

  it('should reject a write attempt before ever calling the pool, and log the error', async () => {
    const pool = createFakePool([])
    const logSink: ToolCallLogEntry[] = []
    const runSql = createRunSqlTool(pool, logSink)

    await expect(runSql.execute!({ query: 'DELETE FROM products' }, testOptions)).rejects.toThrow()

    expect(pool.query).not.toHaveBeenCalled()
    expect(logSink).toHaveLength(1)
    expect(logSink[0].error).toBeDefined()
  })
})
