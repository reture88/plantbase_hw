# Plantbase — ROI (megtérülési) elemzés

> Ez a dokumentum egy hipotetikus, de reális **5 fős iroda** esetére számolja ki a Plantbase agent bevezetésének várható megtakarítását, ahol mind az 5 fő korábban **teljes munkaidőben (napi 8 órában, folyamatosan)** kézzel kereste ki a növénykatalógusból az ügyféligényeknek megfelelő növényeket, és mostantól a Plantbase CLI-vel végzi ugyanezt a munkát.
>
> **Minden számadat becslés**, világosan jelölt feltételezésekre építve — nem mért, auditált adat. A módszertan (nem csak a végeredmény) szándékosan látható, hogy a feltételezések könnyen cserélhetők legyenek valós adatokra, ha rendelkezésre állnak.

---

## Vezetői összefoglaló

| Mutató | Érték |
|---|---|
| Időmegtakarítás megkeresésenként | 13 perc → 3 perc (**77%-os csökkenés**, ~4,3×-os gyorsulás) |
| Napi kapacitás fő/nap | 37 → 160 megkeresés (ugyanannyi munkaidővel) |
| Éves munkaóra-megtakarítás (jelenlegi forgalomra vetítve) | **~7 770 munkaóra/év** |
| Bérköltségben kifejezett érték (elméleti maximum) | **~28,6 millió HUF/év** |
| Konzervatív forgatókönyv (5→2 fő) megtakarítása | **~22,4 millió HUF/év** |
| Claude API üzemeltetési költség (ugyanerre a forgalomra) | ~270–570 ezer HUF/év |
| Megtérülési arány (ROI) | **~80–100× ** (minden 1 Ft API-költségre ~80-100 Ft bérköltség-megtakarítás jut) |
| Megtérülési idő | Gyakorlatilag azonnali (1. hónap) — nincs számottevő beruházási költség, az üzemeltetés messze a megtakarítás alatt marad |

---

## 1. Feltételezések

Minden feltételezés explicit és cserélhető, ha pontosabb belső adat áll rendelkezésre.

| Feltételezés | Érték | Megjegyzés |
|---|---|---|
| Létszám | 5 fő | a kérdés szerint |
| Napi munkaidő/fő | 8 óra = 480 perc | "folyamatosan" végzett feladat, a user megfogalmazása szerint |
| Munkanap/hó | 21 nap | szokásos hazai átlag |
| Munkanap/év | 252 nap | 21 × 12 |
| Bruttó havi bér (katalógus-kereső / ügyfélszolgálati munkakör) | 550 000 HUF/hó | becsült, 2026-os szintre |
| Munkáltatói szocho | 13% | jelenlegi hazai kulcs |
| Teljes munkáltatói költség/fő | 621 500 HUF/hó | 550 000 × 1,13 |
| Éves teljes költség/fő (1 FTE) | 7 458 000 HUF/év | 621 500 × 12 |
| Claude modell | `claude-sonnet-4-6` (a projekt `.env`-jében beállított modell) | ár: $3 / $15 per millió token (input/output) |
| Alternatíva költségérzékeny üzemre | `claude-haiku-4-5` | ár: $1 / $5 per millió token |
| USD/HUF árfolyam | 390 HUF/USD | illusztratív, aktuális árfolyammal cserélendő |

---

## 2. Feladatonkénti időösszehasonlítás

A feladat mindkét esetben ugyanaz: **ügyféligény elolvasása → megfelelő növény(ek) kiválasztása a katalógusból → válasz megfogalmazása az ügyfélnek.**

### Kézzel (korábban)

| Lépés | Idő |
|---|---|
| Ügyféligény elolvasása, értelmezése | 1,5 perc |
| Katalógus kézi böngészése/szűrése (fény, méret, büdzsé, házi kedvenc-biztonság stb. kritériumok egyidejű figyelembevétele, SQL-tudás nélkül) | 7 perc |
| Készlet és akció egyeztetése | 2 perc |
| Válasz megfogalmazása az ügyfélnek | 2,5 perc |
| **Összesen** | **13 perc** |

