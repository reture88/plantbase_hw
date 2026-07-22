# Domain Glossary

> Karbantartja: a `ddd-audit` skill. Minden bejegyzés: fogalom neve, kategória, rövid definíció, és hol él a kódban. Az automatikus frissítések itt jelennek meg — a jelentésváltozást/átnevezést igénylő módosítások előbb javaslatként futnak be (lásd `docs/ddd/audit-log.md`).

## Entitások

### Product
- **Kód:** `packages/db/prisma/schema.prisma` (`model Product`, `@@map("products")`)
- **Definíció:** a katalógus egy eladható növénytétele. Saját azonosítóval rendelkezik (`id`), ezért entitás, nem value object — két `Product` akkor is különböző, ha minden más mezőjük megegyezik. Mezők: `name`/`latin_name` (köznapi és latin név), `category`, `location` (beltéri/kültéri/mindkettő), `price`/`sale_price` (akciós ár, `null` ha nincs akció), `stock`, `light`/`watering`/`difficulty` (gondozási attribútumok), `current_height_cm`/`max_height_cm`/`current_pot_cm` (méret), `pet_safe`/`kid_safe`/`air_purifying` (bool jelzők), `rating`/`reviews_count`, `description`.
- **Kulcs üzleti szabályok:** lásd `docs/ddd/model.md` — Kulcs-invariánsok.

### KnowledgeDocument
- **Kód:** `packages/db/prisma/schema.prisma` (`model KnowledgeDocument`, `@@map("knowledge_documents")`) — a **"Plant Care Knowledge Base"** bounded context része, lásd `docs/ddd/model.md`.
- **Definíció:** egy betöltött `seed/knowledge/*.md` forrás-cikk (pl. egy "Ask the Sill" növényápolási bejegyzés). Saját azonosítóval (`id`) és egyedi `slug`-gal rendelkezik (a fájlnévből, kiterjesztés nélkül) — entitás. Mezők: `title`/`source` (eredeti URL, forrás-hivatkozásként jelenik meg a RAG-válaszokban)/`category`, `contentHash` (a nyers `.md` SHA-256-ja, idempotens ingestionhoz), `chunkCount`, `lastIngestedAt`.

### KnowledgeChunk
- **Kód:** `packages/db/prisma/schema.prisma` (`model KnowledgeChunk`, `@@map("knowledge_chunks")`)
- **Definíció:** egy `KnowledgeDocument` egy embeddelt szövegdarabja — a kétlépcsős chunkolás (bekezdés-split, majd LLM-alapú szemantikus finomítás, lásd `packages/core/src/rag/chunking.ts`/`semantic-chunk-splitter.ts`) végterméke. Mezők: `chunkIndex` (dokumentumon belüli sorrend, egyedi `documentId`+`chunkIndex` páronként), `heading` (legközelebbi megelőző alcím, opcionális), `content`, `embedding` (`vector(1536)`, HNSW-indexszel, `text-embedding-3-small`). Entitás, mert saját `id`-ja van, és a `KnowledgeDocument`-hez tartozik (`onDelete: Cascade` — egy dokumentum törlésekor/frissítésekor a chunkjai is törlődnek, lásd `upsertDocument`).

## Value Objectek

### RequestClassification
- **Kód:** `packages/core/src/agent/request-classifier.ts`
- **Definíció:** egy beérkező felhasználói kérdés előzetes, LLM-alapú besorolásának eredménye: `isPlantRelated` (kapuzza, hogy a `web_search` tool felajánlásra kerüljön-e) és `wantsFileExport` (kapuzza az Excel-export indítását), plusz a besoroláshoz felhasznált token-mennyiség (`usage`). Nincs önálló azonosítója, tisztán az adattartalma határozza meg — minden `askAgent` hívás új példányt hoz létre.

### Usage
- **Kód:** `packages/core/src/agent/ask-agent.ts`
- **Definíció:** egy agent-interakció token-felhasználásának összesítése (`inputTokens`, `outputTokens`, `totalTokens`) — a fő tool-use loop és az előzetes `RequestClassification` felhasználását is összeadva.

### RunSqlResult
- **Kód:** `packages/core/src/agent/run-sql-tool.ts`
- **Definíció:** a `runSql` tool egy futtatásának eredménye: a visszakapott sorok (`rows`) és a sorok száma (`rowCount`).

### ListCategoriesResult
- **Kód:** `packages/core/src/agent/list-categories-tool.ts`
- **Definíció:** a `listCategories` tool eredménye: a katalógusban ténylegesen előforduló `category` értékek listája (`SELECT DISTINCT category`).

