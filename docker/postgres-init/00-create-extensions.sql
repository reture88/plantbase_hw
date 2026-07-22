-- pgvector: szükséges a Plant Care Knowledge Base (RAG) embedding-oszlopához.
-- Az image (pgvector/pgvector:0.8.5-pg18) tartalmazza a kiterjesztés binárisát,
-- ez csak DB-szinten engedélyezi. Fut az összes migráció előtt (00- prefix),
-- mert a KnowledgeChunk.embedding oszlop a `vector` típusra épül.
CREATE EXTENSION IF NOT EXISTS vector;
