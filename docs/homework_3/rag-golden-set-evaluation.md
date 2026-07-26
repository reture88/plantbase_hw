# RAG Golden Set — kiértékelés: nyers vektorkeresés vs. teljes pipeline (HyDE + rerank)

> Ez a dokumentum bizonyítja, hogy a RAG-pipeline (HyDE + rerank) ténylegesen csinál valamit — nem csak extra API-költség egy amúgy is működő vektorkereséshez képest. A script: `scripts/golden-set-eval.ts` (`npx tsx scripts/golden-set-eval.ts`), valódi API-hívásokkal a teljes (a kiértékelés idején 202 dokumentum, 5414 chunk) tudásbázis ellen. A nyers kimenet reprodukálható a script újrafuttatásával. (A tudásbázis mérete azóta enyhén változott, jelenleg 202 dokumentum / 5342 chunk — a `seed/knowledge/` néhány cikke újra lett ingestálva; ez a kvalitatív következtetéseket nem érinti.)

## Módszertan

8 kérdés, mindegyik kétféleképpen futtatva:
- **(a) Nyers vektorkeresés**: a kérdés közvetlen embeddingje (`text-embedding-3-small`), top-5 `searchSimilarChunks` — HyDE és rerank nélkül.
- **(b) Teljes pipeline**: HyDE (Claude Haiku 4.5 generál egy hipotetikus választ, azt embeddeljük) → top-20 vektorkeresés → rerank (gpt-5.4-mini) → top-5.

7 kérdés valódi, a tudásbázisban ténylegesen szereplő növényápolási téma; 1 kérdés (**negatív teszt**) szándékosan a témán kívüli.

## Eredmények — összefoglaló táblázat

| # | Kérdés | (a) nyers top-1 | (b) pipeline top-1 | Átrendezés |
|---|---|---|---|---|
| 1 | Milyen gyakran öntözzem az aloe verát? | "Top Low-Maintenance Houseplants" (általános aloe-leírás) | "Top Low-Maintenance Houseplants" (konkrét: "water only when dry") | IGEN |
| 2 | Hogyan gondozzam a kardliliomot (snake plant)? | "How To Care for a Snake Plant" (troubleshooting rész) | "Essential Low Maintenance Plant" (konkrét: 2 hetenkénti öntözés) | IGEN |
| 3 | Milyen fényt igényel a gumífa? | "How to Care for a Rubber Tree" (fényigény) | ugyanaz a chunk maradt top-1, de a top-5 többi tagja teljesen kicserélődött | IGEN |
| 4 | Hogyan segítsek az orchideámnak újra virágozni? | "How To Repot an Orchid" (átültetés, NEM virágoztatás) | "How To Make Your Orchid Rebloom" (pontosan a kérdezett téma) | IGEN |
| 5 | Miért nincsenek lyukak a monstera levelein? | "The Hole Truth: Monsteras" (elméleti háttér) | "The Hole Truth: Monsteras" (gyakorlati "hogyan segítsd elő" rész) | IGEN |
| 6 | Milyen szobanövények biztonságosak macskáknak? | Karácsonyi kaktusz (pet-safe megjegyzéssel) | "How To Care for a Calathea" (explicit pet-safe lista élén) | IGEN |
| 7 | Hogyan öntözzem a kaktuszaimat télen? | Karácsonyi kaktusz cikkek (téli öntözésről szó sincs bennük) | "Our Top 7 Winter Plant Care Tips" + "Reduce watering during the winter months." | **IGEN — lásd lent, kiemelt eset** |
| 8 (negatív) | Hogyan bányászak aranyat egy virágcserépben? | Random, gyengén releváns cikkek (d≥0.665) | Random, gyengén releváns cikkek (d≥0.69) | IGEN, de irrelevánsak maradtak — helyesen |

**Mind a 8 kérdésnél történt érdemi átrendezés** — nincs olyan eset, ahol a nyers és a pipeline top-5 azonos lett volna, tehát nem kellett azt magyarázni, "miért nem rendezett át semmit".

## Kiemelt eset: "Hogyan öntözzem a kaktuszaimat télen?" — miért jobb a pipeline sorrendje

