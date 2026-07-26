# A keresési pipeline — hogyan működik a tudásbázis-chat

> Kódra hivatkozva, a `packages/core/src/rag/` és `packages/core/src/agent/` alapján — nem terv, ez a ténylegesen futó implementáció.

## Áttekintés — a teljes útvonal egy kérdéstől a válaszig

```
kérdés
  │
  ▼
[unified-agent] classifyRequest ── KATALOGUS ──► streamCatalogChat (runSql/listCategories, l. külön dokumentáció)
  │
  TUDASBAZIS
  ▼
[rag-agent] HyDE (Claude Haiku 4.5)
  │  → hipotetikus válasz-szöveg
  ▼
[embedding] text-embedding-3-small
  │  → a HIPOTETIKUS VÁLASZ embeddingje (nem a nyers kérdésé!)
  ▼
[pgvector] searchSimilarChunks — top-20, koszinusz-távolság
  │
  ▼
[rerank] gpt-5.4-mini — top-20 → top-5, tartalmi relevancia szerint
  │
  ▼
[grounding] Claude Haiku 4.5 — KIZÁRÓLAG a top-5 chunk alapján válaszol,
  │           vagy explicit elutasít (NINCS_ELEG_INFORMACIO)
  ▼
grounded válasz + forráshivatkozások          ── ha üres/elutasított ──►  [web-fallback-agent]
                                                                            Claude Haiku 4.5 + web_search
```

## 1. Embedding + vektor-tárolás

**Modell**: OpenAI `text-embedding-3-small`, 1536 dimenzió (`packages/core/src/rag/model-ids.ts`).

**Tárolás**: PostgreSQL + **pgvector** kiterjesztés (`pgvector/pgvector:0.8.5-pg18` Docker image). A `knowledge_chunks.embedding` oszlop `vector(1536)` típusú, **HNSW-indexszel**, `vector_cosine_ops` operátorosztállyal (koszinusz-távolság). A keresés:

```sql
SELECT ..., kc.embedding <=> $1::vector AS distance
FROM knowledge_chunks kc JOIN knowledge_documents kd ON kd.id = kc."documentId"
ORDER BY distance ASC LIMIT $2
```

**Miért pgvector és nem egy dedikált vektor-DB** (Pinecone, Weaviate, Qdrant stb.): a projekt egyébként is Postgres-en fut (a `products` katalógus-tábla is itt van), és 202 dokumentum / ~5300 chunk méretnél egy dedikált vektor-DB üzemeltetési overheadje (külön szolgáltatás, külön kapcsolat, külön backup-stratégia) nem térülne meg — a HNSW-index ezen a nagyságrenden bőven elég gyors, és így egyetlen tranzakciós határon belül tudjuk kezelni a dokumentum-metaadatot és a hozzá tartozó embeddingeket (l. `upsertDocument` — egy `BEGIN`/`COMMIT` blokk). Ha a chunk-szám két-három nagyságrenddel nőne, ez a döntés újragondolandó lenne (l. `docs/homework_3/rag-knowledge-base-maintenance.md` index-karbantartási szekció).

Technikai részlet: a node-pg driver a natív JS számtömböt Postgres array-literállá (`{0.1,0.2}`) szerializálná, amit a `vector` típus nem fogad el — ezért egy `toVectorLiteral()` helper explicit `[0.1,0.2,...]` string-alakra hozza, és a lekérdezésben `$1::vector` cast-tal adjuk át.

## 2. HyDE (Hypothetical Document Embeddings)

**Modell**: Claude Haiku 4.5 (Anthropic) — `createHydeGenerator(model)`, `packages/core/src/rag/hyde.ts`.

**Miért kell**: a nyers felhasználói kérdés ("Hogyan öntözzem a kaktuszaimat télen?") lexikálisan a *kérdés szavaira* hasonlít, nem a *válasz tartalmára*. Egy embedding-keresés viszont tartalmi hasonlóságot mér — ha a kérdést közvetlenül embeddeljük, a keresés hajlamos olyan chunkokat előhozni, amik ugyanazokat a szavakat ("kaktusz") tartalmazzák, de nem a kérdezett tényt (téli öntözési gyakoriság) írják le.

