import type Anthropic from '@anthropic-ai/sdk'
import type { Pool } from 'pg'

export const LIST_CATEGORIES_TOOL_NAME = 'listCategories'

export const listCategoriesToolDefinition: Anthropic.Tool = {
  name: LIST_CATEGORIES_TOOL_NAME,
  description:
    'Az elérhető növény-kategóriák listázása a products táblán (SELECT DISTINCT category). Használd, ha bizonytalan vagy a pontos kategórianévben, vagy a felhasználó a választható kategóriákra kérdez.',
  input_schema: {
    type: 'object',
    properties: {},
  },
}

export type ListCategoriesResult = {
  categories: string[]
}

export function createListCategoriesHandler(pool: Pool) {
  return async function listCategoriesHandler(): Promise<ListCategoriesResult> {
    const result = await pool.query<{ category: string }>('SELECT DISTINCT category FROM products ORDER BY category')
    return { categories: result.rows.map((row) => row.category) }
  }
}
