# Plantbase — ROI (megtérülési) elemzés

> Ez a dokumentum egy hipotetikus, de reális **5 fős lakberendező-iroda** esetére számolja ki a Plantbase agent bevezetésének várható megtakarítását. **Két forgatókönyvet** tartalmaz, egymás mellett, azonos módszertannal:
>
> - **„BRS-pontos volumen"** (elsődleges) — a `docs/brs-plantbase.md`-ben ténylegesen leírt terhelést használja (havi 5 ügyfél/fő, ~15 szoba/hó/fő), ahol a katalógus-keresés a munkaidőnek csak **töredéke**, nem főállás.
> - **„Magas volumen"** (kiegészítő, hipotetikus) — azt modellezi, mi történne, ha mind az 5 fő **teljes munkaidőben, kizárólag** katalógus-kereséssel foglalkozna. Ez **nem** a jelenlegi BRS-scope, hanem a `docs/brs-plantbase.md` 2. pontjában említett jövőbeli skálázódási irány (ecommerce, ügyfélszolgálat) illusztrációja — hova nőhet a hatás, ha a minta nagyobb volumenre kerül.
>
> **Minden számadat becslés**, világosan jelölt feltételezésekre építve — nem mért, auditált adat. A módszertan (nem csak a végeredmény) szándékosan látható, hogy a feltételezések könnyen cserélhetők legyenek valós adatokra, ha rendelkezésre állnak.

---

## Vezetői összefoglaló

### „BRS-pontos volumen" (elsődleges — ez a jelenlegi brief tényleges terhelése)

| Mutató | Érték |
|---|---|
| Időmegtakarítás megkeresésenként | 13 perc → 3 perc (**77%-os csökkenés**) |
| Volumen | 15 szoba/hó/fő × 5 fő = 75 szoba/hó = **900 szoba/év** |
| Megtakarított munkaidő | **~150 munkaóra/év** (iroda szinten összesen — kevesebb mint 1 FTE, ~7,4%-a egy teljes állásnak) |
| Bérköltségben kifejezett érték | **~555 000 HUF/év** |
| Claude API üzemeltetési költség | ~1 800–5 300 HUF/év |
| Nettó megtakarítás | **~550 000 HUF/év** |
| Megtérülési arány (ROI) | **~105× (Sonnet) / ~316× (Haiku)** |
| Jellege | **Nem létszám-optimalizálás** (a felszabaduló idő <1 FTE) — felszabaduló kapacitás magasabb hozzáadott-értékű munkára |

### „Magas volumen" (kiegészítő, hipotetikus — teljes munkaidős keresés, skálázódási irány illusztrálására)

| Mutató | Érték |
|---|---|
| Volumen | ~185 megkeresés/nap = **~46 620 megkeresés/év** (~52×-e a BRS-pontos volumennek) |
| Éves munkaóra-megtakarítás | **~7 770 munkaóra/év** |
| Konzervatív forgatókönyv (5→2 fő) megtakarítása | **~22,4 millió HUF/év** |
| Elméleti maximum (5→1,16 fő) | **~28,6 millió HUF/év** |
| Claude API üzemeltetési költség | ~270–570 ezer HUF/év |
| Megtérülési arány (ROI) | **~82–105× (Sonnet) / ~246–314× (Haiku)** |

> **Fontos módszertani megfigyelés:** a két forgatókönyv ROI-*aránya* nagyságrendileg hasonló (~80-105×) — ez a lineáris skálázás (azonos egységnyi megtakarítás, azonos egységnyi API-költség) matematikai következménye, nem tartalmi egyezés. Ami **ténylegesen eltér**, az az abszolút forint-érték: a BRS-pontos volumennél ~555 000 HUF/év, a magas-volumenű forgatókönyvnél ~22-28 millió HUF/év — kb. **40-50×-es** eltérés, nagyságrendileg összhangban a jelenlegi terhelés és egy teljes munkaidős csapat közötti ~52×-es volumen-különbséggel.

---

## 1. Feltételezések

Minden feltételezés explicit és cserélhető, ha pontosabb belső adat áll rendelkezésre.

