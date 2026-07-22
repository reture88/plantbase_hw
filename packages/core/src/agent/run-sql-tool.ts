import { tool, type Tool } from 'ai'
import type { Pool } from 'pg'
import { z } from 'zod'
import { assertSelectOnly, enforceLimit } from '../db/sql-guard'
import type { ToolCallLogEntry } from '../logging/jsonl-logger'

export const RUN_SQL_TOOL_NAME = 'runSql'

const TOOL_RESULT_SAMPLE_SIZE = 5

export type RunSqlResult = {
  rows: Record<string, unknown>[]
  rowCount: number
}

/**
 * A `logSink`-be írja a saját naplóbejegyzését (pontos időzítéssel), mert az
 * AI SDK tool-loopja a mi kódunk felett fut — nincs központi hely az
 * ask-agent.ts-ben, ahonnan ezt utólag, azonos pontossággal rekonstruálhatnánk.
 */
export function createRunSqlTool(pool: Pool, logSink: ToolCallLogEntry[]): Tool<{ query: string }, RunSqlResult> {
  return tool({
    description:
      'Read-only SQL SELECT lekérdezés futtatása a products katalógus táblán. Csak SELECT (vagy WITH ... SELECT) engedélyezett; írás minden formában tilos.',
    inputSchema: z.object({
      query: z.string().min(1, 'A query mező nem lehet üres.').describe('A futtatandó, kizárólag SELECT SQL lekérdezés a products táblán.'),
    }),
    execute: async ({ query }): Promise<RunSqlResult> => {
      const startedAt = Date.now()
      try {
        assertSelectOnly(query)
        const limitedQuery = enforceLimit(query)
        const result = await pool.query(limitedQuery)
        const output: RunSqlResult = { rows: result.rows, rowCount: result.rowCount ?? result.rows.length }

        logSink.push({
          tool: RUN_SQL_TOOL_NAME,
          input: { query },
          resultRowCount: output.rowCount,
          resultSample: output.rows.slice(0, TOOL_RESULT_SAMPLE_SIZE),
          durationMs: Date.now() - startedAt,
        })
        return output
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ismeretlen hiba.'
        logSink.push({
          tool: RUN_SQL_TOOL_NAME,
          input: { query },
          durationMs: Date.now() - startedAt,
          error: errorMessage,
        })
        throw error
      }
    },
  })
}