Ez összhangban van a `docs/brs-plantbase.md`-ben már rögzített becsléssel (10-15 perc/szoba kézzel egy lakberendezőnél) — itt egy dedikált, kizárólag ezzel foglalkozó csapatra általánosítva.

### Plantbase-szal (CLI ask parancs)

| Lépés | Idő |
|---|---|
| Ügyféligény átfogalmazása egy kérdéssé | 1 perc |
| Kérdés begépelése a CLI-be (`plantbase ask "..."`) | 0,5 perc |
| Válasz elolvasása, gyors ellenőrzése | 1 perc |
| Személyre szabás / véglegesítés az ügyfélnek | 0,5 perc |
| **Összesen** | **3 perc** |

Ez összhangban van a projekt eredeti KPI-jával (`docs/brs-plantbase.md`: "1 szoba < 5 perc az agenttel") — itt inkább 3 perces pontbecslést használunk, mivel a dedikált, gyakorlott irodai használat gyorsabb, mint az alkalmankénti lakberendezői használat.

**Nettó megtakarítás: 10 perc/megkeresés (77%).**

---

## 3. Napi kapacitás és a jelenlegi forgalom kiszolgálása

| | Kézzel | Plantbase-szal |
|---|---|---|
| Megkeresés/nap/fő | 480 / 13 ≈ **37** | 480 / 3 = **160** |
| Megkeresés/nap, 5 fő | **~185** | **~800** |

Mivel a leírás szerint az 5 fő eddig **folyamatosan**, teljes munkaidőben ezt csinálta, a jelenlegi tényleges kereslet ~185 megkeresés/nap-nak felel meg (ennyit tud kiszolgálni 5 fő kézzel, 8 órában).

**Ugyanennek a 185 megkeresésnek a kiszolgálásához Plantbase-szal szükséges összes munkaidő:**

```
185 megkeresés × 3 perc = 555 perc/nap (összesen, az egész csapatra)
555 perc / 480 perc = 1,16 FTE
```

Vagyis a **jelenlegi forgalom kiszolgálásához elméletben ~1,2 fő elegendő** lenne — a gyakorlatban biztonsági tartalékkal (csúcsidőszakok, betegszabadság, minőségellenőrzés) **2 fő** egy reális, védhető létszám.

---

## 4. Két megtérülési forgatókönyv

A tool ugyanazt a 10 perc/megkeresés megtakarítást hozza — a kérdés az, mire fordítja az iroda a felszabaduló kapacitást.

### A) Forgatókönyv: létszám-optimalizálás (a jelenlegi forgalom kiszolgálása kevesebb emberrel)

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
- Órabér-egyenértéken (621 500 HUF / 168 óra ≈ 3 699 HUF/óra): 7 770 × 3 699 ≈ **28 741 000 HUF/év**

A két számítási út (FTE-alapú és óra-alapú) ~28,6-28,7 millió HUF körül egyezik — ez az elméleti felső korlát; a 2 fős, tartalékkal számoló forgatókönyv (22,4 millió) a védhetőbb, konzervatív becslés.

### B) Forgatókönyv: kapacitásbővítés változatlan létszámmal (ugyanaz az 5 fő, több ügyfél)

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

### Éves lekérdezésszám (a jelenlegi ~185/nap forgalomra)

```
185 megkeresés/nap × 252 munkanap/év ≈ 46 620 lekérdezés/év
```

### Éves API-költség

| Modell | $/lekérdezés | Éves költség (USD) | Éves költség (HUF, 390 Ft/$) |
|---|---|---|---|
| `claude-sonnet-4-6` (a projektben beállított) | ~$0,015 | ~$700 | **~273 000 HUF/év** |
| `claude-haiku-4-5` (költségérzékeny alternatíva) | ~$0,005 | ~$233 | **~91 000 HUF/év** |

