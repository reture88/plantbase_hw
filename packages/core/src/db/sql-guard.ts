const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'CREATE',
  'COPY',
  'CALL',
  'DO',
  'VACUUM',
  'SET',
  'EXECUTE',
  'PREPARE',
]

export class SqlGuardError extends Error {}

/**
 * Kód szintű, kulcsszó-alapú védelem: NEM teljes SQL-parser. A fő védelem a
 * DB-szintű read-only role (lásd docker/postgres-init); ez egy második,
 * fail-fast réteg, ami a nyilvánvaló írási kísérleteket a hálózati hívás
 * előtt elutasítja.
 */
export function assertSelectOnly(sql: string): void {
  const trimmed = sql.trim()

  if (trimmed.length === 0) {
    throw new SqlGuardError('Az SQL lekérdezés nem lehet üres.')
  }

  if (trimmed.includes('--') || trimmed.includes('/*')) {
    throw new SqlGuardError('SQL-kommentek nem engedélyezettek a lekérdezésben.')
  }

  const withoutTrailingSemicolon = trimmed.endsWith(';') ? trimmed.slice(0, -1) : trimmed

  if (withoutTrailingSemicolon.includes(';')) {
    throw new SqlGuardError('Csak egyetlen SQL-utasítás futtatható egyszerre.')
  }

  if (!/^(select|with)\b/i.test(withoutTrailingSemicolon.trim())) {
    throw new SqlGuardError('Csak SELECT (vagy WITH ... SELECT) lekérdezés engedélyezett.')
  }

  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(withoutTrailingSemicolon)) {
      throw new SqlGuardError(`Tiltott SQL-kulcsszó a lekérdezésben: ${keyword}`)
    }
  }
}

export function enforceLimit(sql: string, defaultLimit = 50): string {
  const withoutTrailingSemicolon = sql.trim().replace(/;$/, '')

  if (/\blimit\s+\d+/i.test(withoutTrailingSemicolon)) {
    return withoutTrailingSemicolon
  }

  return `${withoutTrailingSemicolon} LIMIT ${defaultLimit}`
}
