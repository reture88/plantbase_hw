# Plantbase — implementációs terv

## Kontextus

A `docs/` mappa tartalmazza a projekt teljes specifikációját (architektúra, üzleti követelmények, tech stack, agent system prompt, kódkonvenciók, dev workflow), a `seed/` mappa pedig egy kész, 28 növényes seed adatot (`plants.ts`) és egy hozzá tartozó Prisma seed scriptet (`seed.ts`). A repo az implementáció megkezdésekor előkészítés előtti állapotban volt: nem létezett `package.json`, `nx.json`, Prisma schema vagy `docker-compose.yml` — csak a dokumentáció és a seed-adat készült el eddig.

A cél: egy CLI AI agent (`plantbase ask "<kérdés>"`), ami természetes nyelvi kérdést SQL-lé fordít a `products` katalógus felett, egy **READ-ONLY** DB-kapcsolaton lefuttatja, és magyar nyelvű választ ad — méghozzá úgy felépítve, hogy a működés rétegről rétegre láthatóvá váljon: előbb echo, aztán LLM DB nélkül, végül a teljes SQL-agent.

A tervet két nagy rész alkotja (A: környezet, B: 3 implementációs fázis), minden lépés végén kis, önállóan tesztelhető increment és egy fókuszált commit. **Minden lépés előtt, ahol új/ritkán használt library API kerül elő (Nx, Prisma, `@anthropic-ai/sdk`, `commander`, `zod`, `pg`, Vitest), a Context7 MCP-vel be kell húzni a friss dokumentációt, mielőtt kódolnánk** — ez a `docs/architektura.md` 7. pontjának explicit előírása.

**Eldöntött kérdések:**
- **Git workflow:** egy közös `feat/plantbase-mvp` branch, minden lépés/fázis egy-egy fókuszált commit rajta; a végén (vagy mérföldkövenként) PR/merge a `main`-be. A `main` így végig tiszta marad, nem kell fázisonként branchet váltani.
- **Numeric precizitás:** a Prisma `Decimal` mezőtípus alapértelmezett `DECIMAL(65,30)` migrációját elfogadjuk (funkcionálisan megfelel a dokumentált `numeric`-nek), nincs kézi migráció-szerkesztés.

**Megjegyzés biztonsági szempontból:** a gyökér `.env` fájl élesnek tűnő `ANTHROPIC_API_KEY` értéket tartalmaz. A `.gitignore` helyesen kizárja a repóból, de érdemes leellenőrizni/rotálni, ha a kulcs korábban bárhol nyilvánosan látható volt.

---

## Context7 ellenőrzési pontok (áttekintés)

| Lépés | Library | Mit kell tisztázni |
|---|---|---|
| A0/A1 | **Nx** | Nx hozzáadása egy már nem üres repóhoz (`nx init` vs `create-nx-workspace`), package-based vs integrated stílus, pnpm workspace integráció |
| A2/A3/A6 | **Nx** | `@nx/js:lib` generátor flag-jei (`--directory`, `--importPath`, `--unitTestRunner`, `--bundler`), CLI-app generátor, Vitest bekötés Nx-ben |
| A3 | **Prisma** | schema.prisma szintaxis, `@map`/`@@map`, nem-gyökér schema-útvonal konfiguráció (`package.json#prisma` vagy `prisma.config.ts` — verziófüggő), `migrate dev`, `db seed` |
| B2 | **@anthropic-ai/sdk** | alap `messages.create` hívás, kliens létrehozás, `system` paraméter, `usage` mezők |
| B2 | **zod** | boundary-validáció (`safeParse`) |
| B3 | **@anthropic-ai/sdk** | tool-use loop: `tools` JSON-schema, `stop_reason === "tool_use"`, `tool_use`/`tool_result` blockok, multi-turn `messages` |
| B3 | **pg** | `Pool` connection stringből, `statement_timeout`, `query()` |
| B1 | **commander** | `Command`, `.argument()`, subcommand, `.version()` |

---

## A) KÖRNYEZET LÉTREHOZÁSA

**Mérföldkő:** a projekt fut és tesztelhető, mielőtt bármilyen agent-logika készülne.

### A0. Előkészítés
- `git checkout -b feat/plantbase-mvp`.
- Context7: Nx dokumentáció.

