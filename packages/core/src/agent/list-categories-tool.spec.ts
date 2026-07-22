import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import type { ToolCallLogEntry } from '../logging/jsonl-logger'
import { createListCategoriesTool } from './list-categories-tool'

function createFakePool(rows: { category: string }[]) {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  } as unknown as Pool
}

const testOptions = { toolCallId: 'test-call', messages: [], context: undefined }

describe('createListCategoriesTool', () => {
  it('should return the distinct categories from the products table', async () => {
    const pool = createFakePool([{ category: 'kaktusz' }, { category: 'pozsgás' }])
    const logSink: ToolCallLogEntry[] = []
    const listCategories = createListCategoriesTool(pool, logSink)

    const result = await listCategories.execute!({}, testOptions)

    expect(result.categories).toEqual(['kaktusz', 'pozsgás'])
    expect(pool.query).toHaveBeenCalledWith('SELECT DISTINCT category FROM products ORDER BY category')
    expect(logSink).toHaveLength(1)
    expect(logSink[0]).toMatchObject({ tool: 'listCategories', resultRowCount: 2 })
  })
})
