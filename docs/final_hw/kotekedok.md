# Kérdéslap — a kötekedőknek

> A demón az IT-biztonsági vezető, a jogász és a területvezető is ül majd. A 6 kapott kérdésre és a 2 sajátra egy-egy bekezdésben válaszolunk, konkrétan a saját PoC-ra mutatva, nem általánosságban.

## A kapott 6 kérdés

**1. Milyen személyes adat kerül a rendszerbe, és melyik pontján tűnik el vagy anonimizálódik?**

Alapesetben **semmilyen**: a séma (`packages/db/prisma/schema.prisma`) csak `Product`, `KnowledgeDocument`, `KnowledgeChunk` és az új `Escalation` táblát tartalmazza — nincs `customers`, nincs bejelentkezés, nincs rendelés-adat. Az egyetlen kockázati pont az, ha az ügyfél saját magától ír PII-t (nevét, telefonszámát) a chat-mezőbe: ez a mai állapotban végigmegy a modellen és bekerül a lokális JSONL-naplóba is, redakció nélkül — ez egy ismert, dokumentált korlát, nem elhallgatott hiba. Nincs anonimizálási lépés, mert nincs mit anonimizálni: a rendszer sosem kér és sosem tárol azonosító adatot strukturáltan.

**2. Hol fut a modell, hova utazik az adat, és mi az, ami sosem hagyja el a saját környezetünket?**

Két külső hívás történik kérdésenként: Anthropic API (Claude Haiku 4.5, katalógus-válasz/HyDE/grounded válasz/eszkalációs döntés) és — csak tudásbázis-kérdésnél — OpenAI API (embedding + gpt-5.4-mini rerank). Mindkettő az Egyesült Államokban futó, hivatalos, hitelesített API. A kérdés szövege és a releváns katalógus-sorok/tudásbázis-chunkok mennek ki; **sosem megy ki** ügyfél-azonosító adat (mert nincs is), fizetési adat, vagy a `products` tábla nem-publikus mezője (ilyen amúgy sincs — l. adattérkép). A napló és az eszkalációs tábla (`escalations`) kizárólag a saját Postgres-adatbázisunkban marad, sosem küldjük tovább.

**3. Melyik lépésnél hagy jóvá ember, mit lát a döntés előtt, és mit tud visszavonni utána?**

Pontosan egy ponton: amikor a RAG grounding-lépés nem tud biztos választ adni (`grounded: false`), a `customer-agent.ts` **nem** ad ki automatikus (akár elutasító) végválaszt az ügyfélnek — helyette `createEscalation`-t hív, és a `/internal/escalations` nézeten egy munkatárs látja a kérdést + a rendszer rövid indoklását ("a tudásbázis nem tartalmazott elég releváns forrást"), és **ő fogalmazza meg és küldi el** a tényleges választ. Amíg a munkatárs nem hagyja jóvá, az ügyfél csak egy semleges várakozó üzenetet lát — nincs olyan út, ahol egy nem-grounded válasz automatikusan kimenne.

**4. Mi kerül naplóba, ki fér hozzá, és mennyi ideig marad meg?**

A kérdés teljes szövege, a válasz, a token-usage és az időzítés (`logs/*.jsonl`, `logs/rag/*.jsonl`), plusz az eszkalált esetek (`escalations` tábla: kérdés, kontextus, a munkatárs válasza, időbélyegek). **Ki fér hozzá ma**: bárki, akinek szerver-/DB-hozzáférése van (fejlesztő, üzemeltető) — nincs granuláris, szerepkör-alapú jogosultság a naplókon, ez elismert korlát. A belső eszkalációs API-végpontokat (`/api/internal/escalations*`) egy megosztott `INTERNAL_TOKEN` védi (`Authorization: Bearer`), ami nem teljes auth-rendszer, de konkrét, kódolt védelem a teljesen nyitott hozzáféréshez képest. **Megőrzési idő**: ma nincs retention-policy/purge-mechanizmus — ez roadmap-elem, javasolt érték pl. 90 nap.

**5. Mi történik, ha az agent téved, és mennyi idő alatt állítható vissza az előző állapot?**

Két védőréteg csökkenti a hiba esélyét: a grounding-kényszer (a válasz kizárólag a betöltött tudásbázisra/katalógusra alapulhat, nem "talál ki" semmit) és az emberi jóváhagyási pont bizonytalan esetben. Ha mégis rossz infó menne ki egy grounded válaszban, a teljes ügyfélirányú felület egyetlen env-változóval (`CUSTOMER_CHAT_ENABLED=false`) + egy szerver-újraindítással **percek alatt** leállítható — ekkor a `/api/customer/chat` és `/api/internal/escalations*` route-ok ténylegesen nem is regisztrálódnak (nem csak el vannak rejtve), a régi (emberi) ügyfélszolgálati csatorna érintetlen. Az eset utólag is visszakereshető a naplókból/az `escalations` táblából.

**6. Ki lesz a rendszer gazdája a bevezetés után, és miből fogja látni, hogy jól működik?**

Az **ügyfélszolgálat vezetője** (napi eszkaláció-kezelés, a mérési terv riportjainak elsődleges címzettje) + az **e-commerce csapat** (üzemeltetés). A `docs/final_hw/meresi-terv.md` heti automatikus összesítői mutatják a válaszidőt, az eszkalációs arányt és a grounded-arányt — ha ezek a pilot alatt tartósan romlanak (pl. eszkalációs arány 30-40% fölé megy), az konkrét, mért jel a bővítés/leállítás mérlegeléséhez, nem szubjektív benyomás.

## Két saját kérdés

**7. Mi történik, ha az ügyfél megpróbálja kicsalni a rendszerpromptot, vagy más ügyfelek/belső adatok után kérdez (prompt injection / eszköz-felderítés)?**

A grounded system prompt (`packages/core/src/rag/rag-agent.ts`) explicit kizárólag a betöltött kontextusra korlátozza a választ, de promptszinten nincs külön "ne fedd fel a rendszerpromptot" védelem — ez tudatos, dokumentált döntés, nem hiba: nincs is olyan tool vagy adat a customer-ágon, amit egy sikeres injection kiszivárogtathatna (nincs `customers` tábla, a `runSql` DB-role-szinten is csak a `products` táblára korlátozott, függetlenül attól, mit "hisz" a modell a promptban). Ez ugyanaz a becsületes "tudatosan nyitva hagyott, alacsony kockázatú rés" mintázat, mint amit az oktatói referencia-implementáció OWASP red-team PR-ja is dokumentált a `tool-discovery` leletnél — a felderítés lehetséges, de mögötte nincs tényleges adat- vagy jogosultság-kockázat.

**8. Mi van, ha egyszerre nagyon sokan (pl. egy hírlevél-kampány után) kérdeznek, és megtelik az eszkalációs sor emberi kapacitás nélkül?**

A rate limit (`@fastify/rate-limit`, 20 kérés/10 perc/IP a `/api/customer/chat`-en) technikailag védi a szervert és az API-költséget túlterheléstől, de az **emberi** eszkalációs-sor kapacitása önálló kérdés, amit a technikai limit nem old meg. Ezért indul a rollout terv szándékosan szűk pilottal (top 30 termék/cikk, egy webshop-oldal, néhány tucat kérdés/hét), és a mérési terv "eszkalációs arány" + "eszkalált esetek megoldási ideje" mutatója pont ezt figyeli, mielőtt teljes forgalomra nyitnánk. Ha a sor élesben mégis torlódna, a `CUSTOMER_CHAT_ENABLED` kill-switch percek alatt visszaállítja a régi, kizárólag emberi ügyfélszolgálati utat.
