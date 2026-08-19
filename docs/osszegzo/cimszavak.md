
## HF1 — Plantbase alap-agent

**Alaprendszer - toolok**
- `runSql` — a modell ezzel tud lekérdezni a növénykatalógusból, de csak olvasásra (`SELECT`);
  ezt két, egymástól független szint is kikényszeríti: a kódunk és maga az adatbázis-jogosultság is.
- `listCategories` — saját fejlesztésű eszköz, ami egyetlen hívással kilistázza az összes
  termékkategóriát a katalógusból.

**Bővítések**
- Dokumentum-exportáló képesség — a modell egy elszigetelt, szerver-oldali környezetben
  ténylegesen megírja és lefuttatja a fájlgeneráló kódot, és ebből kész Excel-árajánlatot vagy
  PDF-et készít.
- Webes keresés — Ha extra infó szükséges a termékről.

**A probléma:**
- A probléma: a webes keresés és a fájl-export használata pénzbe kerül és kockázatot is hordoz,
  ezért nem árulhatja fel a rendszer minden kérdésnél — de túl szigorú szűrés jogos kéréseket is
  elutasítana.

**A megoldás(packages/core/src/agent/request-classifier.ts):**
- A megoldás egy külön, olcsó "előszűrő" lépés/agent/apró LLM-hívás —, ami két egyszerű igen/nem kérdésre válaszol: növény-témájú-e a kérdés, illetve kifejezetten kért-e a felhasználó fájlba mentést.
- Az export-kérdésnél a szabály szándékosan szigorú: önmagában egy "listázd ki" kérés nem elég,
  csak az explicit "mentsd el/exportáld" szándék számít — enélkül minden egyszerű listázás
  felesleges fájlgenerálást indítana.
- Ha maga az előszűrő hívás hibázik (pl. túlterhelés miatt), a rendszer inkább nem enged be
  egyetlen drágább eszközt sem, mintsem hibából túl engedékeny legyen.
- A helyes kalibrációt automatikus tesztekkel bizonyítottuk: külön teszteset van egy egyértelmű
  növény-kérdésre, egy explicit export-kérésre, egy témán kívüli kérdésre, és a hibaesetre is.

---

## HF3 — RAG pipeline

**Kétlépcsős chunking** *(a tudásbázis feldarabolása kereshető egységekre)*
1. Első lépés — egyszerű, szabály-alapú vágás: a cikk saját tagolása (címsorok, bekezdéshatárok)
   mentén daraboljuk fel a szöveget, modellhívás nélkül.
2. Második lépés — egy kisegítő AI-modell megnézi az egyes bekezdéseket, és ha egy bekezdés
   több, egymástól tartalmilag elváló témát zsúfol össze (pl. egy mondatban a fényigényről, a
   következőben már az öntözésről beszél), akkor a bekezdést téma szerint szétbontja külön
   egységekre — mindegyik így kapott egység saját, önálló keresési egységgé (chunk) válik.
   Fontos szabály: a modell csak *szétválogat*, nem fogalmaz át és nem told hozzá semmit.
- Ennek mérhető hatása: a nyers 2953 bekezdésből végül 5342 önálló keresési egység lett — ez
  mutatja, hogy a második lépés valóban sok esetben talált szétválasztandó, kevert bekezdést.
- Erre a lépésre egy olcsóbb, kisegítő modellt (`gpt-5.4-mini`) használunk, mert ez a feladat nem
  kreatív szövegírás, hanem egy egyszerű, strukturált döntéssorozat, amire egy olcsóbb modell is
  elég megbízható.

**HyDE**  — keresés előtt a rendszer generál egy hipotetikus,
"mintha egy cikkből származna" válaszbekezdést, és ennek a tartalmával keres a tudásbázisban —
nem a nyers kérdéssel. Ez azért hatékonyabb, mert egy válasz-jellegű szöveg jobban hasonlít
ahhoz, ami ténylegesen a tudásbázisban van, mint egy rövid kérdés.

**Rerank — index-alapú visszaadás** 
- A probléma, amire ez válasz: ha az újrarangsoroló lépés a talált szövegrészeket saját szavaival
  adná vissza, fennállna a kockázata, hogy a modell akaratlanul átírja, kihagy vagy hozzátold
  valamit az eredeti szöveghez (hallucináció).
- Ezt úgy zártuk ki, hogy a modell ennél a lépésnél kizárólag a szövegrészek sorszámait
  (azonosítóit) adhatja vissza, új sorrendben — magát a szöveget soha nem látja viszont
  "megfogalmazandó" formában. Az eredeti, változatlan szöveget utána a kódunk kapcsolja vissza a
  kapott sorszámokhoz. Ez a szabály nem csak egy kérés a promptban, hanem technikailag ki van
  kényszerítve: a modell válaszformátuma eleve csak számokat enged meg.

