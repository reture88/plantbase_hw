# Plantbase — architektúra (fájlstruktúra + főbb döntések)

> Kurzus-melléklet. A "mivel" (verziók, eszközlista, séma) a `stack.md`-ben; itt a STRUKTÚRA és a kulcsdöntések.

## Fájlstruktúra (Nx monorepo)

```
plantbase/
├── packages/core   agent-logika (LLM-hívás, runSql tool, RAG-pipeline, séma-kontextus, naplózás)
├── packages/db     Prisma lib (séma, migráció, kliens, seed) — NEM a gyökérben
├── apps/cli        CLI (ask + ingest-knowledge parancsok, interaktív mód)
├── apps/api        Fastify HTTP API (/api/ask, /api/rag/chat, /api/quotes/:filename)
├── apps/web        React + Vite chat frontend (két mód: katalógus, tudásbázis)
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
8. **Piaci (Anthropic-hivatalos) kiegészítő képességek, két külön útvonalon.** A fő SQL-agent tool-use loop (`runSql`, `listCategories`) mellett egy Anthropic szerver-oldali tool (`web_search`, a `@ai-sdk/anthropic` provider beépített `anthropic.tools.webSearch_20260209()` factory-ja) is elérhető általános növénygondozási tudáshoz — ez nem éri el az adatbázist, a katalógus-adat (ár/készlet/kategória) forrása változatlanul kizárólag a `runSql`/`listCategories`. Az árajánlat-dokumentum generálás egy MÁSODIK, önálló `generateText`-hívási útvonalon fut (Anthropic Agent Skills: `xlsx` + `anthropic.tools.codeExecution_20260120()`, `providerOptions.anthropic.container.skills`) — szándékosan elkülönítve a fő tool-use looptól, mert eltérő a tool-típus (szerver-oldali konténer + fájl-generálás). A generált fájl letöltése (`downloadQuoteDocument`) nem az AI SDK-n keresztül történik, mert annak Files API-ja (`anthropic.files()`) jelenleg csak feltöltést tud — ez közvetlen `fetch`-csel hívja Anthropic hivatalos Files API REST végpontjait, ugyanazokkal a fejlécértékekkel, amiket a `@ai-sdk/anthropic` csomag maga is használ ugyanerre.
9. **Előszűrés (`request-classifier`) a fő loop előtt, defense-in-depth mintában.** Mielőtt a fő tool-use loop elindulna, egy külön, olcsó LLM-hívás (`packages/core/src/agent/request-classifier.ts`) eldönti: (a) a kérdés növény-témájú-e — ez kapuzza, hogy a `web_search` tool egyáltalán bekerül-e a `tools` tömbbe (nem csak prompt-szintű instrukció, hanem kód szintű kapuzás, ugyanúgy, ahogy a `sql-guard.ts` a `runSql`-t védi), és (b) a felhasználó kért-e explicit fájl-exportot (pl. "mentsd ki fileba") — ez kapuzza, hogy az `ask`/interaktív mód a válasz után meghívja-e a megosztott `saveGeneratedQuote`/`saveQuoteIfRequested` helpert, ami legenerálja és lementi az Excel árajánlatot. Hiba esetén az osztályozó "fail closed": sem `web_search`, sem export nem indul. Az egyszerű (DB nélküli) módban a klasszifikáció nem fut le, mert nincs `runSqlPool` (nincs mit web_searchhöz kapuzni, és fájlexport sincs).
10. **"Plant Care Knowledge Base" — önálló bounded context, saját RAG-pipeline (`packages/core/src/rag/`).** A `seed/knowledge/`-beli növényápolási cikkekből épített tudásbázis (pgvector: `knowledge_documents`/`knowledge_chunks`) szándékosan NEM a katalógus-agent (`runSql`) egyik tooljaként van bekötve, hanem külön belépési ponttal (`askRag`) — mert más a garanciája: itt a válasz KIZÁRÓLAG a betöltött tudásbázisra alapulhat, sose a modell általános tudására. A keresési pipeline: **HyDE** (a nyers kérdés helyett egy hipotetikus, ideális válasz embeddingjével keresünk — `hyde.ts`) → **vektor-keresés** pgvector HNSW-indexen (`knowledge-repository.ts`, a `plantbase_ro` olvasó pool-on) → **rerank** (a top-20 vektor-találatot egy Claude Haiku-hívás rendezi valódi relevancia szerint — `rerank.ts`, mert a vektor-hasonlóság önmagában nem elég pontos) → **grounded válaszadás** egy XML-tag-es system prompttal, ami explicit megköveteli, hogy a modell mondja ki, ha a `<context>` nem elég a válaszhoz, ahelyett hogy kitalálna valamit (`rag-agent.ts`). A chunkolás is két lépcsős: bekezdés-szintű split (`chunking.ts`, API-hívás nélkül), majd egy Claude Haiku-hívás bekezdésenként eldönti, van-e benne jelentésben elváló mondatcsoport, és ha igen, szétbontja (`semantic-chunk-splitter.ts`) — ez adja a specifikusabb, célratörőbb chunkokat. Az embedding (`text-embedding-3-small`, OpenAI) külön providertől jön, mert az Anthropic nem kínál embedding-modellt. A feltöltés (`ingest-knowledge` CLI-parancs) explicit, user által indított lépés — sosem fut automatikusan, sosem éri el a frontendet. Karbantartási részletek: `docs/rag-knowledge-base-maintenance.md`.
11. **`apps/api` + `apps/web` — a katalógus-agent és a RAG-tudásbázis közös webes felülete.** Az `apps/api` (Fastify) két, egymástól független végpontot ad: `/api/ask` (a meglévő `askAgent`, változatlan viselkedéssel) és `/api/rag/chat` (`askRag`), plusz `/api/quotes/:filename` a generált Excel-fájlok letöltéséhez. Az `apps/web` (React + Vite) egyetlen chat-felületen, két füllel teszi elérhetővé mindkettőt — a felhasználó nem lát különbséget "SQL-agent" vs. "RAG-pipeline" implementációs részletek szintjén, csak azt, hogy melyik kérdéstípushoz melyik fület használja.

Konvenciók: `konvenciok.md`. Git/hook/automatizmus: `dev-workflow.md`.