**Megoldás**: egy célzott LLM-hívás megír egy *hipotetikus, plauzibilis válasz-bekezdést* a kérdésre (2-4 mondat, "mintha egy növényápolási cikkből származna"), és **ezt** a szöveget embeddeljük, nem a nyers kérdést. A hipotetikus válasz sosem kerül a felhasználó elé — csak keresési célt szolgál.

Konkrét, mért bizonyíték arra, hogy ez ténylegesen javítja a találatokat: `docs/homework_3/rag-golden-set-evaluation.md` — a "téli kaktusz-öntözés" eset, ahol a nyers keresés karácsonyi-kaktuszos cikkeket hozott elő (lexikai egyezés), a HyDE viszont a tényleges téli öntözési gyakoriságról szóló chunköt (tartalmi egyezés).

## 3. Rerank

**Modell**: OpenAI `gpt-5.4-mini` — `createReranker(model, topK)`, `packages/core/src/rag/rerank.ts`.

**Miért kell**: a vektor-távolság *közelítő* relevancia-jelzés — egy chunk lehet numerikusan közel a kérdéshez, miközben ténylegesen nem válaszolja meg azt (pl. csak egy közös szót tartalmaz más kontextusban). A rerank egy LLM-hívással **ténylegesen elolvassa** a top-20 jelöltet és a kérdést, és tartalmi relevancia szerint (nem távolság szerint) újrarendezi, majd az irreleváns jelölteket kihagyja — a végeredmény a top-5.

**Fail-safe**: ha a rerank-hívás hibázik, a nyers vektor-távolság szerinti sorrend (top-5) megy tovább — a pipeline sosem áll meg emiatt, csak visszaesik a kevésbé pontos, de működő útra.

## 4. Grounding — forráshivatkozás és explicit elutasítás

A végső válaszgenerálás (`GROUNDED_SYSTEM_PROMPT`, Claude Haiku 4.5) **kizárólag** a rerank utáni top-5 chunk tartalma alapján válaszolhat:

- **Forráshivatkozás**: minden válaszhoz `sources: {title, source}[]` társul — a felhasznált chunkok dokumentum-címei és eredeti URL-jei, deduplikálva.
- **Explicit elutasítás**: ha a kontextus nem elég a kérdés megválaszolásához, a modellnek egy pontos, gépileg felismerhető markert (`NINCS_ELEG_INFORMACIO`) kell visszaadnia — semmi mást. A kód ezt lecseréli egy felhasználóbarát üzenetre ("A növényápolási tudásbázis nem tartalmaz elég információt ehhez a kérdéshez."), és `grounded: false`-t jelez, ami elindítja a web_search-fallbacket (l. lent).
- **Streaming-biztonság** (`bufferAgainstMarker`): mivel a válasz **streamelve** megy a felhasználóhoz, a nyers `NINCS_ELEG_INFORMACIO` szöveg elvileg felvillanhatna a kliensen, mielőtt a rendszer eldöntené, hogy elutasításról van szó. Ezt egy puffer-mechanizmus előzi meg: amíg a beérkezett szöveg-töredék még lehetne a marker prefixe, semmi nem megy ki a streamre; amint egyértelművé válik, hogy NEM a marker (hosszabb vagy eltér), a teljes puffer + minden további delta azonnal, változtatás nélkül kimegy. Ha a válasz végig pontosan a marker maradt, a stream üresen zár le — a felhasználó sosem lát nyers markert.

Bizonyíték arra, hogy ez ténylegesen működik (nem csak "dísz-szabály"): `docs/homework_3/rag-golden-set-evaluation.md` negatív teszt szekciója — egy témán kívüli kérdésnél (aranybányászat virágcserépben) a rendszer 5, gyengén releváns chunköt kapott kontextusként, mégis helyesen `grounded: false`-t adott vissza, mert *tartalmilag* egyik chunk sem válaszolta meg a kérdést.

## 5. Multi-provider routing — ki csinál mit, és miért

