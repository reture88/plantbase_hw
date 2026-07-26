# Plantbase

Magyar nyelvű, parancssoros (CLI) AI agent, amely természetes nyelvű kérdéseket fordít read-only SQL-re egy növény-katalógus (`products` tábla) felett, és a lekérdezés eredményéből természetes nyelvű választ ad — SQL-tudás nélkül is elérhető, önkiszolgáló katalógus-keresés.

> Kurzus-projekt. A teljes, részletes specifikáció a [`docs/`](docs/) mappában található (üzleti követelmények, architektúra, tech stack, agent system prompt, konvenciók, implementációs napló).

## Miért

Egy lakberendező sok időt tölt azzal, hogy manuálisan (webshop-nézegetéssel, méricskéléssel, raktárkészlet- és ár-ellenőrzéssel) állítsa össze egy szoba növénycsomagját. A Plantbase ezt gyorsítja fel: természetes nyelven kérdezünk, az agent generálja és futtatja a szükséges SQL-t, és érthető választ ad. Részletek: [`docs/brs-plantbase.md`](docs/brs-plantbase.md), ROI-számítás: [`docs/roi.md`](docs/roi.md).

## Funkciók

- **Egységes chat** (CLI `ask` parancs / interaktív mód / webes UI): egyetlen kérdésmezőben eldől, hogy termékkeresésről (→ `runSql`) vagy egyéb növényápolási infóról (→ tudásbázis) van-e szó — nem kell külön módot választani.
- **Kód szintű biztonság**: az agent egy külön, csak `SELECT`-re jogosult DB-felhasználón fut, plusz egy kód szintű guard is elutasítja az írási kísérleteket — a modell soha nem módosíthatja az adatot.
- **Teljes átláthatóság**: minden interakció JSONL-be naplózva (`logs/`), `--show-prompt` móddal a teljes system prompt és üzenetlista megtekinthető.
- **Kategórialistázás** (`listCategories`) — a modell ezzel ellenőrzi a pontos kategórianeveket, mielőtt SQL-t generálna.
- **RAG-alapú tudásbázis** — a `seed/knowledge/*.md` növényápolási cikkek chunkolva, embeddelve (pgvector) kereshetők; a válasz HyDE + rerank pipeline-on megy át, forráshivatkozással.
- **`web_search` fallback** — csak akkor kerül elő, ha a tudásbázis a saját válaszában explicit jelzi, hogy nem tud válaszolni; ilyenkor a chat ezt feltűnően jelzi, mielőtt a `web_search`-alapú válasz elkezdene streamelni.
- **Fájlexport** — ha az üzenet expliciten kéri (pl. "...mentsd ki fileba"): katalógus/`runSql`-válasznál `.xlsx`, tudásbázis/`web_search`-válasznál `.pdf` (mindkettő Anthropic Agent Skill + code execution). Export-utasítás nélkül fájl soha nem jön létre.

## Architektúra

Nx monorepo (package-based):

```
plantbase/
├── apps/cli          CLI belépési pont (ask parancs, ingest-knowledge parancs, interaktív mód)
├── apps/api          Fastify API (SSE /api/chat, fájlletöltés /api/quotes/...)
├── apps/web          React/Vite webes chat UI
├── packages/core     agent-logika: LLM-hívás, tool-use loop, runSql/listCategories/web_search, RAG-pipeline (chunking/embedding/HyDE/rerank), JSONL naplózás
├── packages/db       Prisma (séma, migráció, seed) — külön Nx lib, nem a gyökérben
├── docs/             teljes specifikáció és implementációs napló
└── docker-compose.yml  helyi Postgres (pgvector, read-write + read-only DB-szerepkör)
```

A `packages/core` framework-agnosztikus — nem ismeri a belépési pontot (CLI/API/web), és egy kézzel írt Anthropic tool-use loopra épül, agent-framework nélkül, hogy a mechanika végig látható maradjon. Részletek: [`docs/architektura.md`](docs/architektura.md).

## Tech stack

TypeScript (strict) · Nx · pnpm · PostgreSQL (docker-compose) · Prisma · `@anthropic-ai/sdk` · Zod · Commander · Vitest · ESLint + Prettier

Teljes lista: [`docs/stack.md`](docs/stack.md).

## Első indítás

Előfeltétel: Node ≥ 20, pnpm, Docker (a helyi Postgres-hez).

```bash
pnpm install

cp .env.example .env
# .env-ben állítsd be: ANTHROPIC_API_KEY, ANTHROPIC_MODEL (pl. claude-sonnet-4-6),
# OPENAI_API_KEY (a tudásbázis embeddingjéhez és a rerank/chunk-split helper-modellhez)

docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm cli ingest-knowledge   # tudásbázis feltöltése (seed/knowledge/*.md → pgvector)
```

## Használat

### CLI

