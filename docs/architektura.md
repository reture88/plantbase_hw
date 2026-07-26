# Plantbase — architektúra (fájlstruktúra + főbb döntések)

> Kurzus-melléklet. A "mivel" (verziók, eszközlista, séma) a `stack.md`-ben; itt a STRUKTÚRA és a kulcsdöntések.

## Fájlstruktúra (Nx monorepo)

```
plantbase/
├── packages/core   agent-logika (LLM-hívás, runSql tool, RAG-pipeline, séma-kontextus, naplózás)
├── packages/db     Prisma lib (séma, migráció, kliens, seed) — NEM a gyökérben
├── apps/cli        CLI (ask + ingest-knowledge parancsok, interaktív mód)
├── apps/api        Fastify HTTP API (/api/chat egységes végpont, /api/quotes/:filename)
├── apps/web        React + Vite egységes chat frontend
├── seed/knowledge  RAG-tudásbázis nyers forrás-cikkei (.md, ingestion bemenete)
├── docs            dokumentáció (lásd dev-workflow.md)
└── konfig          nx, package.json, .env, docker-compose
```

(Csak nagy vonalakban; a fájl-szintű bontást Claude generálja a konvenciók szerint.)

## Főbb technológiai döntések

1. **Framework-agnostic core.** A `packages/core` nem ismeri a belépési pontokat (CLI/API/web). Új felület = új app, nem újraírás. (Mastra majd az 5. órán a core köré.)
2. **Két DB-kapcsolat, két jog.** Az agent `runSql`-je READ-ONLY kapcsolaton fut (`DATABASE_URL_READONLY`), csak SELECT. A Prisma READ-WRITE kapcsolaton (`DATABASE_URL`) viszi a sémát, migrációt, seedet. Az agent NEM Prismán kérdez.
3. **Explicit, de nem kézzel görgetett agent-loop.** Az `askAgent` a Vercel AI SDK-ra (`ai` + `@ai-sdk/anthropic`) épül — a `generateText({..., tools, stopWhen})` hívás intézi a többlépéses tool-hívást, de a tools, a system prompt és a klasszifikáció-alapú kapuzás (lásd 9. pont) a mi kódunkban, láthatóan van meghatározva, nem egy agent-framework rejti el. (Korábban egy kézzel írt, `@anthropic-ai/sdk`-ra épülő loop volt — lásd `docs/implementacios-terv.md` az átállás indoklásáért.)
4. **Átláthatóság beépítve.** Minden interakció JSONL-be naplózva; `--show-prompt` a teljes prompt megjelenítéséhez.
5. **Lokális DB.** docker-compose Postgres, OrbStack futtatja. Helyben dolgozunk, nincs felhő-DB.
6. **Prisma külön Nx lib.** A Prisma (séma, migráció, kliens, seed) a `packages/db` libben él, NEM a repo gyökerében: a séma az Nx graph része, a core és a seed onnan importál.
7. **Library-doksi munka előtt.** Új vagy ritkán használt API-nál (pl. Prisma) ELŐBB beolvassuk a doksit Context7-tel, csak utána kódolunk, mert így kevesebb a hiba a tesztek alatt.
8. **Egységes chat-orchestrátor (`unified-agent.ts`), egyetlen belépési ponttal.** Az `apps/web` mostantól NEM két külön módot (katalógus/tudásbázis) mutat, hanem egyetlen chat-ablakot — a döntést, hogy egy kérdés a `runSql`/`listCategories`-alapú katalógus-agentnek (`ask-agent.ts`) vagy a tudásbázis-alapú RAG-pipeline-nak (`rag-agent.ts`) való, egyetlen előzetes klasszifikáció hozza meg (`request-classifier.ts`, `intent: 'catalog' | 'knowledge_base'`). A `web_search` tool **kizárólag** a tudásbázis-ág fallback-lépéseként létezik (`web-fallback-agent.ts`) — ha a RAG-pipeline nem tud grounded választ adni, a chat egy feltűnő `notice` eseményt küld ("a tudásbázis alapján nem találtam választ, megpróbálom interneten"), majd egy önálló, web_search-csel felszerelt `generateText`/`streamText`-hívással próbál választ adni. A katalógus-agent tehát **nem** kap `web_search` toolt — ez korábban máshogy volt (lásd `docs/ddd/audit-log.md` a domain-drift-ről), a váltás oka: a web_search felelőssége egyértelműen "tudásbázis nem tudott válaszolni" jelzésre korlátozódjon, ne keveredjen a katalógus-agent SQL-alapú válaszaival (ez zavaró volt a RAG-funkció önálló teszteléséhez is).
9. **Két exportformátum, a válasz forrása szerint.** A dokumentum-export (`quote-export.ts`, `saveGeneratedDocument`) a válasz forrásától (`catalog` vs. `knowledge_base`/`web_search`) függően választ formátumot: katalógus-válasznál Excel (`.xlsx`, Anthropic `xlsx` Agent Skill), tudásbázis/web_search-válasznál PDF (`.pdf`, Anthropic `pdf` Agent Skill) — mindkettő ugyanazt a `code_execution` + `container.skills` mechanizmust és Files API letöltést használja (`quote-document.ts`), csak eltérő `skillId`-vel és prompttal.
10. **Előszűrés (`request-classifier`) a fő válaszadás előtt, defense-in-depth mintában.** Egy külön, olcsó LLM-hívás (`packages/core/src/agent/request-classifier.ts`) eldönti: (a) `intent` — katalógus- vagy tudásbázis-kérdés-e (ez dönti el az `unified-agent.ts` útvonalválasztását), és (b) `wantsFileExport` — kért-e a felhasználó explicit fájl-exportot. Hiba esetén az osztályozó "fail closed": `intent: 'catalog'` (nincs web_search-fallback ezen az ágon) és `wantsFileExport: false`.
11. **"Plant Care Knowledge Base" — önálló bounded context, saját RAG-pipeline (`packages/core/src/rag/`).** A `seed/knowledge/`-beli növényápolási cikkekből épített tudásbázis (pgvector: `knowledge_documents`/`knowledge_chunks`) szándékosan NEM a katalógus-agent egyik tooljaként van bekötve, hanem külön belépési ponttal (`askRag`/`streamAskRag`) — mert más a garanciája: itt a válasz KIZÁRÓLAG a betöltött tudásbázisra alapulhat, sose a modell általános tudására. A keresési pipeline: **HyDE** (a nyers kérdés helyett egy hipotetikus, ideális válasz embeddingjével keresünk, `hyde.ts`, **Claude Haiku 4.5**) → **vektor-keresés** pgvector HNSW-indexen (`knowledge-repository.ts`) → **rerank** (a top-20 vektor-találatot egy LLM-hívás rendezi valódi relevancia szerint, `rerank.ts`, **gpt-5.4-mini**) → **grounded válaszadás** egy XML-tag-es system prompttal, ami explicit megköveteli, hogy a modell mondja ki, ha a `<context>` nem elég a válaszhoz (`rag-agent.ts`, Claude Haiku). A chunkolás is két lépcsős: bekezdés-szintű split (`chunking.ts`, API-hívás nélkül), majd egy LLM-hívás (**gpt-5.4-mini**, `semantic-chunk-splitter.ts`) bekezdésenként eldönti, van-e benne jelentésben elváló mondatcsoport. **Modellválasztás indoklása** (hivatalos árak, 2026 közepe: Claude Haiku 4.5 $1/$5, gpt-5.4-mini $0.75/$4.50 per MTok input/output): a HyDE (generatív, kreatívabb feladat) Claude Haiku-n maradt, a rerank és a szemantikus split (ítéleti/strukturált-kimenetes feladatok) az olcsóbb gpt-5.4-mini-re került — az embedding (`text-embedding-3-small`, OpenAI) mindig is külön providertől jött, mert az Anthropic nem kínál embedding-modellt. A feltöltés (`ingest-knowledge` CLI-parancs) explicit, user által indított lépés — sosem fut automatikusan, sosem éri el a frontendet. Karbantartási részletek: `docs/homework_3/rag-knowledge-base-maintenance.md`.
12. **`apps/api` + `apps/web` — egyetlen `/api/chat` végpont, egyetlen chat-felület.** Az `apps/api` (Fastify) egy SSE-streamelt végpontot ad (`/api/chat`, `unified-agent.ts`-t hívja), plusz `/api/quotes/:filename` a generált Excel/PDF-fájlok letöltéséhez (Content-Type a kiterjesztés szerint). Az SSE-események: `text-delta` (élő szöveg), `notice` (a tudásbázis-fallback feltűnő jelzése), `done` (forrás, exportált fájl linkje, hivatkozások). Az `apps/web` (React + Vite) egyetlen chat-ablakban jeleníti meg mindezt — a felhasználó nem választ módot, a rendszer dönt.

Konvenciók: `konvenciok.md`. Git/hook/automatizmus: `dev-workflow.md`.
