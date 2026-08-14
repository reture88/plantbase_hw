import { randomBytes } from 'node:crypto'
import type { Pool } from 'pg'

export type EscalationRecord = {
  id: number
  pollToken: string
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
  pollToken: string
  question: string
  contextSnapshot: string
  reason: string
  status: string
  reply: string | null
  createdAt: Date
  resolvedAt: Date | null
}

const ESCALATION_COLUMNS = `id, "pollToken", question, "contextSnapshot", reason, status, reply, "createdAt", "resolvedAt"`

function toRecord(row: EscalationRow): EscalationRecord {
  return {
    id: row.id,
    pollToken: row.pollToken,
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
 * A NEM hitelesített ügyfél-pollozó végpont (`GET
 * /api/customer/escalations/:token`) ezt kapja kulcsként, nem a
 * sorszámozott `id`-t — egy kitalálható integer önmagában IDOR lenne
 * (bárki végigszámolhatná és elolvashatná más ügyfelek kérdését/válaszát).
 */
function generatePollToken(): string {
  return randomBytes(24).toString('base64url')
}

/**
 * Az ügyfélirányú chat egyetlen emberi jóváhagyási pontja: ha az agent nem
 * tud a tudásbázisból megválaszolni egy kérdést, ide kerül (web_search
 * helyett), és egy munkatárs oldja fel a belső nézeten.
 */
export async function createEscalation(pool: Pool, input: EscalationToCreate): Promise<EscalationRecord> {
  const result = await pool.query<EscalationRow>(
    `INSERT INTO escalations (question, "contextSnapshot", reason, "pollToken")
     VALUES ($1, $2, $3, $4)
     RETURNING ${ESCALATION_COLUMNS}`,
    [input.question, input.contextSnapshot, input.reason, generatePollToken()],
  )
  return toRecord(result.rows[0])
}

export async function listOpenEscalations(pool: Pool): Promise<EscalationRecord[]> {
  const result = await pool.query<EscalationRow>(
    `SELECT ${ESCALATION_COLUMNS}
     FROM escalations
     WHERE status = 'open'
     ORDER BY "createdAt" ASC`,
  )
  return result.rows.map(toRecord)
}

/** Belső (INTERNAL_TOKEN-nel védett) nézethez — numerikus id-vel, a staff bárhogy is látja az összes esetet. */
export async function getEscalation(pool: Pool, id: number): Promise<EscalationRecord | null> {
  const result = await pool.query<EscalationRow>(
    `SELECT ${ESCALATION_COLUMNS}
     FROM escalations
     WHERE id = $1`,
    [id],
  )
  return result.rows[0] ? toRecord(result.rows[0]) : null
}

/** A nem hitelesített ügyfél-pollozó végponthoz — csak a saját, kapott tokenjével kérdezhet le egy esetet. */
export async function getEscalationByToken(pool: Pool, pollToken: string): Promise<EscalationRecord | null> {
  const result = await pool.query<EscalationRow>(
    `SELECT ${ESCALATION_COLUMNS}
     FROM escalations
     WHERE "pollToken" = $1`,
    [pollToken],
  )
  return result.rows[0] ? toRecord(result.rows[0]) : null
}

export async function resolveEscalation(pool: Pool, id: number, reply: string): Promise<EscalationRecord | null> {
  const result = await pool.query<EscalationRow>(
    `UPDATE escalations
     SET status = 'resolved', reply = $2, "resolvedAt" = now()
     WHERE id = $1
     RETURNING ${ESCALATION_COLUMNS}`,
    [id, reply],
  )
  return result.rows[0] ? toRecord(result.rows[0]) : null
}
