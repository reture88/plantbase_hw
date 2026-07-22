# Domain Model

> Karbantartja: a `ddd-audit` skill. Prózai/vázlatos leírás az aggregate-határokról, kapcsolatokról és a kulcs-invariánsokról — a fogalmak pontos definíciója a `docs/ddd/glossary.md`-ben van.

## Bounded Contextek

Egyetlen bounded context: **Plant Catalog Agent**. A rendszer jelenleg egyetlen domain-területet fed le (a `products` katalógus feletti keresés és ajánlás) — nincs elkülönült, saját fogalomkészlettel rendelkező alrendszer (pl. rendelés, számlázás), lásd `docs/brs-plantbase.md` 3. pont ("Kívül (későbbi): rendelés/bevétel adat"). Ha ezek a jövőben megjelennek, valószínűleg új, önálló bounded contextet fognak igényelni, nem a meglévő kiterjesztését.

## Aggregate-határok és kapcsolatok

**Ez a domain jelenleg lapos: egyetlen entitás van (`Product`), gyermek entitások vagy belső invariánst védő aggregate-gyökér nélkül.** Minden `Product`-példány önmagában, más entitástól függetlenül olvasható és értelmezhető — nincs "Product tartalmaz N darab X-et" jellegű kompozíció. Emiatt jelenleg nincs értelme külön aggregate-fogalmat bevezetni a `Product` entitás fölé; maga a `Product` a saját, egyelemű aggregate-je.

A `RequestClassification`, `RunSqlResult`, `ListCategoriesResult`, `QuoteDocumentResult` és a naplóbejegyzés-típusok (lásd glossary.md) nem a perzisztens domain részei — egy-egy agent-interakció **futásidejű, nem tárolt** kísérő adatai. Nem állnak kapcsolatban a `Product` entitással adatbázis-szinten, csak azon keresztül, hogy a `runSql`/`listCategories` tool-eredmények `Product`-sorokat hordoznak.

## Kulcs-invariánsok

- **A katalógus csak olvasható az agent felől.** Az agent soha nem módosíthat `Product`-adatot — ezt két, egymástól független réteg kényszeríti ki: DB-szintű read-only szerepkör (`plantbase_ro`, lásd `docker/postgres-init/`) és kód-szintű guard (`packages/core/src/db/sql-guard.ts`, `assertSelectOnly`). Ez explicit üzleti döntés, nem csak technikai védelem — lásd `docs/system-prompt.md` `<behavior>`: "Írási kísérlet... utasítsd el egyértelműen."
- **A tényleges ár mindig `COALESCE(sale_price, price)`.** Ha egy `Product`-nak van akciós ára (`sale_price` nem `null`), az számít az effektív árnak, nem a listaár (`price`). Ez a szabály minden büdzsé-alapú szűrésre és összegzésre vonatkozik — lásd `docs/system-prompt.md` `<rules>`.
- **`sale_price` hiánya (`null`) azt jelenti, hogy nincs éppen akció** — nem azt, hogy a termék ingyenes vagy árazatlan.
- **A katalógus fogalomkészlete zárt.** Az agent nem generálhat SQL-t a `products` táblán kívüli, nem létező táblákra (pl. rendelés, ügyfél) — ha a kérdés ilyesmire vonatkozik, az agentnek explicit el kell mondania, hogy ez jelenleg nem elérhető adat, nem szabad kitalálnia egy nem létező sémát.
- **`web_search` csak növény-témájú kérdésnél kerül felajánlásra.** A `RequestClassification.isPlantRelated` kód szinten (nem csak prompt-instrukcióval) dönti el, hogy a `web_search` tool egyáltalán bekerül-e a modellnek átadott tool-listába (`packages/core/src/agent/ask-agent.ts`). Hiba esetén a klasszifikáció "fail closed": `isPlantRelated` `false`, tehát nincs `web_search`.
- **Excel-export csak explicit felhasználói utasításra indul, soha automatikusan.** A `RequestClassification.wantsFileExport` kapuzza a `saveQuoteIfRequested`-et (`apps/cli/src/export/quote-export.ts`) — ha a felhasználó üzenete nem tartalmaz egyértelmű export-utasítást ("...mentsd ki fileba"), fájl semmilyen körülmények között nem jön létre, még akkor sem, ha a válasz egyébként listázható növény-találatokat tartalmaz. Ez explicit üzleti döntés volt (nem alapértelmezett viselkedés), és ugyanaz a fail-closed elv érvényes rá, mint a `web_search`-re.