| Feltételezés | Érték | Megjegyzés |
|---|---|---|
| Létszám | 5 fő | a kérdés szerint; mindegyik lakberendező önálló ügyfélkörrel dolgozik |
| Napi munkaidő/fő | 8 óra = 480 perc | teljes munkaidő |
| Munkanap/hó | 21 nap | szokásos hazai átlag |
| Munkanap/év | 252 nap | 21 × 12 |
| Bruttó havi bér (lakberendező / katalógus-kereső munkakör) | 550 000 HUF/hó | becsült, 2026-os szintre |
| Munkáltatói szocho | 13% | jelenlegi hazai kulcs |
| Teljes munkáltatói költség/fő | 621 500 HUF/hó | 550 000 × 1,13 |
| Éves teljes költség/fő (1 FTE) | 7 458 000 HUF/év | 621 500 × 12 |
| Órabér-egyenérték | ~3 699 HUF/óra | 621 500 / 168 óra (havi munkaóra) |
| Claude modell | `claude-sonnet-4-6` (a projekt `.env`-jében beállított modell) | ár: $3 / $15 per millió token (input/output) |
| Alternatíva költségérzékeny üzemre | `claude-haiku-4-5` | ár: $1 / $5 per millió token |
| USD/HUF árfolyam | 390 HUF/USD | illusztratív, aktuális árfolyammal cserélendő |
| *— BRS-pontos volumen —* | | |
| Ügyfél/hó/fő | 5 | `docs/brs-plantbase.md`: "havi 5 ügyfél" |
| Szoba/ügyfél | 3 | `docs/brs-plantbase.md`: "1 ügyfél átlagosan 3 szoba" |
| Szoba/hó/fő | 15 | 5 × 3 — egyezik a BRS "~15 szoba/hó" megjegyzésével |
| Szoba/hó, iroda (5 fő) | 75 | 15 × 5 |
| Szoba/év, iroda | 900 | 75 × 12 |

---

## 2. Feladatonkénti időösszehasonlítás

A feladat mindkét forgatókönyvben (és mindkét volumen-becslésben) ugyanaz: **ügyféligény elolvasása → megfelelő növény(ek) kiválasztása a katalógusból → válasz megfogalmazása az ügyfélnek.** Az alábbi, egységnyi (1 szobára vetített) időbecslés közös alapja minden további számításnak.

### Kézzel (korábban)

| Lépés | Idő |
|---|---|
| Ügyféligény elolvasása, értelmezése | 1,5 perc |
| Katalógus kézi böngészése/szűrése (fény, méret, büdzsé, házi kedvenc-biztonság stb. kritériumok egyidejű figyelembevétele, SQL-tudás nélkül) | 7 perc |
| Készlet és akció egyeztetése | 2 perc |
| Válasz megfogalmazása az ügyfélnek | 2,5 perc |
| **Összesen** | **13 perc** |

Ez összhangban van a `docs/brs-plantbase.md`-ben már rögzített becsléssel (10-15 perc/szoba kézzel) — a 13 perc a sáv középértéke.

### Plantbase-szal (CLI ask parancs)

| Lépés | Idő |
|---|---|
| Ügyféligény átfogalmazása egy kérdéssé | 1 perc |
| Kérdés begépelése a CLI-be (`plantbase ask "..."`) | 0,5 perc |
| Válasz elolvasása, gyors ellenőrzése | 1 perc |
| Személyre szabás / véglegesítés az ügyfélnek | 0,5 perc |
| **Összesen** | **3 perc** |

Ez összhangban van a projekt eredeti KPI-jával (`docs/brs-plantbase.md`: "1 szoba < 5 perc az agenttel") — itt inkább 3 perces pontbecslést használunk, mivel a gyakorlott használat gyorsabb, mint az első próbálkozások.

**Nettó megtakarítás: 10 perc/megkeresés (77%).**

---

## 3. Forgatókönyv „BRS-pontos volumen" (elsődleges — a jelenlegi iroda tényleges terhelése)

Ez a forgatókönyv a `docs/brs-plantbase.md`-ben ténylegesen megadott volument használja, nem egy feltételezett teljes munkaidős keresési tevékenységet.

### 3.1 Volumen és időmegtakarítás

| | Kézzel | Plantbase-szal |
|---|---|---|
| Idő/szoba | 13 perc | 3 perc |
| Idő/hó/fő (15 szoba/hó/fő) | 195 perc = **3,25 óra** | 45 perc = **0,75 óra** |
| Idő/hó, iroda (5 fő, 75 szoba/hó) | 975 perc = **16,25 óra** | 225 perc = **3,75 óra** |
| Idő/év, iroda (900 szoba/év) | 11 700 perc = **195 óra** | 2 700 perc = **45 óra** |