Ez a két érték **elenyésző** a 22,4-28,6 milliós bérköltség-megtakarításhoz képest — a Claude API díja a teljes megtakarítás **kevesebb mint 1,5%-a** még a drágább Sonnet-modellel is.

> Megjegyzés: ha az iroda a B) forgatókönyv szerint tényleges forgalomnövekedést szolgál ki (800 megkeresés/nap), az API-költség arányosan nő (~4,3×), de a bevétel oldali növekedés mellett ez továbbra sem számottevő tétel.

---

## 6. Nettó megtérülés

A konzervatív (A-forgatókönyv, 2 fő) és az elméleti maximum forgatókönyvre, Sonnet-áron:

| | Bruttó megtakarítás | API-költség | **Nettó megtakarítás/év** | ROI-arány |
|---|---|---|---|---|
| Konzervatív (5→2 fő) | 22 374 000 HUF | 273 000 HUF | **22 101 000 HUF** | **~82×** |
| Elméleti max (5→1,16 fő) | 28 639 000 HUF | 273 000 HUF | **28 366 000 HUF** | **~105×** |

Haiku-modellel az arány még kedvezőbb (~246× / ~314×), a válaszminőség rovására — érdemes A/B-tesztelni, hogy a katalógus-kérdések komplexitásához elég-e a gyorsabb, olcsóbb modell.

---

## 7. Egyéb, pénzben nehezen mérhető előnyök

- **Konzisztencia:** az agent mindig ugyanazokat a szabályokat követi (ár = `COALESCE(sale_price, price)`, raktárkészlet-ellenőrzés, stb.) — nincs emberi figyelmetlenségből adódó hiba.
- **Gyorsabb ügyfél-válaszidő:** 13 percről 3 percre csökkenő válaszidő közvetlenül jobb ügyfélélményt jelent, különösen sürgős/telefonos megkereséseknél.
- **Teljes auditálhatóság:** minden interakció naplózva (`logs/*.jsonl`) — a generált SQL, az eredmény és a végső válasz is visszakereshető, ami minőségbiztosításhoz és képzéshez is használható.
- **Skálázhatóság:** a `docs/brs-plantbase.md` szerint a következő lépés (webshop, ügyfélszolgálat, logisztika) ugyanerre a mintára épül — a felszabaduló kapacitás/tudás átvihető ezekre a területekre.
- **Munkavállalói elégedettség:** a repetitív, alacsony hozzáadott értékű katalógus-böngészés helyett a felszabaduló idő magasabb hozzáadott értékű munkára (ügyfélkapcsolat, tervezés, upsell) fordítható.

---

## 8. Korlátok és óvatossági megjegyzések

- **Minden időbecslés és bér-feltételezés illusztratív** — valós, mért adatokkal (tényleges válaszidő-napló, aktuális bértábla) pontosítandó.
- A modell csak a `products` katalógusra kérdez rá (docs/architektura.md hatókör); az agent **nem helyettesíti** az ügyfélkapcsolati/tanácsadói munka teljes egészét, csak a katalógus-keresési részt.
- A létszámcsökkentési forgatókönyv (A) szervezeti/HR-döntés, nem csak technikai kérdés — az itt szereplő szám a **technikailag elérhető** megtakarítást mutatja, nem ajánlás a végrehajtásra.
- Az API-költségbecslés egy tipikus, közepes bonyolultságú lekérdezésre vonatkozik; komplex, több körös (több tool-use iterációt igénylő) kérdéseknél a tényleges költség ennek többszöröse is lehet, bár ez a bérköltség-megtakarításhoz képest továbbra is elhanyagolható.
- Az USD/HUF árfolyam és a Claude API árazás időben változik — a `docs/roi.md` frissítendő, ha ezek érdemben elmozdulnak.
