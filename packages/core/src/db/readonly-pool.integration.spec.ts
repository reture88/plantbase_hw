import { describe, expect, it, afterAll } from 'vitest'
import { createReadonlyPool } from './readonly-pool'

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url))
} catch {
  // .env hiányozhat (pl. CI-ban) — ilyenkor az alábbi describe.skip lép életbe
}

const connectionString = process.env.DATABASE_URL_READONLY
const describeIfDb = connectionString ? describe : describe.skip

describeIfDb('createReadonlyPool (integration, real Postgres)', () => {
  const pool = createReadonlyPool(connectionString as string)

  afterAll(async () => {
    await pool.end()
  })

  it('should allow SELECT on the products table', async () => {
    const result = await pool.query('SELECT count(*) FROM products')
    expect(Number(result.rows[0].count)).toBeGreaterThan(0)
  })

  it('should have the DB itself reject a write, independent of the app-level sql guard', async () => {
    await expect(pool.query('DELETE FROM products')).rejects.toThrow(/read-only/i)
  })
})
