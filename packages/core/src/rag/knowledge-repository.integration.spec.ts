import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { createReadonlyPool } from '../db/readonly-pool'
import { createWritePool } from '../db/write-pool'
import { getDocumentContentHash, pruneRemovedDocuments, searchSimilarChunks, upsertDocument } from './knowledge-repository'
import type { KnowledgeChunkInput } from './types'

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url))
} catch {
  // .env hiányozhat (pl. CI-ban) — ilyenkor az alábbi describe.skip lép életbe
}

const writeConnectionString = process.env.DATABASE_URL
const readConnectionString = process.env.DATABASE_URL_READONLY
const describeIfDb = writeConnectionString && readConnectionString ? describe : describe.skip

const DIMENSIONS = 1536

function fakeEmbedding(seed: number): number[] {
  return Array.from({ length: DIMENSIONS }, (_, i) => Math.sin(seed + i))
}

function chunk(index: number, content: string): KnowledgeChunkInput {
  return { documentSlug: 'integration-test-doc', title: 'Teszt cím', source: 'https://example.com/teszt', category: 'teszt', heading: null, chunkIndex: index, content }
}

describeIfDb('knowledge-repository (integration, real Postgres + pgvector)', () => {
  const writePool = createWritePool(writeConnectionString as string)
  const readPool = createReadonlyPool(readConnectionString as string)
  const slug = 'integration-test-doc'

  const keepAnchorSlug = 'integration-test-doc-keep-anchor'

  afterEach(async () => {
    await writePool.query('DELETE FROM knowledge_documents WHERE slug = ANY($1)', [[slug, keepAnchorSlug]])
  })

  afterAll(async () => {
    await writePool.end()
    await readPool.end()
  })

  it('upserts a document with its chunks and makes them searchable by vector similarity', async () => {
    await upsertDocument(
      writePool,
      { slug, title: 'Teszt cím', source: 'https://example.com/teszt', category: 'teszt', contentHash: 'hash-1', chunks: [chunk(0, 'Az aloe vera ritka öntözést igényel.')] },
      [fakeEmbedding(1)],
    )

    const results = await searchSimilarChunks(readPool, fakeEmbedding(1), 5)

    expect(results.some((r) => r.documentSlug === slug && r.content.includes('aloe vera'))).toBe(true)
  })

  it('strips embedded NUL bytes so a stray one never crashes the insert (Postgres rejects raw NUL in text columns)', async () => {
    const contentWithNul = 'Tartalom egy' + String.fromCharCode(0) + 'karakterrel.'
    await upsertDocument(
      writePool,
      { slug, title: 'Teszt cím', source: 'https://example.com/teszt', category: 'teszt', contentHash: 'hash-1', chunks: [chunk(0, contentWithNul)] },
      [fakeEmbedding(6)],
    )

    const results = await searchSimilarChunks(readPool, fakeEmbedding(6), 5)
    const stored = results.find((r) => r.documentSlug === slug)
    expect(stored?.content).toBe('Tartalom egykarakterrel.')
  })

  it('replaces old chunks when the same slug is upserted again with different content', async () => {
    await upsertDocument(writePool, { slug, title: 'Teszt cím', source: 'https://example.com/teszt', category: 'teszt', contentHash: 'hash-1', chunks: [chunk(0, 'régi tartalom')] }, [fakeEmbedding(2)])
    await upsertDocument(writePool, { slug, title: 'Teszt cím', source: 'https://example.com/teszt', category: 'teszt', contentHash: 'hash-2', chunks: [chunk(0, 'friss tartalom')] }, [fakeEmbedding(2)])

    const count = await writePool.query('SELECT count(*) FROM knowledge_chunks kc JOIN knowledge_documents kd ON kd.id = kc."documentId" WHERE kd.slug = $1', [slug])
    expect(Number(count.rows[0].count)).toBe(1)

    const hash = await getDocumentContentHash(writePool, slug)
    expect(hash).toBe('hash-2')
  })

  it('deletes documents (and cascades their chunks) that are no longer among the kept slugs', async () => {
    await upsertDocument(writePool, { slug, title: 'Teszt cím', source: 'https://example.com/teszt', category: 'teszt', contentHash: 'hash-1', chunks: [chunk(0, 'törlendő tartalom')] }, [fakeEmbedding(3)])
    // Külön "anchor" dokumentum, amit MINDIG megtartunk — ez biztosítja, hogy a
    // `keepSlugs` sose legyen (majdnem) üres, függetlenül attól, hogy a
    // megosztott dev DB-ben van-e éppen más (pl. a seed/knowledge ingestion
    // eredménye) valódi tartalom.
    await upsertDocument(writePool, { slug: keepAnchorSlug, title: 'Anchor', source: 'https://example.com/anchor', category: 'teszt', contentHash: 'anchor-hash', chunks: [chunk(0, 'megtartandó anchor tartalom')] }, [fakeEmbedding(7)])

    // KRITIKUS: ez a teszt egy MEGOSZTOTT, valódi dev DB-n fut (nem egy izolált
    // teszt-adatbázison) — a `pruneRemovedDocuments` mindent töröl, ami NINCS a
    // `keepSlugs`-ban. Ha itt egy kitalált, egyetlen slugot adnánk meg (pl.
    // 'some-other-slug'), az a teszt-dokumentumon KÍVÜL a teljes valós
    // tudásbázist (seed/knowledge ingestion eredményét) is kitörölné — ez
    // ténylegesen megtörtént fejlesztés közben. Ezért mindig a jelenleg
    // ténylegesen létező (a teszt-slugon kívüli) slugokat kérdezzük le, és
    // azokat adjuk meg megtartandóként.
    const existingSlugs = await writePool.query<{ slug: string }>('SELECT slug FROM knowledge_documents WHERE slug != $1', [slug])
    const keepSlugs = existingSlugs.rows.map((r) => r.slug)

    const removed = await pruneRemovedDocuments(writePool, keepSlugs)

    expect(removed).toContain(slug)
    expect(removed).not.toContain(keepAnchorSlug)
    const hash = await getDocumentContentHash(writePool, slug)
    expect(hash).toBeNull()
    const chunkCount = await writePool.query('SELECT count(*) FROM knowledge_chunks WHERE "documentId" = (SELECT id FROM knowledge_documents WHERE slug = $1)', [slug])
    expect(Number(chunkCount.rows[0].count)).toBe(0)
  })

  it('does NOT wipe the knowledge base when keepSlugs is empty (guard against a misconfigured/empty source dir)', async () => {
    await upsertDocument(writePool, { slug, title: 'Teszt cím', source: 'https://example.com/teszt', category: 'teszt', contentHash: 'hash-1', chunks: [chunk(0, 'megmaradó tartalom')] }, [fakeEmbedding(5)])

    const removed = await pruneRemovedDocuments(writePool, [])

    expect(removed).toEqual([])
    const hash = await getDocumentContentHash(writePool, slug)
    expect(hash).toBe('hash-1')
  })

  it('rejects writes on the read-only pool, independent of the app-level guard', async () => {
    await expect(upsertDocument(readPool, { slug, title: 'x', source: 'x', category: 'x', contentHash: 'x', chunks: [chunk(0, 'x')] }, [fakeEmbedding(4)])).rejects.toThrow(/read-only/i)
  })
})
