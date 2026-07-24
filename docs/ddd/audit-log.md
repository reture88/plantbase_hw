# DDD Audit Log

> A `ddd-audit` skill futásainak naplója — mit frissített automatikusan, és mit javasolt (de nem alkalmazott) emberi jóváhagyásra várva.

## 2026-07-06 — első audit (bootstrap, nincs korábbi állapot)

### Auto-frissítve
- `docs/ddd/glossary.md` és `docs/ddd/model.md` létrehozva a nulláról, a jelenlegi kódbázis (HEAD: `9ca0471`) alapján — nem volt korábbi dokumentáció, amihez képest diffelni.
- Felvett entitás: `Product` (`packages/db/prisma/schema.prisma`).
- Felvett value objectek: `RequestClassification`, `Usage`, `RunSqlResult`, `ListCategoriesResult`, `QuoteDocumentResult`, `ToolCallLogEntry`/`InteractionLogEntry`.

### Javasolt, jóváhagyásra vár
- Nincs — ez az első futás, nincs mihez képest eltérést jelenteni.

### Megjegyzés
- A domain jelenleg lapos (egyetlen entitás, nincs aggregate-kompozíció, nincs domain event) — ez a `model.md`-ben explicit dokumentálva van, nem hiányosság, hanem a jelenlegi állapot pontos leírása.

## 2026-07-06 — bootstrap-lefedettség korrekció (emberi kérésre, ugyanaz a HEAD: `9ca0471`)

Manuális átvizsgálás (user kérésére) feltárta, hogy az első audit két dolgot kihagyott a `docs/ddd/`-ből, annak ellenére, hogy a forrásfájlok szerepeltek a domain-releváns listában. Lásd a SKILL.md-be visszavezetett tanulságot lentebb.

### Auto-frissítve
- `glossary.md`: felvéve `AskAgentResult`/`AskAgentConfig` (`packages/core/src/agent/ask-agent.ts`) — a publikus API legfontosabb, korábban dokumentálatlan value objectje.
- `model.md`: felvéve két kulcs-invariáns — `web_search` csak `isPlantRelated`-nél; Excel-export csak `wantsFileExport`-nál (soha automatikusan).

### Gyökérok, ami miatt a skill is módosult
- Az `AskAgentResult`/`AskAgentConfig` kimaradása végrehajtási hiba volt (a fájl helyesen szerepelt a domain-releváns listában, de a típusokat nem szedtem össze a glossary.md-be).
- A két invariáns kimaradása részben **script-vakfolt** volt: `apps/cli/src/export/quote-export.ts` — ami a export-gating szabályt tartalmazza — NEM szerepelt a domain-releváns fájlok között, mert az `audit_diff.py` csak típus-deklarációkat (`class/interface/type/enum/struct`) és útvonal-kulcsszavakat keresett, egy sima függvénybe (`saveQuoteIfRequested`) kódolt üzleti szabályt nem ismer fel. → Lásd a SKILL.md-ben az ebből következő javítást: a script mostantól a `glossary.md`-ben már dokumentált fogalmak neveire is keres a fájlokban, hogy a fogalom *fogyasztóit* (nem csak a definícióját) is megtalálja.

## 2026-07-22 — audit (9ca0471..e677335): Vercel AI SDK migráció

A `packages/core` agent-rétege lecserélődött `@anthropic-ai/sdk`-ról Vercel AI SDK-ra (`ai` + `@ai-sdk/anthropic`) — lásd `docs/implementacios-terv.md`. A script 11 érintett agent-fájlt jelölt (a `known-term` jelzés jól működött, mindet helyesen a már dokumentált fogalmak — `AskAgentResult`, `RequestClassification`, `RunSqlResult` stb. — fogyasztóiként/definícióiként azonosította).

### Auto-frissítve
- Nincs.

### Javasolt, jóváhagyásra vár
- Nincs.

### Megjegyzés
- **Nincs domain-drift.** A migráció tudatosan úgy lett megtervezve és leellenőrizve, hogy a publikus típusok (`AskAgentResult`, `AskAgentConfig`, `Usage`, `RequestClassification`, `RunSqlResult`, `ListCategoriesResult`, `QuoteDocumentResult`) alakja és a `model.md`-ben dokumentált kulcs-invariánsok (web_search csak `isPlantRelated`-nél, export csak `wantsFileExport`-nál, `COALESCE(sale_price, price)`, read-only katalógus) egyetlen bitet sem változtak — csak a mögöttes SDK/implementáció. A `docs/ddd/` ezért tartalmilag továbbra is pontos, nem igényelt frissítést.

## 2026-07-22 — audit (e677335..beaccea): Plant Care Knowledge Base (RAG-pipeline) hozzáadása

