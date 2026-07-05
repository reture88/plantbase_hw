import { Pool } from 'pg'

/**
 * A runSql tool ezen a poolon fut, a READ-ONLY DB-kapcsolaton
 * (docs/architektura.md 2. pont) — NEM Prismán keresztül.
 */
export function createReadonlyPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    statement_timeout: 5_000,
    max: 5,
  })
}
