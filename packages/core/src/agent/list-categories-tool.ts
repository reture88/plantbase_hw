import { tool, type Tool } from 'ai'
import type { Pool } from 'pg'
import { z } from 'zod'
import type { ToolCallLogEntry } from '../logging/jsonl-logger'

export const LIST_CATEGORIES_TOOL_NAME = 'listCategories'

export type ListCategoriesResult = {
  categories: string[]
}

export function createListCategoriesTool(
  pool: Pool,
  logSink: ToolCallLogEntry[],
): Tool<Record<string, never>, ListCategoriesResult> {
  return tool({
    description:
      'Az elérhető növény-kategóriák listázása a products táblán (SELECT DISTINCT category). Használd, ha bizonytalan vagy a pontos kategórianévben, vagy a felhasználó a választható kategóriákra kérdez.',
    inputSchema: z.object({}),
    execute: async (): Promise<ListCategoriesResult> => {
      const startedAt = Date.now()
      const result = await pool.query<{ category: string }>('SELECT DISTINCT category FROM products ORDER BY category')
      const output: ListCategoriesResult = { categories: result.rows.map((row) => row.category) }

      logSink.push({
        tool: LIST_CATEGORIES_TOOL_NAME,
        input: {},
        resultRowCount: output.categories.length,
        resultSample: output.categories,
        durationMs: Date.now() - startedAt,
      })
      return output
    },
  })
}