| Lépés | Provider / modell | Indoklás |
|---|---|---|
| Request-classifier (katalógus vs. tudásbázis intent) | Anthropic, `ANTHROPIC_MODEL` (`claude-haiku-4-5`) | Ugyanaz a modell fut a katalógus-agenten is — nincs értelme egy harmadik providert bevonni egy 1 rövid, alacsony tokenszámú döntéshez. |
| Chunk-split (ingestion) | OpenAI `gpt-5.4-mini` | Mechanikus, jól körülhatárolt osztályozási feladat ("egy vagy több téma van-e a bekezdésben") — nem igényel csúcsminőségű modellt. Hivatalos árazás alapján (2026 közepe) $0.75/$4.50 per MTok, olcsóbb mindkét irányban, mint Claude Haiku 4.5 ($1/$5) — nagy mennyiségű (ingestionnél ~3000) hívásnál ez érdemi megtakarítás. |
| Embedding | OpenAI `text-embedding-3-small` | Az Anthropic jelenleg nem kínál saját embedding-modellt — ez nem választás kérdése, hanem kényszer. |
| **HyDE** | **Anthropic Claude Haiku 4.5** (szándékosan NEM a helper-modell) | A HyDE minősége **upstream** az egész pipeline-hoz képest — egy gyengébb hipotetikus válasz rossz embeddinghez, rossz kereséshez vezet, amit a rerank már nem tud teljesen kompenzálni. Mivel ez egy generatív ("írj egy jó választ") feladat, nem egy mechanikus osztályozás, itt a magasabb minőségű modellt tartottuk meg — a chunk-split és a rerank viszont *ítéleti/besorolási* feladat (van-e témaváltás; relevánsak-e a jelöltek), ahol egy olcsóbb modell empirikusan ugyanolyan jól teljesít (l. `docs/homework_3/rag-golden-set-evaluation.md` — minden vizsgált kérdésnél érdemi, helyes átrendezést adott). |
| Rerank | OpenAI `gpt-5.4-mini` | L. fent — ítéleti/besorolási feladat, olcsóbb modellel is jó minőségű. |
| Grounded végső válasz | Anthropic Claude Haiku 4.5 | Ugyanaz a modell, mint a HyDE-nél és a katalógus-agentnél — a felhasználó felé menő végső szöveg minőségét (magyar nyelvhelyesség, a grounding-szabály pontos betartása) itt sem érdemes kockáztatni egy olcsóbb modellel. |
| Web-fallback válasz (`web_search`) | Anthropic Claude Haiku 4.5 | Ugyanaz a modell, csak más tool-készlettel (`web_search` engedélyezve) — ez a katalógus-ágban NINCS elérhető, kizárólag itt. |

Összefoglalva: **legalább két, ténylegesen eltérő providertől** (Anthropic + OpenAI) származó modell van a pipeline-ban, és a szereposztás nem véletlenszerű — a *generatív, minőség-érzékeny* lépések (HyDE, grounded válasz) Anthropicon futnak, az *ítéleti/mechanikus, nagy volumenű* lépések (chunk-split, rerank) OpenAI olcsóbb modelljén, az embedding pedig kényszerűen OpenAI (nincs Anthropic-alternatíva).

## 6. Unified chat orchestráció — hogyan dől el katalógus vs. tudásbázis

`packages/core/src/agent/unified-agent.ts` — `streamUnifiedChat`:

1. **`classifyRequest`** egyszer lefut: `intent: 'catalog' | 'knowledge_base'` + `wantsFileExport: boolean`. Fail-closed: hiba esetén `catalog` (nincs web_search-fallback ezen az ágon, ez a biztonságosabb alapértelmezés).
2. **`catalog`** → `streamCatalogChat` (runSql/listCategories, **web_search NÉLKÜL** — ez tudatos architekturális döntés, a katalógus-agentnek nincs saját web_search toolja).
3. **`knowledge_base`** → a fenti RAG-pipeline fut. Ha a stream **nem adott vissza szöveget VAGY** a végeredmény `grounded: false`, egy feltűnő `notice` esemény megy ki a kliensnek ("A növényápolási tudásbázisunk alapján erre nem találtam választ, ezért megpróbálom interneten kikeresni…"), majd a **web-fallback-agent** (Claude Haiku 4.5 + `web_search`) veszi át a választ streamelve, `source: 'web_search'`-ként megjelölve.

Ez a mechanizmus biztosítja, hogy a `web_search` **kizárólag** akkor aktiválódjon, amikor a saját tudásbázis ténylegesen nem tudott válaszolni — nem minden kérdésnél alapértelmezett.
