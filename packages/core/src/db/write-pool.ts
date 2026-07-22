import { Pool } from 'pg'

/**
 * Az ingestion (RAG-tudásbázis feltöltése) a READ-WRITE DB-kapcsolaton fut
 * (docs/architektura.md 2. pont) — a `products` tábla ma is csak Prisma-n
 * keresztül íródik, de a `knowledge_chunks`/`knowledge_documents` pgvector
 * oszlopát Prisma nem tudja natívan kezelni (`Unsupported` típus), ezért
 * ez a nyers `pg.Pool` végzi az ingestion-írásokat is.
 */
export function createWritePool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    statement_timeout: 30_000,
    max: 5,
  })
}
