# Plant Care Knowledge Base — karbantartási architektúra-spec

> Ez a dokumentum azt írja le, hogyan tartjuk karban a `seed/knowledge/`-ből épített RAG-tudásbázist (pgvector-alapú `knowledge_documents`/`knowledge_chunks` tábla) — nem a RAG-pipeline működését (az `docs/architektura.md`-ban van), hanem az élettartam-menedzsmentjét.

## Új forrás-cikk hozzáadása

1. Helyezz el egy `.md` fájlt a `seed/knowledge/` mappában, a meglévő konvenció szerint:
   - Fájlnév: `<forrás-slug>__<cikk-slug>.md` (pl. `ask-the-sill__how-to-care-for-a-snake-plant.md`) — ez lesz a `KnowledgeDocument.slug`, tehát egyedinek kell lennie.
   - YAML frontmatter kötelező mezői: `title`, `source` (eredeti URL, ez jelenik meg forrás-hivatkozásként a válaszokban), `category`.
   - A törzsben H2/H3/H4 alcímek ajánlottak — a chunkolás ezeket használja fel metaadatként (`heading`), és ezek mentén tud jobban tájékozódni a szemantikus finomítás is.
2. Futtasd: `pnpm cli ingest-knowledge`.
3. Ellenőrizd a kimenetet — hány chunk keletkezett az új dokumentumhoz, nincs-e hibaüzenet.

## Idempotencia — miért nem drága egy ismételt futtatás

Minden dokumentumhoz eltároljuk a nyers `.md` fájl SHA-256 hash-ét (`KnowledgeDocument.contentHash`). Az `ingest-knowledge` parancs minden fájlnál előbb ezt hasonlítja össze — ha nem változott, **kihagyja** a chunkolást/szemantikus elemzést/embeddelést (ezek a drága, API-hívást igénylő lépések). Ez azt jelenti, hogy a teljes `seed/knowledge/` mappán bármikor lefuttatható a parancs — csak a ténylegesen módosult fájlak kerülnek újrafeldolgozásra.

## Mi történik egy módosított fájllal

Ha egy már betöltött `.md` fájl tartalma megváltozik (más a hash), az adott dokumentum **összes régi chunkja törlődik**, majd a teljes fájl újra chunkolódik/embeddelődik — egyetlen DB-tranzakcióban (lásd `packages/core/src/rag/knowledge-repository.ts` — `upsertDocument`). Ez azért fontos, mert egy chunk-számot csökkentő szerkesztésnél (pl. egy bekezdés törlése) különben "árva", elavult chunkok maradnának a régi tartalommal.

## Mi történik egy törölt fájllal

Ha egy `.md` fájl eltűnik a `seed/knowledge/`-ből, az `ingest-knowledge` parancs a futás végén összeveti a mappában ténylegesen talált slugokat a DB-ben lévőkkel, és törli azokat a `KnowledgeDocument` sorokat, amikhez már nincs forrásfájl (`pruneRemovedDocuments`) — ez cascade-eli a hozzájuk tartozó chunkokat is. Nincs manuális takarítás.

## Index-karbantartás, ahogy nő az adat

A `knowledge_chunks.embedding` oszlopon HNSW-index van (`vector_cosine_ops`) — ez growth-tűrő (nem igényel újratanítást, mint az ivfflat), de nagy adatmennyiségnél (több tízezer chunk) érdemes figyelni:
- `EXPLAIN ANALYZE` a `searchSimilarChunks` lekérdezésen, hogy tényleg az indexet használja-e.
- Ha a chunk-szám drasztikusan nő, az `m`/`ef_construction` HNSW-paraméterek finomhangolása megfontolandó (jelenleg a pgvector alapértékeivel fut — lásd a migrációt: `packages/db/prisma/migrations/20260722190146_add_knowledge_base/migration.sql`).

## Hibakezelés, résztelegesség

- **Per-dokumentum tranzakció**: ha az `upsertDocument` egy adott fájlnál hibázik (pl. DB-kapcsolat megszakad), a korábban már sikeresen feldolgozott fájlok változása megmarad — nem kell az egész ingestion-futást elölről kezdeni.
- **Szemantikus chunk-splitter fail-safe**: ha a Claude Haiku-hívás egy bekezdésnél hibázik (időtúllépés, rate limit), a bekezdés simán egy chunkként megy tovább finomítás nélkül — ez sosem rosszabb, mint a korábbi (bekezdés-szintű) chunkolás, csak kevésbé specifikus.
- Ha egy fájl feldolgozása hibával áll le, a parancs kilép hibakóddal, de a addig feldolgozott fájlok DB-állapota érvényben marad — a hibás fájl javítása után a parancs újrafuttatható, a már sikeres fájlok a hash-egyezés miatt automatikusan kimaradnak.

## Költségbecslés

Egy teljes (üres DB-ről induló) ingestion-futás a 202 cikkre nagyságrendileg:
- **Claude Haiku hívások** (szemantikus chunk-splitter): kb. 1500–3000 hívás (cikkenkénti bekezdésszámtól függően), egyenként pár száz input/output tokennel — Haiku-áron ez összesen nagyon alacsony költség (nagyságrendileg dollár törtrésze).
- **OpenAI embedding hívások** (`text-embedding-3-small`): a végleges chunk-tartalom összesített token-mennyisége, batchelve (100 chunk/hívás) — szintén alacsony költség (a modell $0.02/1M token körüli áron fut).
- Egy **ismételt** futtatás (csak a változott fájlokra) ennek töredéke, mert a hash-egyezés miatt a legtöbb fájl kimarad.

## Megfigyelhetőség

Minden RAG-lekérdezés (nem az ingestion, hanem a felhasználói kérdések) naplózódik a `logs/rag/*.jsonl` fájlokba (`RagQueryLogEntry` — lásd `packages/core/src/logging/rag-jsonl-logger.ts`): a kérdés, a HyDE-válasz, a visszakeresett és a reranked chunk-azonosítók, a végső grounded/elutasított döntés, időzítés, esetleges hiba. Ez teszi auditálhatóvá, hogy a rendszer mikor és miért utasított el egy kérdést — enélkül nem lehetne megkülönböztetni "a tudásbázisban tényleg nincs infó" és "a pipeline valamelyik lépése hibázott" eseteket utólag.

## Kapcsolódó dokumentumok

- `docs/architektura.md` — a RAG-pipeline (HyDE, keresés, rerank, grounding) működése.
- `docs/ddd/` — a "Plant Care Knowledge Base" bounded context domain-modellje (`KnowledgeChunk`, `KnowledgeDocument`, kapcsolódó invariánsok).
- `packages/core/src/rag/` — a tényleges implementáció.
