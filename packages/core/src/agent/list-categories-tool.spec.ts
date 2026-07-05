import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { createListCategoriesHandler } from './list-categories-tool'

function createFakePool(rows: { category: string }[]) {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  } as unknown as Pool
}

describe('createListCategoriesHandler', () => {
  it('should return the distinct categories from the products table', async () => {
    const pool = createFakePool([{ category: 'kaktusz' }, { category: 'pozsgás' }])
    const listCategories = createListCategoriesHandler(pool)

    const result = await listCategories()

    expect(result.categories).toEqual(['kaktusz', 'pozsgás'])
    expect(pool.query).toHaveBeenCalledWith('SELECT DISTINCT category FROM products ORDER BY category')
  })
})
