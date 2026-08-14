# Mérési terv — Plantbase ügyfélirányú gondozási asszisztens

> A `business-case.md` 8. diájának teljes, részletes változata. Minden sorhoz **létező, a kódból ténylegesen elérhető adatforrás** tartozik — ahol a PoC ma még nem gyűjti az adatot, azt explicit jelöljük.

| Mit mérünk | Honnan lesz adat | Hogyan riportáljuk | Kinek |
|---|---|---|---|
| **Válaszidő az ügyfél felé** (a megoldott #1 fájdalomhoz kötve: munkaidőn kívüli azonnali válasz) | `logs/*.jsonl` (`durationMs`, katalógus-ág) + `logs/rag/*.jsonl` (`durationMs`, tudásbázis-ág) — mindkettő `packages/core/src/logging/` már ma is írja | Heti automatikus összesítő szkript (a `.jsonl` fájlokból medián/percentilis) | Ügyfélszolgálat vezetője |
| **Eszkalációs arány** (az agent korlátját/"hibáját" méri — nem csak a sikert) | `escalations` tábla nyitott+lezárt sorainak száma / az összes `/api/customer/chat` hívás száma (`logs/*.jsonl` bejegyzésszám az adott időszakban) | Heti automatikus összesítő + havi egy dia a vezetői riportban | Ügyfélszolgálat vezetője, szponzor |
| **Grounded (ténylegesen tudásbázis-alapú) válaszok aránya** (az agent tartalmi megbízhatóságát méri) | `logs/rag/*.jsonl` `grounded: true/false` mezője — minden RAG-lekérdezésnél naplózva | Heti automatikus összesítő | Fejlesztőcsapat, ügyfélszolgálat vezetője |
| **Eszkalált esetek átlagos megoldási ideje** (mennyi ideig vár az ügyfél emberi válaszra) | `escalations.createdAt` vs. `escalations.resolvedAt` — mindkettő a táblában | Heti automatikus összesítő | Ügyfélszolgálat vezetője |
| **Fájlexport (PDF-letöltés) használati aránya** (a #5 fájdalom — személyre szabott kiszolgálás — egy közvetett proxy-jelzője) | `apps/api/src/routes/quotes.route.ts` — ma nincs számláló, **hozzáadandó**: egy egyszerű letöltés-számláló a route-hoz | Havi egy dia a vezetői riportban | E-commerce csapat |
| **Rate-limit találatok száma** (visszaélés/túlterhelés jelzője — biztonsági metrika) | `@fastify/rate-limit` beépített `onExceeded`/válasz-fejléce, ma nincs külön naplózva — **hozzáadandó**: egyszerű számláló | Heti automatikus összesítő | IT/üzemeltetés |

## Megjegyzések

- **Legalább egy metrika a megoldott fájdalomhoz kötve**: a **válaszidő** — a #1 fájdalom ("munkaidőn kívül nem kapnak választ") pontosan ezt méri: a `logs/rag/*.jsonl` már ma is mutatja, hogy egy grounded válasz medián végrehajtási ideje 8,3 másodperc (4 mintán, fejlesztői teszt-forgalomból — élő adatra frissítendő a pilot alatt).
- **Legalább egy metrika az agent hibáját méri, nem csak a sikerét**: az **eszkalációs arány** — minél magasabb, annál gyakrabban "adja fel" a rendszer és hárítja emberre a választ; ha ez a pilot alatt tartósan 30-40% fölé menne, az azt jelezné, hogy a tudásbázis lefedettsége nem elég a valós ügyfél-kérdésekhez, és bővítés kell, mielőtt teljes bevezetésre kerülne sor.
- **Két sor jelenleg nem gyűjtött adatra mutat** (fájlexport-számláló, rate-limit-számláló) — ezt a mérési terv explicit jelöli, nem hallgatja el; mindkettő triviálisan hozzáadható (egy `INCR`-szerű számláló), de a PoC jelenlegi terjedelmében még nincs bekötve.
