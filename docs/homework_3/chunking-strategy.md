# Chunking-stratégia — és az indoklás

> A tényleges implementáció: `packages/core/src/rag/chunking.ts` + `packages/core/src/rag/semantic-chunk-splitter.ts`.

## A tudásbázis jellege — ebből következik minden döntés

A `seed/knowledge/` alatti 202 cikk mind scrapelt, szerkesztett növényápolási blogbejegyzés (The Sill, NYBG stb.). Ezeknek van egy közös, kihasználható szerkezete:

- **YAML frontmatter** (`title`, `source`, `category`) minden fájl elején.
- **Markdown heading-hierarchia** (`#`–`######`) — a cikkek gyakorlatilag már eleve "előre-tagoltak" témák szerint (pl. "Milyen fényt igényel?", "Milyen gyakran öntözzem?").
- **Rövid bekezdések** — egy-egy heading alatt jellemzően 1-4 mondatos, önmagában értelmezhető gondolat.
- **Marketing-lábléc szennyeződés** a cikkek végén (termékajánlás, byline).

Ez a szerkezet döntő: **nem kell (és nem is jó) karakter-alapú, ablakos chunkolást** csinálni (pl. "minden 500 karakter, 50 karakter átfedéssel") — az egy strukturálatlan korpuszra (pl. egy hosszú PDF-jogszabály) való megoldás lenne, itt viszont a forrás maga adja meg a szemantikai határokat a headingekkel és a bekezdésekkel. A feladat inkább az, hogy ezt a meglévő struktúrát **tisztán kiaknázzuk**, és csak ott finomítsunk tovább, ahol a bekezdés-határ ténylegesen nem esik egybe a téma-határral.

## A megvalósított kétlépcsős stratégia

### 1. lépés — determinisztikus bekezdés-split (`chunking.ts`)

Tisztán szabály-alapú, **LLM-hívás nélküli** feldolgozás:

1. **Frontmatter-parse** → `title`/`source`/`category`.
2. **Boilerplate-vágás**: ha a törzsszövegben megjelenik egy ismert marketing-lábléc-marker (pl. `"## Perfect Pairings For Your Plants"`), minden utána lévő szöveg eldobásra kerül — ez sosem kerülhet be találatként egy válaszba.
3. **Sor-alapú bejárás**: minden `#`–`######` heading új szakaszt nyit (a heading szövege lesz a `heading` metaadat minden alá tartozó bekezdésen), üres sor lezár egy bekezdést.
4. **Minimális hossz-szűrés** (`MIN_PARAGRAPH_LENGTH = 20` karakter): kiszűri az olyan triviális sorokat, mint a "By The Sill" byline — ezek sosem lennének hasznos találatok, csak zajt adnának a vektortérben.

Ez a lépés **teljesen determinisztikus**: ugyanaz a bemenet mindig ugyanazt a bekezdés-listát adja, nincs benne semmi, ami API-hívástól vagy modell-változattól függene.

### 2. lépés — LLM-alapú szemantikus finomítás (`semantic-chunk-splitter.ts`)

A bekezdés-split önmagában egy valós hibát hagy nyitva: egy szerző időnként **egy bekezdésbe zsúfol két, tartalmilag elváló gondolatot** (pl. "A növény fényes helyet szeret. Öntözés terén hetente egyszer elég." — világítás + öntözés egy bekezdésben). Ha ez egyetlen chunk marad, a vektor-embeddingje mindkét témát "elmossa", és sem egy világítás-, sem egy öntözés-kérdésre nem lesz a lehető legpontosabb találat.

Erre fut le, csak a már meglévő bekezdéseken, egy célzott LLM-hívás (`gpt-5.4-mini`, `generateObject` egy `{chunks: string[]}` sémával):

- **Szabály**: ha a bekezdés egyetlen összefüggő gondolat, változatlanul egy elemű tömbként jön vissza; ha több, jelentésében elváló mondatcsoportot tartalmaz, szétvágja azokat — de **nem fogalmaz át, nem rövidít, nem told hozzá** semmit, csak a meglévő mondatokat csoportosítja újra.
- **Fail-safe**: ha a hívás hibázik (időtúllépés, rate limit), a bekezdés simán egy chunkként megy tovább, finomítás nélkül — ez sosem rosszabb, mint az 1. lépés önmagában, csak kevésbé specifikus. A pipeline emiatt sosem állhat meg egyetlen hibás LLM-hívás miatt.

## Miért nem mentünk tovább (a túlbonyolítás elkerülése)

Amit **szándékosan nem** vezettünk be:

- **Sliding-window / átfedéses chunkolás** — arra való, ha a chunk-határ elvágna egy fontos összefüggést két chunk között. Itt a heading + a bekezdés-határ már eleve szemantikus egység, és a rerank+grounding lépés amúgy is 5 chunköt lát egyszerre kontextusként — az átfedés csak duplikációt és extra embedding-költséget adna hozzá, érdemi minőségjavulás nélkül.
- **Hierarchikus / dokumentum-szintű összefoglaló chunk** — a cikkek elég rövidek (átlag ~26 chunk/dokumentum, egy chunk átlag 145 karakter — l. lentebb), nincs akkora dokumentum, ahol egy külön "összefoglaló szint" érdemi keresési előnyt adna.
- **Fix chunk-méret célzása tokenben** — a jelenlegi chunkok mérete 4–1195 karakter között szór (a tartalom természetes hossza szerint), és ez rendben van, mert a keresés amúgy sem karakterszámra, hanem tartalmi hasonlóságra optimalizál.

Ez a "jó stratégia a tudásbázishoz illik, nem a bevetett technikák számán múlik" elvet követi: a forrás már strukturált, ezért a chunkolás fő munkája a **meglévő struktúra megtartása**, és csak egy célzott, olcsó second-pass a **struktúrán belüli** téma-keveredés kijavítására.

## Valós számok a jelenlegi tudásbázison

(202 dokumentum, `seed/knowledge/*.md`, mérve a tényleges DB-állapoton és a `parseKnowledgeMarkdown` valódi kimenetén — nem becslés.)

| Mérőszám | Érték |
|---|---|
| Dokumentum | 202 |
| 1. lépés kimenete (nyers bekezdés, = a 2. lépés LLM-hívásainak száma) | 2953 |
| Végleges chunk (a 2. lépés után) | 5342 |
| Átlagos "szorzó" (végleges chunk / nyers bekezdés) | ~1,81 |
| Átlagos bekezdés-hossz | 264 karakter |
| Átlagos végleges chunk-hossz | 145 karakter |

A ~1,81-es szorzó azt mutatja, hogy a szemantikus finomítás **valóban aktívan dolgozik**, nem egy ritkán aktiválódó él-eset-védelem: átlagosan minden bekezdésből majdnem két chunk lesz — ami a domain jellegéből (sűrű, több apró tényt egy bekezdésbe sűrítő cikkek) egyenesen következik.

## Tesztelhetőség — a chunkolás determinisztikus, tehát tesztelhető

A stratégia két rétege két különböző tesztelési stílust kap:

**1. lépés — tisztán unit tesztelt, mock nélkül** (`chunking.spec.ts`):
- `extracts frontmatter metadata and uses the filename as slug`
- `splits the body into paragraphs tagged with the nearest preceding heading`
- `strips the marketing boilerplate footer so it never becomes a chunk`
- `drops trivial short lines (bylines, stray markers) that are not real content`
- `falls back to an empty paragraph list and filename-derived metadata when there is no frontmatter`

Mivel ez a lépés determinisztikus, ezek a tesztek **gyorsak, ingyenesek és minden CI-futáson lefutnak** — ha valaki megváltoztatja a bekezdés-split logikát, azonnal kiderül, ha egy regresszió becsúszik.

**2. lépés — mockolt modellel** (`semantic-chunk-splitter.spec.ts`):
- `returns the chunks produced by the model` — a hívó helyesen adja tovább a modell kimenetét.
- `returns a single chunk unchanged when the model finds no meaning-shift`
- `falls back to the original paragraph as a single chunk when the model call fails` — a fail-safe ág explicit tesztelve van, mockolt hibával.

**2. lépés — valódi API-hívással is** (`semantic-chunk-splitter.integration.spec.ts`, opcionális, csak ha van `OPENAI_API_KEY` a `.env`-ben, egyébként `describe.skip`):
- `splits a paragraph that crams two topically distinct sentences together` — egy valós, két egymástól tartalmilag független témát (kaktusz + páfrány) egy bekezdésbe zsúfoló szöveggel: elvárás `chunks.length >= 2`, és mindkét téma szava megjelenik az összefűzött kimenetben.
- `keeps a single-topic paragraph as one chunk` — egy valóban egytémás (aloe vera) bekezdés: elvárás pontosan 1 chunk.

Ez a két utolsó teszt adja meg a "mindig visszaellenőrizhető" garanciát: nem csak azt bizonyítja, hogy a kód *helyesen hívja meg* a modellt (ezt a mockolt tesztek is megtennék), hanem hogy a **stratégia ténylegesen működik** egy valódi hívással — ha a promptot valaki elrontja, vagy a modellváltás (pl. `gpt-5.4-mini` → egy másik modell) megváltoztatja a viselkedést, ez a teszt buktatja le, nem csak a mockolt verzió.
