# Plantbase

Magyar nyelvű, parancssoros (CLI) AI agent, amely természetes nyelvű kérdéseket fordít read-only SQL-re egy növény-katalógus (`products` tábla) felett, és a lekérdezés eredményéből természetes nyelvű választ ad — SQL-tudás nélkül is elérhető, önkiszolgáló katalógus-keresés.

> Kurzus-projekt. A teljes, részletes specifikáció a [`docs/`](docs/) mappában található (üzleti követelmények, architektúra, tech stack, agent system prompt, konvenciók, implementációs napló).

## Miért

Egy lakberendező sok időt tölt azzal, hogy manuálisan (webshop-nézegetéssel, méricskéléssel, raktárkészlet- és ár-ellenőrzéssel) állítsa össze egy szoba növénycsomagját. A Plantbase ezt gyorsítja fel: természetes nyelven kérdezünk, az agent generálja és futtatja a szükséges SQL-t, és érthető választ ad. Részletek: [`docs/brs-plantbase.md`](docs/brs-plantbase.md), ROI-számítás: [`docs/roi.md`](docs/roi.md).

## Funkciók

- **Természetes nyelvű kérdés-válasz** a növény-katalógus felett (`ask` parancs + interaktív mód).
- **Kód szintű biztonság**: az agent egy külön, csak `SELECT`-re jogosult DB-felhasználón fut, plusz egy kód szintű guard is elutasítja az írási kísérleteket — a modell soha nem módosíthatja az adatot.
- **Teljes átláthatóság**: minden interakció JSONL-be naplózva (`logs/`), `--show-prompt` móddal a teljes system prompt és üzenetlista megtekinthető.
- **Kategórialistázás** (`listCategories`) — a modell ezzel ellenőrzi a pontos kategórianeveket, mielőtt SQL-t generálna.
- **Általános növénygondozási tudás** Anthropic hivatalos `web_search` toolján keresztül — csak akkor kerül felajánlásra, ha egy előzetes, olcsó LLM-hívás (`request-classifier`) szerint a kérdés ténylegesen növény-témájú.
- **Excel árajánlat-export** — ha az üzenet expliciten kéri (pl. "...a listát mentsd ki fileba"), az agent válasza alapján egy Anthropic Agent Skill (xlsx generálás + code execution) formázott `.xlsx` fájlt készít és elment a `quotes/` mappába. Export-utasítás nélkül fájl soha nem jön létre.

## Architektúra

Nx monorepo (package-based):

```
plantbase/
├── apps/cli          CLI belépési pont (ask parancs + interaktív mód)
├── packages/core     agent-logika: LLM-hívás, tool-use loop, runSql/listCategories/web_search, JSONL naplózás
├── packages/db       Prisma (séma, migráció, seed) — külön Nx lib, nem a gyökérben
├── docs/             teljes specifikáció és implementációs napló
└── docker-compose.yml  helyi Postgres (read-write + read-only DB-szerepkör)
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
# .env-ben állítsd be: ANTHROPIC_API_KEY, ANTHROPIC_MODEL (pl. claude-sonnet-4-6)

docker compose up -d
pnpm db:migrate
pnpm db:seed
```

## Használat

```bash
# Egyszeri kérdés
pnpm cli ask "milyen kaktuszaink vannak raktáron 5000 Ft alatt?"

# A teljes system prompt és üzenetlista kiírása (átláthatóság)
pnpm cli ask "van pozsgásunk?" --show-prompt

# Interaktív mód (readline, "exit"-tel lép ki)
pnpm cli

# Excel-export: expliciten kell kérni, különben nem jön létre fájl
pnpm cli ask "van kaktusz 5000 Ft alatt? ha igen, a listát mentsd ki fileba"
```

## Fejlesztés

```bash
pnpm nx run-many -t test    # összes csomag tesztje (Vitest)
pnpm nx build core          # típusellenőrzés + build
pnpm nx build cli
pnpm db:studio              # Prisma Studio a DB böngészéséhez
```

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