> **Konzisztencia-ellenőrzés:** a 3,25 óra/hó/fő kézi keresési idő pontosan a `docs/brs-plantbase.md`-ben megadott "~2,5-3,75 óra/hó" sávba esik — ez megerősíti, hogy a 13 perces egységidő-becslés (2. fejezet) reális.

**Megtakarított munkaidő, iroda szinten: 750 perc/hó = 12,5 óra/hó = 150 óra/év.**

### 3.2 Mit jelent ez a gyakorlatban: kapacitás, nem létszám

150 óra/év a teljes 5 fős iroda éves munkaóra-keretének (5 × 2 016 óra/év = 10 080 óra/év) mindössze **~1,5%-a**, egyetlen FTE éves óraszámának (2 016 óra/év) pedig **~7,4%-a**. Ez a volumen **nem indokol létszám-optimalizálást** — ellentétben a lentebbi „Magas volumen" forgatókönyvvel, itt a felszabaduló idő reálisan a **meglévő munkakörön belül** hasznosul: több idő ügyfélkapcsolatra, tervezésre, több ügyfél kiszolgálására ugyanazzal a létszámmal.

### 3.3 Bérköltségben kifejezett érték

```
150 óra/év × 3 699 HUF/óra ≈ 554 850 HUF/év
```

Kereszt-ellenőrzés FTE-arányosan: 150 óra / 2 016 óra (1 FTE/év) ≈ 0,0744 FTE × 7 458 000 HUF ≈ **554 900 HUF/év** — a két számítási út egyezik.

---

## 4. Forgatókönyv „Magas volumen" (kiegészítő, hipotetikus — teljes munkaidős keresés)

> Ez a forgatókönyv **nem** a jelenlegi BRS-scope-ot írja le. Azt modellezi, mi történne, ha az 5 fő **teljes munkaidőben, kizárólag** katalógus-kereséssel foglalkozna — relevánsabb a `docs/brs-plantbase.md` 2. pontjában jelzett jövőbeli skálázódási irányhoz (ecommerce, ügyfélszolgálat), mint a jelenlegi lakberendező-iroda napi működéséhez.

### 4.1 Napi kapacitás és a feltételezett forgalom

| | Kézzel | Plantbase-szal |
|---|---|---|
| Megkeresés/nap/fő | 480 / 13 ≈ **37** | 480 / 3 = **160** |
| Megkeresés/nap, 5 fő | **~185** | **~800** |

Ha az 5 fő eddig **folyamatosan**, teljes munkaidőben ezt csinálta volna, a feltételezett forgalom ~185 megkeresés/nap-nak felel meg (ennyit tud kiszolgálni 5 fő kézzel, 8 órában) — évesítve **~46 620 megkeresés/év**, ami **~52×-e** a fenti BRS-pontos 900 szoba/évnek.

**Ugyanennek a 185 megkeresésnek a kiszolgálásához Plantbase-szal szükséges összes munkaidő:**

```
185 megkeresés × 3 perc = 555 perc/nap (összesen, az egész csapatra)
555 perc / 480 perc = 1,16 FTE
```

Vagyis ebben a hipotetikus forgatókönyvben a forgalom kiszolgálásához elméletben ~1,2 fő elegendő lenne — a gyakorlatban biztonsági tartalékkal (csúcsidőszakok, betegszabadság, minőségellenőrzés) **2 fő** egy reális, védhető létszám.

### 4.2 Két megtérülési al-forgatókönyv

A tool ugyanazt a 10 perc/megkeresés megtakarítást hozza — a kérdés az, mire fordítja az iroda a felszabaduló kapacitást.

#### A) Létszám-optimalizálás (a feltételezett forgalom kiszolgálása kevesebb emberrel)

| | Érték |
|---|---|
| Létszám előtte / utána | 5 fő → **2 fő** (konzervatív, tartalékkal) |
| Felszabaduló FTE | 3 fő |
| Éves bérköltség-megtakarítás | 3 × 7 458 000 = **22 374 000 HUF/év** |

Az elméleti maximum (ha szigorúan az 1,16 FTE-s minimumig mennénk, 5 → 1,16 fő):