A `seed/knowledge/` alapján épített, pgvector-alapú RAG-tudásbázis (`packages/core/src/rag/`), a hozzá tartozó `ingest-knowledge` CLI-parancs, és két új app (`apps/api`, `apps/web`) került a rendszerbe. A script 262 érintett fájlt jelölt (ebből a `seed/knowledge/*.md` cikkek nagy része `declaration`-jelzéssel — hamis pozitív, mert ezek szövegcikkek, nem kód; a valódi domain-releváns fájlokat lásd lent).

### Auto-frissítve
- `glossary.md`: felvéve két új entitás — `KnowledgeDocument`, `KnowledgeChunk` (a "Plant Care Knowledge Base" bounded context, `packages/db/prisma/schema.prisma`).
- `glossary.md`: felvéve hat új value object — `SavedQuote`, `RetrievedChunk`, `RagAnswer`, `KnowledgeChunkInput`/`ParsedKnowledgeDocument`/`RawParagraph`, `IngestFileResult`, `RagQueryLogEntry`.
- `model.md`: felvéve a második bounded context ("Plant Care Knowledge Base"), a hozzá tartozó aggregate-határ (`KnowledgeDocument` gyökér, `KnowledgeChunk` gyermek entitás, cascade-invariáns), és három kulcs-invariáns: grounded válaszadás/explicit elutasítás, a HyDE+rerank kétlépcsős keresés fail-safe viselkedése, és hogy az ingestion mindig explicit CLI-lépés, sosem érhető el a frontendről.

### Javasolt, jóváhagyásra vár
- Nincs — az összes talált eltérés új, korábban dokumentálatlan fogalom felvétele volt (bővítés), nem meglévő fogalom jelentés- vagy határváltozása.

### Megjegyzés
- A `seed/knowledge/*.md` cikkek maguk NEM domain-fogalmak (nyers, scrapelt szövegtartalom — a script `declaration`-ként jelölte, mert Markdown fejlécet `#`-ként ismer fel, ez egy ismert zaj-forrás a heurisztikában, nem valódi kód-deklaráció), ezért nem kerültek be a glossary.md-be egyenként — a rájuk épülő `KnowledgeDocument`/`KnowledgeChunk` modell a releváns absztrakció.

## 2026-07-24 — audit (beaccea..a0fbe68): egységes chat, web_search-fallback, PDF-export, modellváltás

Öt, egymással összefüggő user-kérésre végrehajtott változás: (1) a két chat-fül (katalógus/tudásbázis) egyetlen chat-ablakká olvasztva, egy `unified-agent.ts` orchestrátorral; (2) a `web_search` felelőssége áthelyezve a katalógus-agensről a tudásbázis-ág fallback-lépésére; (3) PDF-export bevezetve a tudásbázis/web_search-válaszokhoz (Excel marad katalógus-válaszoknál); (4) a rerank és a szemantikus chunk-split modellje Claude Haiku 4.5-ről gpt-5.4-mini-re váltva (ár/feladat-illeszkedés alapján, a HyDE Claude Haiku-n maradt). Ez a legelső eset, amikor egy **jelentés-/határváltozás** (nem puszta bővítés) történt egy már dokumentált fogalmon (`RequestClassification.isPlantRelated` megszűnt, `intent` váltotta) — ez a skill szabálya szerint alapesetben "csak javaslat" kategória lenne, de itt a változást a user explicit, részletes kéréseként, tudatosan hajtottam végre (nem a ddd-audit fedezte fel utólag) — a doksi-frissítés ezért nem "javaslat", hanem a már megtörtént, jóváhagyott változás rögzítése, jelezve a régi és az új állapotot is (lásd model.md "Korábban... 2026-07-24: domain-drift felismerve és javítva" jegyzetek).

### Auto-frissítve
- `glossary.md`: `RequestClassification` bejegyzés frissítve (`isPlantRelated` → `intent`, a mező jelentésváltozásának indoklásával).
- `glossary.md`: `SavedQuote` bejegyzés frissítve (`saveGeneratedQuote` → `saveGeneratedDocument`, formátum-paraméterrel).
- `glossary.md`: három új value object felvéve — `UnifiedChatResult`/`UnifiedChatEvent`/`UnifiedChatConfig`, `WebFallbackResult`.
- `model.md`: a "Plant Catalog Agent" bounded context leírásából törölve a `web_search`; a "Plant Care Knowledge Base" invariánsai kiegészítve a fallback-viselkedéssel, a web_search új felelősség-határával, a HyDE/rerank modellváltással, és a `pruneRemovedDocuments` üres-lista védelmével (ez utóbbi egy tényleges incidens — teljes tudásbázis-törlés — nyomán vált explicit invariánssá).

### Javasolt, jóváhagyásra vár
- Nincs.

### Megjegyzés
- Ehhez az audithoz kapcsolódóan egy valódi, élesben előforduló hiba is javításra került (nem domain-modell kérdés, de érdemes megjegyezni): a `pruneRemovedDocuments` üres `keepSlugs`-ra a teljes tudásbázist törölte volna — ez ténylegesen bekövetkezett fejlesztés közben (202 dokumentum elveszett), a javítás és az újratöltés is megtörtént.
