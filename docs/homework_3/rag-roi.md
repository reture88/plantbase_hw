# Költségbecslés — ingestion és egy kérdés ára

> A számok **saját, mért adatokból** jönnek (valós dokumentum/chunk-számok a jelenlegi adatbázisból, valós token-usage a `logs/*.jsonl` naplókból), a hivatalos, aktuálisan érvényes árazással kombinálva. Nagyságrendi becslés, nem számla-pontosságú tétel.

## Felhasznált árak (2026 közepe, hivatalosan ellenőrizve)

| Modell | Input | Output | Forrás |
|---|---|---|---|
| Claude Haiku 4.5 (Anthropic) | $1 / MTok | $5 / MTok | [platform.claude.com/docs/.../pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| gpt-5.4-mini (OpenAI) | $0,75 / MTok | $4,50 / MTok | [developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing) |
| text-embedding-3-small (OpenAI) | $0,02 / MTok | — | OpenAI hivatalos embedding-árazás |

(MTok = millió token. Token-becsléshez a szokásos ökölszabályt használjuk: ~4 karakter ≈ 1 token.)

## 1. Mennyibe kerül a teljes tudásbázis vektorizálása (ingest)?

**Valós, mért alapadatok** (a jelenlegi `seed/knowledge/` és a `knowledge_documents`/`knowledge_chunks` táblák alapján, nem becslés):

| Mérőszám | Érték |
|---|---|
| Dokumentum | 202 |
| Nyers bekezdés (`chunking.ts` 1. lépés kimenete = a szemantikus split LLM-hívásainak száma) | **2953** |
| Végleges chunk (a szemantikus split után) | 5342 |
| Összes végleges chunk-tartalom | 776 831 karakter (~194 200 token) |
| Átlagos bekezdés-hossz | 264 karakter (~66 token) |

**a) Chunk-split költség** (`gpt-5.4-mini`, egy hívás/bekezdés — l. `docs/homework_3/chunking-strategy.md`):

- Becsült input/hívás: ~150 token (system prompt/szabályok) + ~66 token (bekezdés) + ~20 token (XML-wrapper) ≈ **236 token**
- Becsült output/hívás: a modell a meglévő mondatokat csoportosítja át (nem told hozzá, nem rövidít érdemben) ≈ **90 token**
- Összesen 2953 hívásra: ~0,70M input token + ~0,27M output token
- **Költség**: 0,70M × $0,75 + 0,27M × $4,50 ≈ $0,52 + $1,20 ≈ **~$1,7**

**b) Embedding-költség** (`text-embedding-3-small`, a végleges 5342 chunk tartalmán, batchelve 100/hívás):

- ~194 200 token × $0,02 / 1M ≈ **~$0,004** (elhanyagolható)

**Teljes ingestion-költség egy üres DB-ről induló, teljes (202 cikkes) futásnál: nagyságrendileg ~1,5–2 USD**, túlnyomó részt a chunk-split hívásokból (a nagy hívásszám, ~3000, dominál — nem az egyes hívások mérete).

**Ismételt futtatás** (a napi/gyakori eset): a `contentHash`-alapú idempotencia (l. `docs/homework_3/rag-knowledge-base-maintenance.md`) miatt a változatlan fájlok **nulla** API-hívást generálnak. Egy tipikus egy-cikkes módosítás/hozzáadás (~14,6 bekezdés/dokumentum átlaggal) nagyságrendileg **~1 centet** (0,0085 USD) kóstál — három nagyságrenddel olcsóbb, mint egy teljes újraindexelés.

## 2. Mennyibe kerül egy kérdés a teljes pipeline-nal?

### Katalógus-kérdés (runSql) — valós log-adatokból

A `logs/*.jsonl` naplók ténylegesen rögzített token-usage-át felhasználva (2 valós katalógus-kérdés, Excel-exporttal):

| Kérdés | Input token | Output token | Költség (Haiku 4.5 áron) |
|---|---|---|---|
| "Milyen kaktuszok vannak 5000 Ft alatt? Mentsd ki Excelbe!" | 6171 | 574 | $0,00617 + $0,00287 = **$0,0090** |
| "Milyen kaktuszok vannak 5000 Ft alatt, es mentsd ki Excelbe" | 6161 | 467 | $0,00616 + $0,00234 = **$0,0085** |

Ez egy nagy `products`-séma system promptot és egy tool-call kört (runSql → eredmény visszaadása → végső válasz) tartalmaz — ezért nagyobb az input, mint egy RAG-kérdésnél. **Egy katalógus-kérdés nagyságrendileg ~0,9 cent (kb. $0,009).**

### Tudásbázis-kérdés (HyDE + embedding + rerank + grounded válasz) — saját becslés a pipeline lépéseiből