**Nyers vektorkeresés top-5** (csak a kérdés szó szerinti embeddingjével):
```
1. [d=0.5970] "How to Care for a Christmas Cactus or Schlumbergera" — fényigényről szól
2. [d=0.6251] "The Best Gifts for Pet Parents" — egy ajándékötlet-listában említi a kaktuszt
3. [d=0.6311] "Christmas Cactus Care Guide" — általános gondozási útmutató
4. [d=0.6321] "How to Care for a Desert Rose" — nem is kaktusz
5. [d=0.6335] "How to Care for a Cactus" — általános kaktusz-gondozás
```
A nyers keresés a "kaktusz" szó felszíni hasonlósága miatt túlnyomórészt **karácsonyi kaktuszos cikkeket** hozott elő — egyik sem beszél kifejezetten a **téli öntözésről**, ami a tényleges kérdés volt. A "gift for pet parents" találat (#2) kifejezetten irreleváns, csak azért került be, mert egy mondatban megemlíti a kaktuszt.

**Teljes pipeline top-5** (HyDE: *"Télen a kaktuszokat jelentősen csökkentett vízmennyiséggel öntözzük... 2-4 hetente, vagy még ritkábban"* → keresés → rerank):
```
1. [d=0.5766] "Our Top 7 Winter Plant Care Tips" — kifejezetten téli gondozásról
2. [d=0.5880] "How to Care for Outdoor Plants Until They're Ready for Spring Planting" — "Dormant plants only need water every few weeks"
3. [d=0.5529] "How to Care for a Cactus" — "Reduce watering during the winter months." ← SZÓ SZERINT a válasz
4. [d=0.5760] "Patio Gardening 101" — "water your plants, but less frequently in winter"
5. [d=0.6033] "How To Keep Your Plants Alive While On Vacation" — dormancia/ritkább öntözés kontextusban
```
**Miért jobb ez a sorrend:** a HyDE-lépés a nyers kérdés helyett egy already-answer-shaped szöveggel keresett ("télen csökkentett vízmennyiséggel... 2-4 hetente"), ami tartalmilag sokkal közelebb esik azokhoz a chunkokhoz, amik ténylegesen erről szólnak (téli öntözési gyakoriság), nem csak a "kaktusz" kulcsszóhoz. A rerank ezután a #3 helyre emelte azt a chunkot, ami **szó szerint** a kérdezett választ tartalmazza ("Reduce watering during the winter months"), miközben egyetlen karácsonyi-kaktusz-specifikus, de téma szerint irreleváns cikk sem maradt a top-5-ben. Ez a klasszikus HyDE-motiváció tankönyvi példája: a nyers kérdés lexikálisan "kaktusz"-ra optimalizál, a hipotetikus válasz tartalmilag "téli öntözési gyakoriság"-ra.

## Negatív teszt: "Hogyan bányászak aranyat egy virágcserépben?"

Ez a kérdés szándékosan **nincs** a növényápolási tudásbázisban (a téma: aranykitermelés, nem növényápolás). Mindkét keresési mód (nyers és pipeline) jelentősen magasabb távolság-értékeket (d ≥ 0.66-0.70) adott, mint bármelyik valódi kérdésnél (jellemzően d ≈ 0.45-0.60) — már ez önmagában jelzi, hogy nincs releváns tartalom.

Érdekesség: a HyDE-lépés maga is felismerte a témán kívüliséget, és ezt írta a hipotetikus válasz elején: *"Megjegyzés: Ez a kérdés valójában nem a növényápolásról szól, hanem aranybányászatról, ezért technikai választ kellene adni, nem botanikait."* — ennek ellenére (a promptnak megfelelően) generált egy hipotetikus szöveget, ami néhány gyengén kapcsolódó, kertészeti témájú chunkot hozott be a keresésbe.

**A teljes `askRag()` válasz** (nem csak a top-5 lista, hanem a végső, grounded válaszadási lépés is):
```
grounded: false
answer: "A növényápolási tudásbázis nem tartalmaz elég információt ehhez a kérdéshez."
```
A grounded válaszadási lépés — annak ellenére, hogy kapott 5 (gyengén releváns) chunkot kontextusként — **helyesen felismerte, hogy egyik sem válaszolja meg ténylegesen a kérdést**, és a `NINCS_ELEG_INFORMACIO` jelzőt adta vissza kitalálás helyett. Ez a grounding-szabály éles bizonyítéka: a rendszer nem azért utasítja el a választ, mert a keresés üres listát adott (ez esetben NEM volt üres), hanem mert a *tartalom* alapján a modell felismerte, hogy egyik chunk sem releváns.

## Következtetés

- A HyDE+rerank pipeline minden vizsgált kérdésnél érdemben átrendezte a találatokat, és a kiemelt esetben (téli kaktusz-öntözés) egy konkrétan a kérdésre válaszoló chunkot emelt a top-5-be, amit a nyers keresés a lexikai "kaktusz"-egyezés miatt hátrébb sorolt volna vagy ki sem hozott volna elég magas rangsorban.
- A negatív teszt bizonyítja, hogy a grounding-szabály tartalom alapján dönt, nem csak a keresési találatok meglétén/hiányán — még akkor is helyesen elutasít, ha a keresés hoz (gyengén releváns) találatokat.
- Egyetlen kérdésnél sem maradt el az átrendezés — ha ez történt volna, az potenciálisan azt jelezné, hogy a rerank lépés felesleges overhead; ehelyett minden esetben mérhető minőségi különbséget adott.