| | Érték |
|---|---|
| Felszabaduló FTE (elméleti) | 3,84 fő |
| Éves bérköltség-megtakarítás (elméleti max) | 3,84 × 7 458 000 ≈ **28 639 000 HUF/év** |

Keresztellenőrzés munkaóra-alapon (ugyanerre a 185/napos forgalomra):
- Megtakarított idő: (185 × 13 perc) − (185 × 3 perc) = 1 850 perc/nap = **30,8 óra/nap**
- Évesítve: 30,8 óra × 252 munkanap ≈ **7 770 munkaóra/év**
- Órabér-egyenértéken: 7 770 × 3 699 ≈ **28 741 000 HUF/év**

A két számítási út (FTE-alapú és óra-alapú) ~28,6-28,7 millió HUF körül egyezik — ez az elméleti felső korlát; a 2 fős, tartalékkal számoló forgatókönyv (22,4 millió) a védhetőbb, konzervatív becslés.

#### B) Kapacitásbővítés változatlan létszámmal (ugyanaz az 5 fő, több ügyfél)

| | Érték |
|---|---|
| Létszám | 5 fő (változatlan) |
| Napi kapacitás előtte / utána | 185 → **800 megkeresés/nap** (4,3×) |

Itt nincs közvetlen bérmegtakarítás, hanem **elkerült felvétel**: ugyanazt a 4,3×-os forgalomnövekedést hagyományos létszámbővítéssel kb. 4 új kollégával lehetne csak kiszolgálni — ennek elmaradó bérköltsége (4 × 7 458 000 ≈ 29,8 millió HUF/év) a tényleges megtakarítás, feltéve hogy az üzleti kereslet ténylegesen ennyire nő.

---

## 5. Üzemeltetési költség (Claude API)

A becslés módszertana (átlagos lekérdezésenkénti token-felhasználás a teljes SQL-agent tool-use loopra, B3 fázis):

| Komponens | Becsült token |
|---|---|
| System prompt (`schema-context.ts`, XML-tagelt) | ~700 |
| Tool-definíciók (`runSql` + `listCategories`) | ~200 |
| Felhasználói kérdés | ~30 |
| 1. kör kimenet (SQL tool-use) | ~120 |
| Tool-eredmény (SQL sorok, becsült minta) | ~1 200 |
| 2. kör kimenet (végleges NL válasz) | ~200 |
| **Input összesen (2 kör)** | **~3 200 token** |
| **Output összesen (2 kör)** | **~350 token** |
| **$/lekérdezés (Sonnet)** | **~$0,015** |
| **$/lekérdezés (Haiku)** | **~$0,005** |

### Éves API-költség mindkét forgatókönyvre

| Forgatókönyv | Lekérdezés/év | Modell | Éves költség (USD) | Éves költség (HUF, 390 Ft/$) |
|---|---|---|---|---|
| BRS-pontos volumen | 900 | `claude-sonnet-4-6` | ~$13,5 | **~5 300 HUF/év** |
| BRS-pontos volumen | 900 | `claude-haiku-4-5` | ~$4,5 | **~1 800 HUF/év** |
| Magas volumen (hipotetikus) | 46 620 | `claude-sonnet-4-6` | ~$700 | **~273 000 HUF/év** |
| Magas volumen (hipotetikus) | 46 620 | `claude-haiku-4-5` | ~$233 | **~91 000 HUF/év** |

Mindkét forgatókönyvben az API-díj **elenyésző** a bérköltségben kifejezett megtakarításhoz képest.

> Megjegyzés: ha az iroda a 4.2/B al-forgatókönyv szerint tényleges forgalomnövekedést szolgál ki (800 megkeresés/nap), az API-költség arányosan nő (~4,3×), de a bevétel oldali növekedés mellett ez továbbra sem számottevő tétel.

---

## 6. Nettó megtérülés — mindkét forgatókönyv összevetve

| Forgatókönyv | Bruttó megtakarítás/év | API-költség/év (Sonnet) | **Nettó megtakarítás/év** | ROI-arány (Sonnet) |
|---|---|---|---|---|
| **BRS-pontos volumen** | 554 850 HUF | 5 300 HUF | **~549 600 HUF** | **~105×** |
| Magas volumen — konzervatív (5→2 fő) | 22 374 000 HUF | 273 000 HUF | **22 101 000 HUF** | **~82×** |
| Magas volumen — elméleti max (5→1,16 fő) | 28 639 000 HUF | 273 000 HUF | **28 366 000 HUF** | **~105×** |