A RAG-log (`logs/rag/*.jsonl`) jelenleg **nem** naplóz token-usage-ot (ez egy azonosított hiányosság, l. lent), ezért ez a szakasz a pipeline lépéseinek ismert prompt-méretéből becsüli a nagyságrendet:

| Lépés | Modell | Becsült input | Becsült output | Költség |
|---|---|---|---|---|
| Request-classifier | Claude Haiku 4.5 | ~300 tok | ~10 tok | $0,00035 |
| HyDE | Claude Haiku 4.5 | ~150 tok | ~150 tok | $0,00090 |
| Embedding (HyDE-szöveg) | text-embedding-3-small | ~150 tok | — | ~$0,000003 |
| Rerank (20 jelölt chunk) | gpt-5.4-mini | ~1200 tok | ~80 tok | $0,00126 |
| Grounded válasz (5 chunk kontextusban) | Claude Haiku 4.5 | ~425 tok | ~300 tok | $0,00193 |
| **Összesen (sikeres, grounded válasz)** | | | | **~$0,0044 (~0,44 cent)** |

Ha a tudásbázis nem tud válaszolni és a **web_search-fallback** is lefut (`web-fallback-agent.ts`, Claude Haiku 4.5 + `web_search` tool, $10/1000 keresés + a keresési eredmény extra tokenjei):

| Extra lépés | Becslés |
|---|---|
| `web_search` hívás díja | $0,01 / keresés |
| Extra input (keresési eredmények, ~2000 tok) + output (~300 tok) | ~$0,0035 |
| **Fallback-ág teljes extra költsége** | **~$0,0135** |
| **Teljes költség egy elutasított + fallback-válaszra** | **~$0,018 (~1,8 cent)** |

### Fájlexport (PDF/Excel, Agent Skill + code execution)

Ez egy külön, multi-step (`generateText` + `code_execution` tool, max. 5 lépés, max. 16 000 output token) Anthropic Skill-hívás, ami a válaszból tényleges fájlt generál. Ennek pontos token-mérete lépésenként (szkript-írás, futtatás, fájl-visszaadás) erősen változó, ezért itt csak nagyságrendet adunk: **~$0,01–0,05 / export** — a `code_execution` konténer-ideje maga havi 1550 ingyenes órán belül marad egy ilyen méretű projektnél, tehát a domináns költségtényező itt is a token-usage, nem a konténer-futásidő.

## Összefoglalás — nagyságrend

| Tétel | Nagyságrend |
|---|---|
| Teljes tudásbázis (újra)vektorizálása (202 cikk) | **~1,5–2 USD** |
| Egy módosított/új cikk utólagos ingestje | **~1 cent** |
| Egy katalógus-kérdés (runSql) | **~0,9 cent** |
| Egy tudásbázis-kérdés (grounded, sikeres) | **~0,4 cent** |
| Egy tudásbázis-kérdés (elutasítva → web_search-fallback) | **~1,8 cent** |
| Egy fájlexport (PDF/Excel) | **~1–5 cent** |

Ezek a számok egy demó/oktatási méretű projektre (202 dokumentum, alkalmi kérdésfeltevés) triviálisan alacsonyak — napi több száz kérdés esetén sem érné el a napi 1 USD-t. A domináns, valódi költségtényező nem a lekérdezés, hanem az **ingestion újrafuttatásának gyakorisága** teljes tudásbázis-újraépítés esetén (bár a `contentHash`-alapú idempotencia miatt ez a gyakorlatban ritkán fordul elő teljes egészében — l. `docs/homework_3/rag-knowledge-base-maintenance.md`).

## Módszertani megjegyzés — mi mért adat, mi becslés

- **Mért, nem becsült**: a dokumentum-/bekezdés-/chunk-számok (közvetlenül a DB-ből és a `parseKnowledgeMarkdown` valódi kimenetéből), a katalógus-kérdések token-usage-a (a `logs/*.jsonl` valódi naplóiból).
- **Becsült, de a rendszer valódi prompt-szerkezetéből levezetve** (nem az órai példából átvéve): a RAG-lépések token-mérete, mert a `RagQueryLogEntry` (`packages/core/src/logging/rag-jsonl-logger.ts`) jelenleg nem tartalmaz `usage`-mezőt — ez azonosított hiányosság. **Javasolt következő lépés**: a `rag-agent.ts`-ben már úgyis elérhető minden lépés `usage` objektuma (HyDE, rerank, grounded válasz `generateText`/`generateObject`/`streamText` visszatérési értékéből) — ezeket összegyűjtve és a `RagQueryLogEntry`-hez adva a fenti becslés valós méréssé válna, ugyanúgy, ahogy a katalógus-ágnál már működik.
