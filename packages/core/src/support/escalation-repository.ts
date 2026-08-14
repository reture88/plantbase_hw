import type { Pool } from 'pg'

export type EscalationRecord = {
  id: number
  question: string
  contextSnapshot: string
  reason: string
  status: 'open' | 'resolved'
  reply: string | null
  createdAt: Date
  resolvedAt: Date | null
}

export type EscalationToCreate = {
  question: string
  contextSnapshot: string
  reason: string
}

type EscalationRow = {
  id: number
  question: string
  contextSnapshot: string
  reason: string
  status: string
  reply: string | null
  createdAt: Date
  resolvedAt: Date | null
}

function toRecord(row: EscalationRow): EscalationRecord {
  return {
    id: row.id,
    question: row.question,
    contextSnapshot: row.contextSnapshot,
    reason: row.reason,
    status: row.status === 'resolved' ? 'resolved' : 'open',
    reply: row.reply,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  }
}

/**
 * Az ügyfélirányú chat egyetlen emberi jóváhagyási pontja: ha az agent nem
 * tud a tudásbázisból megválaszolni egy kérdést, ide kerül (web_search
 * helyett), és egy munkatárs oldja fel a belső nézeten.
 */
export async function createEscalation(pool: Pool, input: EscalationToCreate): Promise<EscalationRecord> {
  const result = await pool.query<EscalationRow>(
    `INSERT INTO escalations (question, "contextSnapshot", reason)
     VALUES ($1, $2, $3)
     RETURNING id, question, "contextSnapshot", reason, status, reply, "createdAt", "resolvedAt"`,
    [input.question, input.contextSnapshot, input.reason],
  )
  return toRecord(result.rows[0])
}

export async function listOpenEscalations(pool: Pool): Promise<EscalationRecord[]> {
  const result = await pool.query<EscalationRow>(
    `SELECT id, question, "contextSnapshot", reason, status, reply, "createdAt", "resolvedAt"
     FROM escalations
     WHERE status = 'open'
     ORDER BY "createdAt" ASC`,
  )
  return result.rows.map(toRecord)
}

export async function getEscalation(pool: Pool, id: number): Promise<EscalationRecord | null> {
  const result = await pool.query<EscalationRow>(
    `SELECT id, question, "contextSnapshot", reason, status, reply, "createdAt", "resolvedAt"
     FROM escalations
     WHERE id = $1`,
    [id],
  )
  return result.rows[0] ? toRecord(result.rows[0]) : null
}

export async function resolveEscalation(pool: Pool, id: number, reply: string): Promise<EscalationRecord | null> {
  const result = await pool.query<EscalationRow>(
    `UPDATE escalations
     SET status = 'resolved', reply = $2, "resolvedAt" = now()
     WHERE id = $1
     RETURNING id, question, "contextSnapshot", reason, status, reply, "createdAt", "resolvedAt"`,
    [id, reply],
  )
  return result.rows[0] ? toRecord(result.rows[0]) : null
}