**Grounding (forráshű válaszadás)** — minden válaszhoz kötelezően csatoljuk, honnan (melyik
cikkből) származik az információ. Ha a tudásbázisban nincs elég releváns tartalom a kérdés
megválaszolásához, a rendszer ezt kimondja a felhasználónak ahelyett, hogy találgatna — ez nem
utólagos kiegészítés, hanem a válaszgenerálás egyik kötelezően beépített ága.


**Mit nyertünk a kétlépcsős chunkinggal, és mit adtunk fel cserébe?**
- Amit nyertünk: pontosabb keresési találatokat. Ha egy bekezdés több témát kever, annak egyetlen
  numerikus reprezentációja "elmossa" mindkét témát, és egyik kérdésre sem lesz igazán pontos
  találat. A szétbontás után minden keresési egység egy konkrét témát képvisel, így élesebb a
  találat.
- Amit feladtunk: mivel a szétbontás egy AI-modell döntése, ez a lépés nem száz százalékig
  kiszámítható (nem "mindig ugyanaz jön ki", mint egy egyszerű kódos szabálynál). Ha a háttérben
  használt modell egy jövőbeli frissítés miatt kicsit másképp dönt, ugyanabból a szövegből
  elméletileg máshogy darabolt keresési egységek jöhetnek ki, ami befolyásolhatja a
  kiértékeléshez használt teszt-kérdéssor eredményeinek stabilitását is.

---

## HF5 — Ügyfél-eszkalációs PoC

**Melyik ügyfélszolgálati problémát oldja meg (a lehetséges tíz közül kettőt)**
- Munkaidőn kívül is azonnali választ kap a látogató, nem kell várnia.
- Személyre szabott növénygondozási tanácsot mindenki kap, nem csak a legnagyobb megrendelők.

**Védelmi mechanizmusok a nyilvánosan elérhető ügyfél-chaten**
- Sebesség-korlátozás: ugyanaz a látogató 10 percen belül legfeljebb 20 kérdést tehet fel — ez
  csak a nyilvános, ügyfél felőli oldalt érinti, a belső, munkatársi felületet nem.
- Vészleállító kapcsoló: egyetlen beállítással a teljes ügyfél-chat funkció ténylegesen
  lekapcsolható a szerveren — nem csak elrejtjük a felületről, hanem a mögöttes szolgáltatás sem
  fut tovább.
- A tudásbázisból adott válaszokhoz itt is elérhető a letölthető PDF-export.

**Az eszkaláció (emberi átadás) működése** 
- Egyetlen dolog dönt arról, hogy egy kérdés emberhez kerül-e: sikerült-e a tudásbázisból
  megbízható, forrással alátámasztott választ adni rá.
- Ha nem sikerült, a rendszer szándékosan **nem** próbál internetes keresésből találgatni
  (szemben a belső, munkatársi ügynökkel, ahol ez engedélyezett) — ehelyett az eset automatikusan
  bekerül egy belső várólistára, a látogató üzenetet kap, hogy egy kollégánk hamarosan válaszol,
  és a felület automatikusan figyeli, mikor érkezik meg a válasz. A munkatárs a belső felületen
  látja és hagyja jóvá a végleges választ.

**Hogyan döntöttük el, mi kerüljön ügyfélszolgálat elé, mi nem?**
- A jelenlegi megvalósításban a döntés egyetlen technikai feltételen múlik: van-e elég megbízható
  forrás a tudásbázisban a válaszhoz. Ha nincs, a rendszer inkább embert kérdez, mintsem
  találgasson — ez egy tudatosan óvatos alapállás.
- Ennek van egy nyitott hiányossága: a rendszer ma nem tesz különbséget
  aközött, hogy egy meg nem válaszolt kérdés (a) valóban jogos, csak épp hiányzik hozzá az infó a
  tudásbázisból — ezt tényleg érdemes egy munkatársnak megválaszolnia —, vagy (b) teljesen
  irreleváns, a témától idegen kérdés, amit felesleges lenne a munkatársi sorba terhelni. Ma
  mindkét eset ugyanúgy, egyformán eszkalálódik.
- Fejlesztési javaslat erre: egy külön, célzottan erre kialakított AI-előszűrő lépés az emberi
  átadás elé, ami eldönti, hogy a kérdés egyáltalán érdemben kapcsolódik-e a céghez/termékkörhöz.
  Ha igen, mehet tovább a munkatárshoz (mint ma); ha nem, a látogató egy udvarias
  elutasító üzenetet kap, munkatársi terhelés nélkül.