Haiku-modellel mindhárom sor ROI-aránya tovább javul (a BRS-pontos ~316×-ra, a magas-volumenű forgatókönyvek ~246-314×-ra), a válaszminőség rovására — érdemes A/B-tesztelni, hogy a katalógus-kérdések komplexitásához elég-e a gyorsabb, olcsóbb modell.

**A lényeg:** a ROI-*arány* mindhárom sorban hasonló nagyságrendű (~82-105×) — ez a lineáris skálázás matematikai következménye (1. fejezet megjegyzése), nem azt jelenti, hogy a két forgatókönyv üzletileg egyenértékű. Az **abszolút forint-érték** a döntő különbség: a BRS-pontos forgatókönyv ~550 ezer HUF/év, a magas-volumenű ~22-28 millió HUF/év — utóbbi csak akkor realizálódik, ha az iroda ténylegesen a leírt, jelentősen magasabb volumenre skálázódik.

---

## 7. Egyéb, pénzben nehezen mérhető előnyök

- **Konzisztencia:** az agent mindig ugyanazokat a szabályokat követi (ár = `COALESCE(sale_price, price)`, raktárkészlet-ellenőrzés, stb.) — nincs emberi figyelmetlenségből adódó hiba.
- **Gyorsabb ügyfél-válaszidő:** 13 percről 3 percre csökkenő válaszidő közvetlenül jobb ügyfélélményt jelent, különösen sürgős/telefonos megkereséseknél.
- **Teljes auditálhatóság:** minden interakció naplózva (`logs/*.jsonl`) — a generált SQL, az eredmény és a végső válasz is visszakereshető, ami minőségbiztosításhoz és képzéshez is használható.
- **Skálázhatóság:** a `docs/brs-plantbase.md` szerint a következő lépés (webshop, ügyfélszolgálat, logisztika) ugyanerre a mintára épül — ekkor válik relevánssá a fenti „Magas volumen" forgatókönyv.
- **Munkavállalói elégedettség:** a repetitív, alacsony hozzáadott értékű katalógus-böngészés helyett a felszabaduló idő magasabb hozzáadott értékű munkára (ügyfélkapcsolat, tervezés, upsell) fordítható — ez a BRS-pontos forgatókönyv esetén a **fő** érték, nem a bérköltség-megtakarítás.

---

## 8. Korlátok és óvatossági megjegyzések

- **Minden időbecslés és bér-feltételezés illusztratív** — valós, mért adatokkal (tényleges válaszidő-napló, aktuális bértábla) pontosítandó.
- **A két forgatókönyv nem egyenrangú a jelenlegi scope szempontjából**: a „BRS-pontos volumen" tükrözi a `docs/brs-plantbase.md`-ben ténylegesen leírt terhelést, a „Magas volumen" egy hipotetikus, jövőbeli (ecommerce/ügyfélszolgálati) skálázódási irány illusztrációja — a ~22-28 milliós megtakarítás **csak akkor** realizálódik, ha az iroda ténylegesen erre a magasabb volumenre nő; a jelenlegi állapotot a ~550 ezer HUF/éves szám írja le pontosabban.
- A modell csak a `products` katalógusra kérdez rá (docs/architektura.md hatókör); az agent **nem helyettesíti** az ügyfélkapcsolati/tanácsadói munka teljes egészét, csak a katalógus-keresési részt.
- A „Magas volumen" forgatókönyv létszámcsökkentési al-forgatókönyve (4.2/A) szervezeti/HR-döntés, nem csak technikai kérdés — az ott szereplő szám a **technikailag elérhető** megtakarítást mutatja, nem ajánlás a végrehajtásra. A „BRS-pontos volumen" forgatókönyvnél ez fel sem merül, mivel a felszabaduló idő (~150 óra/év) jóval 1 FTE alatt marad.
- Az API-költségbecslés egy tipikus, közepes bonyolultságú lekérdezésre vonatkozik; komplex, több körös (több tool-use iterációt igénylő) kérdéseknél a tényleges költség ennek többszöröse is lehet, bár ez a bérköltség-megtakarításhoz képest továbbra is elhanyagolható mindkét forgatókönyvben.
- Az USD/HUF árfolyam és a Claude API árazás időben változik — a `docs/roi.md` frissítendő, ha ezek érdemben elmozdulnak.
