import type { Pool } from 'pg'
import type { KnowledgeChunkInput, RetrievedChunk } from './types'

/**
 * A pgvector `vector` típus node-pg-vel csak szöveges `[0.1,0.2,...]` alakban
 * castolható (`$1::vector`) — a natív JS tömb Postgres array-literállá
 * ({0.1,0.2}) szerializálódna, amit a `vector` típus nem fogad el.
 */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * Postgres a `text` oszlopokban nem fogad el NUL (``) byte-ot
 * ("invalid byte sequence for encoding UTF8: 0x00") — ez a forrás-markdownban
 * nem fordul elő közvetlenül, de a scrapelt tartalom kódolási hibái vagy egy
 * modellválasz szélsőséges kimenete elméletileg tartalmazhat ilyet. Utolsó
 * védvonalként itt, közvetlenül a DB-be írás előtt szűrjük ki.
 */
function stripNulBytes(text: string): string {
  return text.replace(/\u0000/g, '')
}

export type DocumentToUpsert = {
  slug: string
  title: string
  source: string
  category: string
  contentHash: string
  chunks: KnowledgeChunkInput[]
}

export async function getDocumentContentHash(pool: Pool, slug: string): Promise<string | null> {
  const result = await pool.query<{ contentHash: string }>('SELECT "contentHash" FROM knowledge_documents WHERE slug = $1', [slug])
  return result.rows[0]?.contentHash ?? null
}

/**
 * Egy dokumentum összes chunkját lecseréli — a régiek törlődnek, az újak
 * (a hozzájuk tartozó embeddingekkel) egyetlen tranzakcióban íródnak be,
 * hogy egy félbeszakadt ingestion sose hagyjon inkonzisztens állapotot.
 */
export async function upsertDocument(pool: Pool, doc: DocumentToUpsert, embeddings: number[][]): Promise<void> {
  if (doc.chunks.length !== embeddings.length) {
    throw new Error(`A chunkok (${doc.chunks.length}) és az embeddingek (${embeddings.length}) száma nem egyezik: ${doc.slug}`)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const documentResult = await client.query<{ id: number }>(
      `INSERT INTO knowledge_documents (slug, title, source, category, "contentHash", "chunkCount", "lastIngestedAt")
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         source = EXCLUDED.source,
         category = EXCLUDED.category,
         "contentHash" = EXCLUDED."contentHash",
         "chunkCount" = EXCLUDED."chunkCount",
         "lastIngestedAt" = EXCLUDED."lastIngestedAt"
       RETURNING id`,
      [stripNulBytes(doc.slug), stripNulBytes(doc.title), stripNulBytes(doc.source), stripNulBytes(doc.category), doc.contentHash, doc.chunks.length],
    )
    const documentId = documentResult.rows[0].id

    await client.query('DELETE FROM knowledge_chunks WHERE "documentId" = $1', [documentId])

    for (let i = 0; i < doc.chunks.length; i++) {
      const chunk = doc.chunks[i]
      await client.query(
        `INSERT INTO knowledge_chunks ("documentId", "chunkIndex", heading, content, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [
          documentId,
          chunk.chunkIndex,
          chunk.heading ? stripNulBytes(chunk.heading) : chunk.heading,
          stripNulBytes(chunk.content),
          toVectorLiteral(embeddings[i]),
        ],
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * A `seed/knowledge/`-ből eltűnt fájlokhoz tartozó dokumentumokat törli
 * (cascade a chunkjaikat is) — nincs "árva" tudásbázis-tartalom. A törölt
 * slugokat adja vissza, hogy az ingestion-parancs kiírhassa őket.
 *
 * Védőellenőrzés (kétszeresen is): (1) ha `keepSlugs` üres, a `!= ALL(...)`
 * SQL-feltétel minden sorra igaz lenne, tehát a teljes tudásbázist törölné —
 * ez majdnem biztosan egy hibás forráskönyvtár jele, nem szándékos "töröld ki
 * az egészet" utasítás. (2) Ha a `keepSlugs` a jelenlegi dokumentumoknak
 * kevesebb mint a felét fedi le, az is majdnem biztosan hibás bemenet
 * (rossz/hiányos slug-lista), nem valódi tömeges törlési szándék — ez a
 * konkrét eset ténylegesen bekövetkezett: egy teszt egy kitalált, egyetlen
 * elemű `keepSlugs`-szal hívta meg ezt a megosztott dev-adatbázison, és a
 * teljes 202 dokumentumos tudásbázist törölte. Mindkét esetben `force: true`
 * nélkül hibát dobunk ahelyett, hogy csendben törölnénk.
 */
export async function pruneRemovedDocuments(pool: Pool, keepSlugs: string[], force = false): Promise<string[]> {
  if (keepSlugs.length === 0) {
    return []
  }

  if (!force) {
    const totalResult = await pool.query<{ count: string }>('SELECT count(*) FROM knowledge_documents')
    const total = Number(totalResult.rows[0].count)
    if (total > 0 && keepSlugs.length < total / 2) {
      throw new Error(
        `pruneRemovedDocuments: a keepSlugs (${keepSlugs.length} elem) a jelenlegi ${total} dokumentumnak kevesebb mint a felét fedi le — ez gyanúsan hibás bemenetre utal, nem valódi tömeges törlési szándékra. Ha ez tényleg szándékos, hívd meg force: true-val.`,
      )
    }
  }

  const result = await pool.query<{ slug: string }>('DELETE FROM knowledge_documents WHERE slug != ALL($1) RETURNING slug', [keepSlugs])
  return result.rows.map((r) => r.slug)
}

export async function searchSimilarChunks(pool: Pool, queryEmbedding: number[], limit: number): Promise<RetrievedChunk[]> {
  const result = await pool.query<{
    id: number
    slug: string
    title: string
    source: string
    heading: string | null
    content: string
    distance: number
  }>(
    `SELECT kc.id, kd.slug, kd.title, kd.source, kc.heading, kc.content,
            kc.embedding <=> $1::vector AS distance
     FROM knowledge_chunks kc
     JOIN knowledge_documents kd ON kd.id = kc."documentId"
     ORDER BY distance ASC
     LIMIT $2`,
    [toVectorLiteral(queryEmbedding), limit],
  )

  return result.rows.map((row) => ({
    id: row.id,
    documentSlug: row.slug,
    title: row.title,
    source: row.source,
    heading: row.heading,
    content: row.content,
    distance: row.distance,
  }))
}