### QuoteDocumentResult
- **Kód:** `packages/core/src/agent/quote-document.ts`
- **Definíció:** egy generált Excel árajánlat-dokumentum azonosítója a Files API-n (`fileId`) és a fájlneve (`filename`) — magát a bináris tartalmat nem tartalmazza, azt a `downloadQuoteDocument` tölti le külön.

### AskAgentResult / AskAgentConfig
- **Kód:** `packages/core/src/agent/ask-agent.ts` (publikus API, exportálva `packages/core/src/index.ts`-ből)
- **Definíció:** `AskAgentResult` egy teljes `askAgent()` hívás kimenete — a végleges válasz (`answer`), a használt system prompt, a teljes üzenet-history, a `Usage` és a `wantsFileExport` jelző, amit a hívó (CLI) felhasznál, hogy eldöntse, indítson-e Excel-exportot. `AskAgentConfig` a hívás bemeneti konfigurációja (`apiKey`, `model`, opcionális `logger` és `runSqlPool` — utóbbi megléte kapcsolja be az SQL-agent módot a db-mentes egyszerű móddal szemben).

### ToolCallLogEntry / InteractionLogEntry
- **Kód:** `packages/core/src/logging/jsonl-logger.ts`
- **Definíció:** egy-egy tool-hívás (`ToolCallLogEntry`: tool neve, bemenet, eredmény-minta, hiba, időtartam), illetve egy teljes felhasználói interakció (`InteractionLogEntry`: kérdés, system prompt, üzenetek, tool-hívások, végleges válasz, token-felhasználás, klasszifikáció) naplózott, változtathatatlan pillanatképe — a `logs/*.jsonl` fájlokba írva, NFR2 (átláthatóság) teljesítésére.

### SavedQuote
- **Kód:** `packages/core/src/agent/quote-export.ts`
- **Definíció:** egy sikeresen legenerált és lemezre mentett Excel árajánlat eredménye (`filename`, `filePath`) — a `saveGeneratedQuote` közös segédfüggvény adja vissza, amit az `apps/cli` és az `apps/api` `/api/ask` route-ja is használ, hogy ne duplikálódjon a "csak explicit exportkérésre generálj fájlt" logika.

### RetrievedChunk
- **Kód:** `packages/core/src/rag/types.ts`
- **Definíció:** egy vektor-kereséssel visszakapott `KnowledgeChunk`, a hasonlósági távolsággal együtt (`distance`) — a rerank lépés bemenete (`packages/core/src/rag/rerank.ts`).

### RagAnswer
- **Kód:** `packages/core/src/rag/types.ts`
- **Definíció:** egy `askRag()` hívás végeredménye: a válasz szövege (`answer`), a `grounded` jelző (hogy a válasz ténylegesen a tudásbázisra épült-e, vagy elutasítás történt), és a felhasznált forrás-cikkek (`sources`: cím + URL). Lásd a kapcsolódó kulcs-invariánst `docs/ddd/model.md`-ben.

### KnowledgeChunkInput / ParsedKnowledgeDocument / RawParagraph
- **Kód:** `packages/core/src/rag/types.ts`, `packages/core/src/rag/chunking.ts`
- **Definíció:** az ingestion belső, futásidejű adatalakjai a chunkolási folyamat egyes lépéseihez — `ParsedKnowledgeDocument`/`RawParagraph` a nyers `.md` frontmatter+bekezdés-szintű feldolgozásának eredménye (API-hívás előtt), `KnowledgeChunkInput` a szemantikus finomítás utáni, embeddelésre kész, még perzisztálatlan chunk.

### IngestFileResult
- **Kód:** `packages/core/src/rag/ingest.ts`
- **Definíció:** egy `seed/knowledge/*.md` fájl `ingest-knowledge` CLI-parancs általi feldolgozásának összefoglalója: `slug`, `skipped` (a `contentHash` alapján kihagyva-e), `chunkCount`.

### RagQueryLogEntry
- **Kód:** `packages/core/src/logging/rag-jsonl-logger.ts`
- **Definíció:** egy `askRag()` hívás naplózott pillanatképe (`logs/rag/*.jsonl`) — kérdés, HyDE-válasz, visszakeresett és reranked chunk-azonosítók, végső `grounded` döntés, válasz, időzítés, hiba. Külön típus az `InteractionLogEntry`-től, mert más felelősséget naplóz (a RAG-pipeline lépéseit, nem a katalógus-agent tool-hívásait).

## Domain Eventek

Jelenleg nincs explicit domain event a kódban (nincs event-sourcing vagy pub/sub minta) — a `ToolCallLogEntry`/`InteractionLogEntry` naplóbejegyzések ténylegesen "történt valami" jellegűek, de nincs önálló esemény-típusuk vagy feliratkozási mechanizmusuk, ezért egyelőre naplórekordként, nem domain eventként dokumentáltak.
