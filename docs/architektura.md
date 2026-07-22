# Plantbase — architektúra (fájlstruktúra + főbb döntések)

> Kurzus-melléklet. A "mivel" (verziók, eszközlista, séma) a `stack.md`-ben; itt a STRUKTÚRA és a kulcsdöntések.

## Fájlstruktúra (Nx monorepo)

```
plantbase/
├── packages/core   agent-logika (LLM-hívás, runSql tool, séma-kontextus, naplózás)
├── packages/db     Prisma lib (séma, migráció, kliens, seed) — NEM a gyökérben
├── apps/cli        CLI (ask parancs + interaktív mód)
├── docs            dokumentáció (lásd dev-workflow.md)
└── konfig          nx, package.json, .env, docker-compose

Később (NEM most): apps/api (4. óra), apps/web (5. óra)
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
9. **Előszűrés (`request-classifier`) a fő loop előtt, defense-in-depth mintában.** Mielőtt a fő tool-use loop elindulna, egy külön, olcsó LLM-hívás (`packages/core/src/agent/request-classifier.ts`) eldönti: (a) a kérdés növény-témájú-e — ez kapuzza, hogy a `web_search` tool egyáltalán bekerül-e a `tools` tömbbe (nem csak prompt-szintű instrukció, hanem kód szintű kapuzás, ugyanúgy, ahogy a `sql-guard.ts` a `runSql`-t védi), és (b) a felhasználó kért-e explicit fájl-exportot (pl. "mentsd ki fileba") — ez kapuzza, hogy az `ask`/interaktív mód a válasz után meghívja-e a megosztott `saveQuoteIfRequested` helpert (`apps/cli/src/export/quote-export.ts`), ami legenerálja és lementi az Excel árajánlatot. Hiba esetén az osztályozó "fail closed": sem `web_search`, sem export nem indul. Az egyszerű (DB nélküli) módban a klasszifikáció nem fut le, mert nincs `runSqlPool` (nincs mit web_searchhöz kapuzni, és fájlexport sincs).

Konvenciók: `konvenciok.md`. Git/hook/automatizmus: `dev-workflow.md`.
