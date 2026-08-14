function toRecord(row) {
    return {
        id: row.id,
        question: row.question,
        contextSnapshot: row.contextSnapshot,
        reason: row.reason,
        status: row.status === 'resolved' ? 'resolved' : 'open',
        reply: row.reply,
        createdAt: row.createdAt,
        resolvedAt: row.resolvedAt,
    };
}
/**
 * Az ügyfélirányú chat egyetlen emberi jóváhagyási pontja: ha az agent nem
 * tud a tudásbázisból megválaszolni egy kérdést, ide kerül (web_search
 * helyett), és egy munkatárs oldja fel a belső nézeten.
 */
export async function createEscalation(pool, input) {
    const result = await pool.query(`INSERT INTO escalations (question, "contextSnapshot", reason)
     VALUES ($1, $2, $3)
     RETURNING id, question, "contextSnapshot", reason, status, reply, "createdAt", "resolvedAt"`, [input.question, input.contextSnapshot, input.reason]);
    return toRecord(result.rows[0]);
}
export async function listOpenEscalations(pool) {
    const result = await pool.query(`SELECT id, question, "contextSnapshot", reason, status, reply, "createdAt", "resolvedAt"
     FROM escalations
     WHERE status = 'open'
     ORDER BY "createdAt" ASC`);
    return result.rows.map(toRecord);
}
export async function getEscalation(pool, id) {
    const result = await pool.query(`SELECT id, question, "contextSnapshot", reason, status, reply, "createdAt", "resolvedAt"
     FROM escalations
     WHERE id = $1`, [id]);
    return result.rows[0] ? toRecord(result.rows[0]) : null;
}
export async function resolveEscalation(pool, id, reply) {
    const result = await pool.query(`UPDATE escalations
     SET status = 'resolved', reply = $2, "resolvedAt" = now()
     WHERE id = $1
     RETURNING id, question, "contextSnapshot", reason, status, reply, "createdAt", "resolvedAt"`, [id, reply]);
    return result.rows[0] ? toRecord(result.rows[0]) : null;
}
