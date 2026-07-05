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

- **A) teljes egészében kész** (A0–A6), a user kérésére megszakítás nélkül, egyben.
- **B1, B2, B3 mind kész** — mindegyik után külön-külön megállt a fejlesztés kézi tesztelésre, ahogy a user kérte.

### Kiegészítések a B3 után

- **`listCategories` tool.** A `runSql` mellett egy második, kódolt (nem a modell által generált SQL-t futtató) tool: `SELECT DISTINCT category FROM products ORDER BY category`, ugyanazon a read-only poolon. Bekötve az `askAgent` tool-use loopjába — a modell akkor hívja, ha bizonytalan a pontos kategórianévben, vagy a felhasználó a választható kategóriákra kérdez. A `docs/system-prompt.md` és a `packages/core/src/agent/schema-context.ts` `<tools>` szekciója is frissült ennek megfelelően.
- **7 önleíró szabály a system promptban** (`packages/core/src/agent/schema-context.ts` + `docs/system-prompt.md`): üres találati halmaz kezelése, írási kísérlet elutasításának megfogalmazása, több lépéses tool-használat, HUF-formázás, latin/köznapi név kettős keresése, `rating` alapú preferálás, hatókörön kívüli (belső üzleti adat) kérdések kezelése.
- **Piaci kiegészítők (nem saját fejlesztés): `web_search` + Anthropic Agent Skills.** Két, a user által kifejezetten kért kiegészítés:
  - **`web_search` szerver-oldali tool** (`packages/core/src/agent/web-search-tool.ts`, típus `web_search_20260209`, nem beta) bekötve a fő tool-use loopba (`ask-agent.ts`) a `runSql`/`listCategories` mellé, kizárólag általános növénygondozási tudáshoz (a katalógus-adat forrása változatlanul a DB). A hurok kezeli a szerver-oldali tool saját `pause_turn` iterációs-limitjét is (egyszerű újraküldéssel folytatja).
  - **`plantbase quote "<igény>"` parancs** (`apps/cli/src/commands/quote.command.ts` + `packages/core/src/agent/quote-document.ts`): előbb lefuttatja a meglévő `askAgent`-et (SQL-agent) a növény-ajánlásért, majd egy KÜLÖN, beta Messages API-hívással (`client.beta.messages.create`, `container.skills: [{skill_id: "xlsx"}]`, `code_execution_20260521` tool) formázott Excel árajánlatot generáltat, amit a Files API-n (`client.beta.files.download`) keresztül tölt le és ment a `quotes/` mappába (gitignore-olva, mint a `logs/`).
  - Mindkettő tesztelve mock Anthropic-kliensekkel (`ask-agent.spec.ts`, `quote-document.spec.ts`, `quote.command.spec.ts`); a tényleges élő futtatást (valós API-hívás, fájlgenerálás) a user teszteli.
  - Dokumentáció: `docs/brs-plantbase.md` (FR6 + hatókör-kiegészítés a `web_search`-re), `docs/architektura.md` (8. pont: két külön LLM-hívási útvonal), `docs/system-prompt.md`/`schema-context.ts` (`<tools>` + `<behavior>` "Hatókör" szabály pontosítása).

### Végrehajtás közben felmerült eltérések a tervhez képest

- **Prisma verzió: 6.19.3, nem a legfrissebb 7.x.** Prisma 7 két, egymást követő, gyakorlatban tesztelt, áthidalhatatlan törést hozott a változatlanul hagyandó `seed.ts`-hez képest: (1) az új alapértelmezett `prisma-client` generátor kötelező egyedi `output` útvonalat követel, ami megváltoztatná a `seed.ts` `import ... from '@prisma/client'` sorát; (2) a `schema.prisma` `datasource` blokkjában a `url` mező HARD hibát dob (`P1012`), a kapcsolati string kizárólag a `PrismaClient` konstruktorának explicit átadható paraméterén keresztül állítható be — ez a `seed.ts` `new PrismaClient()` (paraméter nélküli) hívását törné el. Mivel a `seed.ts`-t nem módosítjuk, a Prisma 6 utolsó stabil kiadására (6.19.3) álltunk, ami a klasszikus, env-alapú `url`-t és a paraméter nélküli klienskonstruktort is támogatja.
- **`@prisma/client` csak a gyökér `package.json`-ban szerepel függőségként, a `packages/db`-ében nem.** A `prisma-client-js` generátor a `@prisma/client`-et a `prisma` CLI csomag testvérkönyvtáraként várja; ha `packages/db` saját, külön linkelt példányt kap pnpm-től, az beárnyékolja a gyökér-példányt a Node-feloldás során, és a `prisma generate` `"Could not resolve @prisma/client"` hibával elszáll beágyazott séma-útvonal esetén. A `packages/db/src/index.ts` így a gyökér csomagra hagyatkozik (működik, mert a Node modul-feloldás felfelé lépked a könyvtárfában).
- **Host port 5433 helyett 5434.** Egy másik, ettől független helyi projekt (`C:\Users\rafi\dev_projects\plantbase`, `_hw` nélkül) már lefoglalta az 5433-as portot egy saját, futó Postgres-konténerrel — ezt a konténert értelemszerűen nem bántottuk. A `.env`, `.env.example` és a `docker-compose.yml` ennek megfelelően 5434-re lett módosítva.
- **Postgres image: 18-alpine, kötet-mountolás `/var/lib/postgresql`-re (nem `/var/lib/postgresql/data`-ra).** A Postgres 18-as image-ek új, `pg_ctlcluster`-kompatibilis adatkönyvtár-konvenciót vezettek be; a régi, közvetlenül `/var/lib/postgresql/data`-ra mountolt kötet ezzel a verzióval elindulási hibát okoz.
- **A `seed/plants.ts` valójában 30 növényt tartalmaz**, nem 28-at (a korábbi feltáró összegzés tévesen számolt) — ez összhangban van a `seed/README.md` "~30" jelzésével. Az NFR1-ellenőrzés `SELECT count(*)` eredménye ennek megfelelően 30.
- **Nx/TypeScript projekt-referencia javítás (B3):** amint az `apps/cli` a `@plantbase/core` valódi moduljait kezdte importálni (nem csak a placeholder `echo()`-t), előjött egy rejtett hiba: `apps/cli` tsconfig-ja nem hivatkozott a `packages/core` projektre, és a `packages/core/tsconfig.lib.json` `outDir`-ja (`dist/out-tsc`) nem egyezett a tényleges Nx build kimenettel (`dist/packages/core`) — összetett (`composite`) projekteknél ennek egyeznie kell. Hozzáadtam a hiányzó referenciát, összehangoltam az `outDir`-t, és `declaration:false`-ra állítottam a `cli` build targetjét (egy app-nak nincs szüksége `.d.ts` kimenetre, és a `tsconfig.base.json`-ból örökölt `composite:true` egyébként csendben rákényszerítette volna a deklaráció-generálást egy hibás esbuild-oldali típusellenőrzéssel együtt). A javítást független `tsc --noEmit` futtatással is leellenőriztem.

