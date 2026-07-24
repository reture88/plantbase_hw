/**
 * A `KnowledgeChunk.embedding` DB-oszlop `vector(1536)`-ként van definiálva
 * (lásd packages/db/prisma/schema.prisma) — ez az embedding-modell ezért
 * NEM env-ből konfigurálható szabadon, mert egy eltérő dimenziójú modell
 * megtörné a séma és a ténylegesen beírt vektorok egyezését.
 */
export const EMBEDDING_MODEL_ID = 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536

/**
 * Olcsó "helper" modell a nem-végleges-válasz LLM-lépésekhez (rerank,
 * szemantikus chunk-split) — hivatalos árak alapján (2026 közepe) olcsóbb,
 * mint a Claude Haiku 4.5 mindkét irányban ($0.75/$4.50 vs $1/$5 per MTok),
 * és ítéleti/strukturált-kimenetes feladatokra kellően kompetens "mini"
 * szintű modell. A HyDE-generálás szándékosan NEM ezt használja — az
 * kifejezetten Claude Haiku-n marad.
 */
export const HELPER_MODEL_ID = 'gpt-5.4-mini'