```bash
# Egyszeri kérdés — a agent maga dönti el, hogy katalógus- vagy tudásbázis-kérdés
pnpm cli ask "milyen kaktuszaink vannak raktáron 5000 Ft alatt?"
pnpm cli ask "miért nincsenek lyukak a monsterám levelein?"

# A teljes system prompt és üzenetlista kiírása (átláthatóság)
pnpm cli ask "van pozsgásunk?" --show-prompt

# Interaktív mód (readline, "exit"-tel lép ki)
pnpm cli

# Fájlexport: expliciten kell kérni, különben nem jön létre fájl
# — katalógus-válasznál .xlsx, tudásbázis/web_search-válasznál .pdf jön létre
pnpm cli ask "van kaktusz 5000 Ft alatt? ha igen, a listát mentsd ki fileba"

# Tudásbázis (re)indexelése — a seed/knowledge/ mappa aktuális tartalma alapján
# szinkronizál: új/módosult fájl feldolgozva, változatlan kihagyva, törölt fájlhoz
# tartozó dokumentum a DB-ből is törlődik. Lásd docs/homework_3/rag-knowledge-base-maintenance.md.
pnpm cli ingest-knowledge
```

### API + webes UI

```bash
pnpm api              # Fastify API indítása (alapértelmezetten :3333, SSE /api/chat)
npx nx serve web       # React/Vite dev-szerver a chat UI-hoz
```

## Fejlesztés

```bash
# Tesztelés (Vitest, Nx-en keresztül)
npx nx test core                       # egy projekt tesztjei
npx nx test core --skip-nx-cache       # ua., cache megkerülésével (valódi újrafutás)
npx nx run-many -t test                # összes projekt tesztje (core, db, cli, api, web)

# Build / típusellenőrzés
npx nx build core
npx nx build cli
npx nx build api
npx nx build web
npx nx run-many -t test build          # teszt + build minden projektre

# Lint
npx nx lint core

# Adatbázis
pnpm db:migrate        # prisma migrate dev
pnpm db:seed           # prisma db seed → packages/db/prisma/seed.ts
pnpm db:generate       # prisma generate (Prisma Client újragenerálása séma-módosítás után)
pnpm db:studio         # Prisma Studio a DB böngészéséhez

# Golden-set kiértékelés — RAG-pipeline minőségének ellenőrzése valódi API-hívásokkal
# (nyers vektorkeresés vs. HyDE+rerank pipeline), lásd docs/homework_3/rag-golden-set-evaluation.md
npx tsx scripts/golden-set-eval.ts
```

Megjegyzés: a `core` csomag néhány integrációs tesztje (`*.integration.spec.ts`) valódi Postgres/OpenAI-kapcsolatot igényel — ha a `.env` hiányzik vagy hiányos, ezek automatikusan kimaradnak (`describe.skip`), a többi teszt attól függetlenül lefut.

## Költségbecslés (RAG)

Nagyságrendileg: a teljes tudásbázis (202 dokumentum, ~2950 chunk-split hívás) vektorizálása **~1,5–2 USD**; egy módosított/új cikk utólagos ingestje (a `contentHash`-alapú kihagyás miatt) **~1 cent**; egy tudásbázis-kérdés a teljes pipeline-nal (HyDE + embedding + rerank + grounded válasz) **~0,4 cent**, elutasítás esetén a `web_search`-fallbackkel együtt **~1,8 cent**; egy katalógus-kérdés (`runSql`) valós naplóadatok alapján **~0,9 cent**. Részletes levezetés, saját mért adatokkal és a felhasznált árakkal: [`docs/homework_3/rag-roi.md`](docs/homework_3/rag-roi.md).

## Dokumentáció

| Fájl | Tartalom |
|---|---|
| [`docs/brs-plantbase.md`](docs/brs-plantbase.md) | Üzleti követelmények (BRS), funkcionális/nem-funkcionális követelmények |
| [`docs/architektura.md`](docs/architektura.md) | Fájlstruktúra és a kulcs technológiai döntések |
| [`docs/stack.md`](docs/stack.md) | Tech stack és a `products` tábla sémája |
| [`docs/konvenciok.md`](docs/konvenciok.md) | Kódolási konvenciók |
| [`docs/dev-workflow.md`](docs/dev-workflow.md) | Git/fejlesztési munkafolyamat |
| [`docs/system-prompt.md`](docs/system-prompt.md) | Az SQL-agent system promptja |
| [`docs/roi.md`](docs/roi.md) | ROI-elemzés egy 5 fős iroda esetére |
| [`docs/implementacios-terv.md`](docs/implementacios-terv.md) | Fázisolt implementációs terv + minden eltérés/döntés naplója |
| [`docs/homework_3/chunking-strategy.md`](docs/homework_3/chunking-strategy.md) | Chunkolási stratégia és indoklása, tesztekkel |
| [`docs/homework_3/rag-chat-pipeline.md`](docs/homework_3/rag-chat-pipeline.md) | A keresési pipeline (embedding, HyDE, rerank, grounding, multi-provider routing) |
| [`docs/homework_3/rag-golden-set-evaluation.md`](docs/homework_3/rag-golden-set-evaluation.md) | Golden-set kiértékelés: nyers vektorkeresés vs. teljes pipeline |
| [`docs/homework_3/rag-knowledge-base-maintenance.md`](docs/homework_3/rag-knowledge-base-maintenance.md) | Karbantartási architektúra-spec + inkrementális frissítés ábra |
| [`docs/homework_3/rag-roi.md`](docs/homework_3/rag-roi.md) | Költségbecslés (ingestion + egy kérdés a teljes pipeline-nal) |
