import { embedMany, type EmbeddingModel } from 'ai'

export const EMBEDDING_DIMENSIONS = 1536

/**
 * A `KnowledgeChunk.embedding` DB-oszlop `vector(1536)`-ként van definiálva
 * (lásd packages/db/prisma/schema.prisma) — ez az embedding-modell ezért
 * NEM env-ből konfigurálható szabadon, mert egy eltérő dimenziójú modell
 * megtörné a séma és a ténylegesen beírt vektorok egyezését.
 */
export const EMBEDDING_MODEL_ID = 'text-embedding-3-small'

/** Egy OpenAI-hívásban max ennyi szöveget embeddelünk egyszerre — a provider limitje alatt marad. */
const EMBED_BATCH_SIZE = 100

export type Embedder = (values: string[]) => Promise<number[][]>

/**
 * `values` üres tömb esetén az OpenAI API hibát adna — üres bemenetre üres
 * kimenettel térünk vissza, hogy a hívó kód (ingestion) ne kelljen ezt
 * külön ágon kezelnie.
 */
export function createEmbedder(model: EmbeddingModel): Embedder {
  return async (values: string[]): Promise<number[][]> => {
    if (values.length === 0) return []

    const embeddings: number[][] = []
    for (let i = 0; i < values.length; i += EMBED_BATCH_SIZE) {
      const batch = values.slice(i, i + EMBED_BATCH_SIZE)
      const result = await embedMany({ model, values: batch })
      embeddings.push(...result.embeddings)
    }
    return embeddings
  }
}