### A1. Root workspace bootstrap
- Létrejön: `package.json` (pnpm), `pnpm-workspace.yaml`, `nx.json`, `tsconfig.base.json`, `.prettierrc`, ESLint config.
- Root dev-függőségek: `typescript`, `nx`, `@nx/js`, `@nx/node`, `@nx/eslint` (vagy manuális ESLint), `prettier`, `eslint`, `@typescript-eslint/*`, `vitest`, `@vitest/coverage-v8`, `tsx`, `prisma`.
- **Teszt:** `npx nx --version` működik, `pnpm install` hibamentes.
- **Commit:** `chore: bootstrap nx + pnpm monorepo skeleton`

### A2. `packages/core` scaffold
- `@nx/js:lib` generátor a `packages/core` alá, importPath `@plantbase/core`, Vitest unit test runner.
- Egy triviális placeholder (`echo(text: string): string`) + Vitest teszt — ez igazolja a build/import gráfot, és a B1 fázisban újrahasznosítjuk a CLI echo módhoz.
- **Teszt:** `nx test core` zöld.
- **Commit:** `chore: scaffold packages/core lib`

### A3. `packages/db` scaffold + Prisma
- `@nx/js:lib` generátor a `packages/db` alá. `prisma` (root dev-dep), `@prisma/client` (packages/db).
- `packages/db/prisma/schema.prisma` — a `Product` modell mezői **pontosan** a `seed/plants.ts` `PlantSeed` snake_case kulcsaival egyeznek (NEM camelCase + `@map` mezőnként), mert a változatlan `seed.ts` `prisma.product.createMany({ data: plants })`-t hív:

  | Prisma mező | Típus |
  |---|---|
  | `id` | `Int @id @default(autoincrement())` |
  | `name`, `latin_name`, `category`, `location`, `light`, `watering`, `difficulty`, `description` | `String` |
  | `price`, `rating` | `Decimal` |
  | `sale_price` | `Decimal?` |
  | `stock`, `reviews_count`, `current_height_cm`, `max_height_cm`, `current_pot_cm` | `Int` |
  | `pet_safe`, `kid_safe`, `air_purifying` | `Boolean` |

  A modell szinten `@@map("products")` kötelező (a DDL kisbetűs többes számú táblanevet ír elő, Prisma alapból `Product`-ot generálna).
- Schema-útvonal konfiguráció (nem-gyökér schema), seed-parancs regisztrálása (`"seed": "tsx packages/db/prisma/seed.ts"`).
- **A meglévő seed fájlok bemásolása változtatás nélkül:** `seed/plants.ts` → `packages/db/prisma/plants.ts`, `seed/seed.ts` → `packages/db/prisma/seed.ts`.
- Root pnpm scriptek: `db:migrate`, `db:seed`, `db:generate`, `db:studio`.
- **Teszt:** `npx prisma validate` és `npx prisma generate` hibamentes.
- **Commit:** `chore: add packages/db with prisma schema mapped to seed data`

### A4. docker-compose + két Postgres role
- Root `docker-compose.yml`: Postgres szolgáltatás, `ports: ["5433:5432"]`, env `POSTGRES_USER=plantbase`/`POSTGRES_PASSWORD=plantbase`/`POSTGRES_DB=plantbase` (egyezve a meglévő `.env`-vel), névvel ellátott volume, healthcheck.
- Init SQL mount (`docker-entrypoint-initdb.d`, csak első indításkor fut): `docker/postgres-init/01-create-readonly-role.sql`:
  ```sql
  CREATE ROLE plantbase_ro LOGIN PASSWORD 'plantbase_ro';
  GRANT CONNECT ON DATABASE plantbase TO plantbase_ro;
  GRANT USAGE ON SCHEMA public TO plantbase_ro;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO plantbase_ro;
  ALTER ROLE plantbase_ro SET default_transaction_read_only = on;
  ALTER ROLE plantbase_ro SET statement_timeout = '5s';
  ```
  Az `ALTER DEFAULT PRIVILEGES` kulcsfontosságú, mert az init-script a Prisma-migráció ELŐTT fut (a `products` tábla még nem létezik) — ez biztosítja, hogy a migráció után a tábla automatikusan SELECT-elhető legyen a `plantbase_ro` role-nak, külön grant lépés nélkül.
- **Teszt:** `docker compose up -d`, healthy státusz, `\du` mindkét role-t mutatja, `plantbase_ro`-n `default_transaction_read_only=on`.
- **Commit:** `chore: add docker-compose postgres with read-write/read-only roles`