### Excel-export és web_search finomítás: kód szintű kapuzás a puha prompt-instrukció helyett/mellett

A korábbi megoldásban a `plantbase quote` parancs **feltétel nélkül** mindig legenerálta az Excel dokumentumot, a `web_search` pedig mindig szerepelt a `tools` tömbben (SQL-agent módban) — mindkettő kizárólag a system prompt puha instrukciójára hagyatkozott, kód szintű védelem nélkül (ellentétben a `runSql`-lel, aminek van `sql-guard.ts`-e). A user kérésére ez most a projekt meglévő defense-in-depth mintáját követve, kód szinten is kikényszerítve lett:

- **Új: `packages/core/src/agent/request-classifier.ts` (`classifyRequest`).** A fő tool-use loop ELŐTT lefutó, önálló, olcsó LLM-hívás (max 20 output token), ami két bináris kérdésre válaszol: (a) a kérdés növény-témájú-e, (b) a felhasználó kért-e explicit fájl-exportot ("mentsd ki fileba" jellegű megfogalmazás — önmagában a lista/összehasonlítás kérése NEM elég). Hiba esetén "fail closed": mindkettő `false`. Csak akkor fut le, ha van `runSqlPool` (SQL-agent mód) — az egyszerű, DB nélküli módban nincs mit kapuzni.
- **`ask-agent.ts` módosítás:** a `classification.isPlantRelated` KÓD SZINTEN dönti el, hogy a `webSearchToolDefinition` egyáltalán bekerül-e a `tools` tömbbe (nem csak a prompt kéri a modellt, hogy ne használja irreleváns kérdésre). A `classification.wantsFileExport` bekerül az `AskAgentResult.wantsFileExport` mezőbe, amit a CLI olvas ki. A klasszifikáció token-felhasználása is beleszámít az `askAgent` összesített `usage`-ába, és a JSONL log új `classification: { isPlantRelated, wantsFileExport }` mezőt kapott.
- **Önálló `plantbase quote` parancs megszűnt.** Helyette megosztott helper: `apps/cli/src/export/quote-export.ts` (`saveQuoteIfRequested`), amit az `ask` parancs (`ask.command.ts`) ÉS az interaktív mód (`interactive-loop.ts`) is meghív a válasz kiírása után. A helper csak akkor generálja/menti le az Excel fájlt (`generateQuoteDocument` + `downloadQuoteDocument` + `quotes/` mappába írás), ha `wantsFileExport === true` — export-utasítás nélkül fájl SOSEM jön létre, akkor sem, ha a válasz növénylistát tartalmaz. Példa export-utasításra: *"Van e kaktusz 5000Ft-ért? ha igen a listát mentsd ki fileba"*.
- **Tesztek:** `request-classifier.spec.ts` (4 eset: növény+nincs export, növény+export, nem növény, hibán fail-closed), `ask-agent.spec.ts` bővítve (`classifyRequest` külön mockolva `vi.mock('./request-classifier', ...)`-val, hogy a meglévő SQL-agent tesztek mock-lánca ne törjön; új tesztek: web_search kimarad nem növény-témájú kérdésnél, `wantsFileExport` átadódik), `apps/cli/src/export/quote-export.spec.ts` (új), `ask.command.spec.ts` bővítve az export-hívás ellenőrzésével. A régi `quote.command.ts`/`quote.command.spec.ts` törölve, `main.ts`-ből a `registerQuoteCommand` eltávolítva.
- Dokumentáció frissítve: `docs/architektura.md` (9. pont: request-classifier design), `docs/brs-plantbase.md` (FR6 átfogalmazva — nincs önálló `quote` parancs, a felismerés a classifieré).
