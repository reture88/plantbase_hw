/** Egy bekezdés-szintű darab, még a szemantikus finomítás (semantic-chunk-splitter) előtt. */
export type RawParagraph = {
  heading: string | null
  content: string
}

/** Egy `seed/knowledge/*.md` fájl feldolgozott, chunkolásra kész alakja. */
export type ParsedKnowledgeDocument = {
  slug: string
  title: string
  source: string
  category: string
  paragraphs: RawParagraph[]
}

/** Egy végleges, embeddelésre kész chunk — a szemantikus finomítás utáni állapot. */
export type KnowledgeChunkInput = {
  documentSlug: string
  title: string
  source: string
  category: string
  heading: string | null
  chunkIndex: number
  content: string
}

/** Egy visszakeresett chunk, embeddinggel/hasonlósági távolsággal együtt. */
export type RetrievedChunk = {
  id: number
  documentSlug: string
  title: string
  source: string
  heading: string | null
  content: string
  distance: number
}

/** A grounded válaszadás végeredménye — a felhasznált forrásokkal együtt. */
export type RagAnswer = {
  answer: string
  grounded: boolean
  sources: { title: string; source: string }[]
}