### A5. Migráció + seed betöltése + ellenőrzés
- `pnpm db:migrate` (`prisma migrate dev --name init`), `pnpm db:seed`, `pnpm db:generate`.
- **NFR1 bizonyítása még a termékkód előtt:**
  - `psql -U plantbase_ro -d plantbase -c "SELECT count(*) FROM products;"` → 28.
  - `psql -U plantbase_ro -d plantbase -c "DELETE FROM products;"` → permission denied.
- **Commit:** `feat(db): apply initial migration and load seed data`

### A6. Üres CLI (apps/cli) scaffold
- Context7: CLI-app Nx generátor + `commander` alap API.
- `@nx/node:application` generátor, `commander` (apps/cli).
- Minimál `main.ts`: `plantbase` program, `.version(...)`, semmi `ask` logika még.
- **Teszt:** a CLI elindul, `--version`/`--help` hibamentes; se DB, se hálózati hívás nem történik.
- **Commit:** `chore: scaffold empty apps/cli runnable via nx`

> **Mérföldkő vége:** itt javasolt egy `stage-1` checkpoint (git tag vagy megjegyzés a PR-ban), mielőtt a B) rész elkezdődne.

---

## B) IMPLEMENTÁCIÓ — 3 FÁZIS

### B1. CLI visszhang (echo), LLM és DB nélkül
- Új fájlok: `apps/cli/src/commands/ask.command.ts`, `apps/cli/src/interactive/interactive-loop.ts`.
- Context7: `commander` (argumentum-kezelés), `node:readline` (`createInterface`, prompt-ciklus, `exit`).
- `plantbase ask "<kérdés>"` visszaírja a beírt szöveget; argumentum nélkül interaktív readline-ciklus indul `exit`-ig. A parancs az A2-ben létrehozott `@plantbase/core` `echo()`-t hívja, hogy a cross-package import már itt igazolva legyen.
- **Teszt (user):** `plantbase ask "szia"` visszaadja a szöveget; interaktív mód + `exit` tiszta kilépést ad; Docker/Postgres **leállítva** is működik (bizonyítva a DB-függetlenséget).
- **Commit:** `feat(cli): add ask command and interactive echo mode (no llm, no db)`

### B2. LLM, adatbázis nélkül
- Context7 (kötelező): `@anthropic-ai/sdk` alap `messages.create`, `zod`.
- Új modulok `packages/core`-ban:
  - `agent/ask-agent.ts` — framework-agnosztikus `askAgent(question, options)`, injektált konfiguráció (nem közvetlen `process.env` a core belsejében), zod-validált bemenet.
  - `agent/simple-system-prompt.ts` — magyar, XML-tagelt system prompt, ami explicit kijelenti: nincs adatbázis-hozzáférés; adatra vonatkozó kérdésnél őszintén jelezze ezt. Ez szándékosan más és egyszerűbb, mint a `docs/system-prompt.md` (az csak B3-ban kerül be).
  - `logging/jsonl-logger.ts` — bevezetve már itt (B3-ban csak bővül).
- Env-betöltés: Node natív `.env`-támogatása (`process.loadEnvFile()`), nincs szükség `dotenv`-re.
- CLI: `ask` parancs és interaktív mód mostantól `askAgent`-et hívja; `--show-prompt` flag első implementációja.
- **Teszt (user):** `plantbase ask "szia, ki vagy?"` valódi Claude-választ ad; `plantbase ask "mennyi növény van raktáron?"` őszintén jelzi, hogy nincs adatbázis-hozzáférése; `--show-prompt` kiírja az üzenet-tömböt; `logs/` alatt új `.jsonl` fájl jön létre.
- **Commit(ok):** `feat(core): add askAgent with db-less system prompt`, `feat(core): add jsonl interaction logging and --show-prompt`

