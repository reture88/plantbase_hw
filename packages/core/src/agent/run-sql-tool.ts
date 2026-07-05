import type Anthropic from '@anthropic-ai/sdk'
import type { Pool } from 'pg'
import { z } from 'zod'
import { assertSelectOnly, enforceLimit } from '../db/sql-guard'

const RunSqlInputSchema = z.object({
  query: z.string().min(1, 'A query mező nem lehet üres.'),
})

export const RUN_SQL_TOOL_NAME = 'runSql'

export const runSqlToolDefinition: Anthropic.Tool = {
  name: RUN_SQL_TOOL_NAME,
  description:
    'Read-only SQL SELECT lekérdezés futtatása a products katalógus táblán. Csak SELECT (vagy WITH ... SELECT) engedélyezett; írás minden formában tilos.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'A futtatandó, kizárólag SELECT SQL lekérdezés a products táblán.',
      },
    },
    required: ['query'],
  },
}

export type RunSqlResult = {
  rows: Record<string, unknown>[]
  rowCount: number
}

export function createRunSqlHandler(pool: Pool) {
  return async function runSqlHandler(rawInput: unknown): Promise<RunSqlResult> {
    const { query } = RunSqlInputSchema.parse(rawInput)
    assertSelectOnly(query)
    const limitedQuery = enforceLimit(query)

    const result = await pool.query(limitedQuery)
    return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length }
  }
}