### B3. SQL-es interakció — teljes `runSql` tool + tool-use loop
- Context7 (kötelező): `@anthropic-ai/sdk` tool-use (`tools` schema, `tool_use`/`tool_result`, multi-turn), `zod` (tool-input validáció), `pg` (`Pool`, `statement_timeout`).
- Új modulok `packages/core`-ban:
  - `db/readonly-pool.ts` — `pg` `Pool` a `DATABASE_URL_READONLY`-ból (NEM Prismán keresztül), `statement_timeout` a pool-configon is (második védelmi réteg a DB-role timeout mellett).
  - `db/sql-guard.ts` — biztonsági guard (`assertSelectOnly(sql): void`):
    1. Üres input elutasítása.
    2. Egyetlen záró `;` levágása után, ha marad `;` valahol, elutasítás (stacked query védelem).
    3. `--` vagy `/*` előfordulásnál teljes elutasítás (komment-alapú kikerülés ellen).
    4. Normalizálás után a query-nek `SELECT`-tel vagy `WITH`-tel kell kezdődnie.
    5. Tiltott kulcsszavak szóhatár-alapú regex-e: `INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, GRANT, REVOKE, CREATE, COPY, CALL, DO, VACUUM, SET, EXECUTE, PREPARE`.
    6. `LIMIT` kikényszerítése kód szinten (append, ha hiányzik), nem bízva kizárólag a promptra.
    7. Ez regex/kulcsszó-alapú guard, NEM teljes SQL-parser — az elsődleges védelem a DB-szintű read-only role (A4), ez egy második, fail-fast réteg.
  - `agent/schema-context.ts` — a `docs/system-prompt.md` XML-tartalmának szó szerinti másolata TS string-konstansként.
  - `agent/run-sql-tool.ts` — tool-definíció (`name: "runSql"`) + handler: zod-validáció → `assertSelectOnly` → `executeReadOnlyQuery` → korlátozott méretű `tool_result`.
  - `agent/ask-agent.ts` bővítése teljes multi-turn loopra (`tools: [runSqlTool]`, ciklus `stop_reason === "tool_use"`-ig, max-iterációs korlát ~5-8 kör).
- JSONL logger bővítése: `sql`, `sqlResult` (sorszám + minta), összesített token-usage.
- **Teszt (user, több eset):**
  1. Happy path: `plantbase ask "milyen kaktuszaink vannak raktáron?"` — valós SELECT fut, válasz egyezik a seed-adattal.
  2. Kétértelmű kérdés → visszakérdezés találgatás helyett.
  3. Adverzariális kísérlet ("töröld a raktárkészletet") → guard/DB elutasítja, adat változatlan.
  4. `logs/*.jsonl` tartalmazza az SQL-t, eredményt, token-usage-t; `--show-prompt` mutatja a teljes historyt.
  5. Vitest integrációs teszt: guard megkerülésével közvetlen write-kísérlet → Postgres permission-error (DB-szintű védelem igazolása).
- **Commit(ok):** `feat(core): add read-only pg pool for runSql`, `feat(core): add sql guard enforcing select-only queries`, `feat(core): wire runSql tool into full anthropic tool-use loop`, `feat(core): extend jsonl logging with sql/result fields`, `test: cover sql guard and tool-use loop`

---

## Csomaglista

- **Root:** `typescript`, `nx`, `@nx/js`, `@nx/node`, `@nx/eslint` (vagy manuális ESLint), `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `prettier`, `eslint-config-prettier`, `vitest`, `@vitest/coverage-v8`, `tsx`, `prisma`.
- **packages/db:** `@prisma/client`.
- **packages/core:** `@anthropic-ai/sdk`, `zod`, `pg`, `@types/pg`.
- **apps/cli:** `commander`.
- Nincs szükség `dotenv`-re (Node natív `.env`-támogatás).

---

## JSONL naplózás formátuma

`logs/<session-start-ISO-timestamp>.jsonl`, soronként egy `ask`-interakció:
- `timestamp`, `question`, `systemPrompt`, `messages` (teljes futó tömb — ua., amit `--show-prompt` mutat)
- `toolCalls` (`{ tool, input, resultRowCount, resultSample, durationMs, error? }`, B2-ben üres)
- `finalAnswer`, `usage` (`{ inputTokens, outputTokens, totalTokens }`), `durationMs`, `error?`

---

## Verifikáció összefoglalva

Minden A/B lépés után **megállunk és a user teszteli** manuálisan (parancsok fent lépésenként), mielőtt a következő lépés elkezdődne. A B) rész végén a teljes flow (echo → LLM → SQL-agent) élesben, real Postgres + real Anthropic hívással demózható; a guard/read-only védelem Vitest integrációs teszttel és manuális adverzariális próbával is igazolva van.

---

## Végrehajtási állapot

- **A0–A1:** kész (`feat/plantbase-mvp` branch, Nx/pnpm workspace bootstrap).
- A user kérésére az A2–A6 lépések megszakítás nélkül, egyben készülnek el; a B1/B2/B3 fázisok után viszont **külön-külön megállunk tesztelésre**.
