# Business case — Plantbase ügyfélirányú gondozási asszisztens

> 8 "dia", vezetői körnek szánva. Szponzor: e-commerce igazgató. Folyamatgazda: ügyfélszolgálat vezetője. Készítette: fejlesztés. Dátum: 2026.08.14.
>
> Minden szám címkézve: **MÉRT** (tényleges naplóból/kiértékelésből), **BECSÜLT** (a rendszer jellemzőiből levezetett), **ÖKÖLSZÁM** (mert nincs éles ügyfélszolgálati adatunk — a Plantbase eddig belső eszköz volt). A haszonra óvatos, a költségre felső becslés.

## 1. Egy mondat, amit a szponzor felmond

> A vásárló a webshopban azonnal, 0-24-ben választ kap arra, melyik növény való hozzá és hogyan gondozza, így az ügyfélszolgálat ismétlődő terhelése csökken, a személyre szabott gondozási tanácsadás pedig minden vásárlónak jár, nem csak a legnagyobb rendelőknek.

## 2. As-is és to-be

| Mit mérünk | As-is (ma) | To-be (agenttel) | Forrás |
|---|---|---|---|
| Gondozási/választási megkeresés | 650 / hó | 650 / hó (változatlan volumen, más csatorna) | ÖKÖLSZÁM |
| Ebből emberi kezelést igényel | 100% | ~20% (eszkaláció) | BECSÜLT — a golden-set kiértékelésünkön (`docs/homework_3/rag-golden-set-evaluation.md`) a valódi tudásbázis-témájú kérdések 7/8-a (87,5%) grounded választ kapott; élő, vegyesebb forgalomra óvatosan 20%-ra korrigáltuk |
| Kezelési idő / megkeresés (ember) | 7 perc | 4 perc (csak az eszkalált eseteknél — a kontextus már össze van gyűjtve) | ÖKÖLSZÁM (as-is) / BECSÜLT (to-be) |
| Első válasz átfutása | ~5 óra (munkaidőn kívül/sorban állás) | azonnali (streamelt válasz) | ÖKÖLSZÁM (as-is) / MÉRT (to-be, lásd lent) |
| Agent-válasz tényleges végrehajtási ideje | — | katalógus: medián 12,2 s (18 minta) · tudásbázis (grounded): medián 8,3 s (4 minta) | **MÉRT** — `logs/*.jsonl` és `logs/rag/*.jsonl`, jelenleg fejlesztői teszt-forgalomból, nem élő ügyfél-mixből |

A folyamat ma: a vásárló emailben/telefonon kérdez, az ügyintéző kikeresi a katalógusból a növényt és a gondozási leírást, megfogalmaz egy választ — jellemzően ugyanaz a néhány tucat kérdés ismétlődik.
Az agenttel: a webshopban a katalógusra és a gondozási tudásbázisra támaszkodva, forrásmegjelöléssel válaszol; ha bizonytalan, egyetlen emberi jóváhagyási pontra (eszkalációra) fut, nem próbál kitalálni semmit.

## 3. A szám

**~4,84 M Ft/év** ügyfélszolgálati kapacitás-megtakarítás (PEREX) — **BECSÜLT**

Levezetés: 650 megkeresés/hó × [80% agenttel lezárva × 7 perc megspórolva + 20% eszkalált × 3 perc megspórolva] = 650 × 6,2 perc ≈ 4030 perc/hó ≈ 67,2 óra/hó × 6000 Ft/óra (ökölszám ügyfélszolgálati óradíj) ≈ 403 200 Ft/hó ≈ **4,84 M Ft/év** (ramp-up nélkül, névleges).

Mellette, a narratívába és nem a számok közé: azonnali (0-24) válasz minden vásárlónak (nem csak a legnagyobbaknak), konzisztensebb válaszminőség (mindenki ugyanabból a tudásbázisból kapja a választ, nem attól függ, ki veszi fel a telefont).

## 4. Adattérkép

Egy ügyfélkérdés útja — teljes adatfolyam:

```
Böngésző (ügyfél, saját domain)
   │  HTTPS, POST /api/customer/chat { question }
   ▼
apps/api (saját infra) — rate limit (20 kérés/10 perc/IP), max. 500 karakter/kérdés
   │
   ├─→ Anthropic API (Claude Haiku 4.5, US) — kapja: a kérdés szövege + a
   │    talált katalógus-sorok/tudásbázis-chunkok. NEM kapja: ügyfél nevét,
   │    e-mail címét, rendelési adatot — ilyet a rendszer sosem gyűjt.
   │
   └─→ OpenAI API (embedding + gpt-5.4-mini rerank, US) — csak akkor, ha
        tudásbázis-kérdés; kapja: a kérdés szövege + jelölt chunk-tartalmak.

   ◄── streamelt válasz vissza a böngészőnek (SSE)

Helyben marad (saját Postgres, sosem hagyja el a rendszert):
   - JSONL napló (kérdés, válasz, token-usage, időzítés) — lokális fájlrendszer
   - grounded/elutasított döntés a RAG-naplóban
   - eszkaláció esetén: `escalations` tábla (kérdés + kontextus + a
     munkatárs válasza) — ez az egyetlen hely, ahol egy ember ténylegesen
     látja a kérdést a végleges válasz elküldése előtt
```

**Mi soha nem kerül a rendszerbe**: nincs ügyfél-regisztráció, nincs `customers`/rendelés tábla a sémában (`packages/db/prisma/schema.prisma` — csak `Product`, `KnowledgeDocument`, `KnowledgeChunk`, `Escalation`), nincs fizetési adat, nincs harmadik fél analitika/tracking. Ha egy ügyfél mégis saját PII-t ír a kérdésbe, az elmegy a modellhez és a lokális naplóba is bekerül — ez egy ismert, dokumentált korlát (lásd `kotekedok.md` 1. kérdés).

## 5. Költség és idő (felső becslés)

| Tétel | Egyszeri | Éves | Megjegyzés |
|---|---|---|---|
| Fejlesztés | 480 e Ft | — | ~1 fejlesztői hét — alacsony, mert a katalógus-agent, a RAG-pipeline és a PDF-export 100%-ban a meglévő, változatlan kódot használja; csak az eszkalációs mechanizmus + 2 web-oldal új |
| Integráció (webshop-beágyazás, több domaines CORS) | 300 e Ft | — | ma egyetlen originre korlátozva, több ügyfél-domaines beágyazáshoz külön munka |
| Betanítás, párhuzamos üzem (ügyfélszolgálat) | 150 e Ft | — | ügyfélszolgálati kapacitásból, ~25 óra |
| Licenc és modellhasználat | — | ~20 e Ft | **MÉRT** egységárak alapján (`docs/homework_3/rag-roi.md`: egy grounded RAG-kérdés ~0,4 cent, katalógus-kérdés ~0,9 cent) × 650/hó × 12 |
| Üzemeltetés és támogatás | — | 200 e Ft | monitoring, hibaelhárítás |
| **Összesen** | **930 e Ft** | **220 e Ft** | megtérülés: **~5 hónap** (ramp-uppal) |

Ramp-up: 1. hó ~20% adopció (párhuzamos üzem, a régi csatorna is fut), 3. hó ~60%, 6. hó ~90%. Az első év realizált megtakarítása ezért nem 4,84 M, hanem becsülten ~65%-a, kb. **~3,1 M Ft**.

## 6. Kockázat és mi történik, ha rosszul megy

- **Legnagyobb kockázat**: téves gondozási tanács, ami miatt egy növény elpusztul, vagy egy ügyfél rossz terméket választ.
- **Emberi kapu**: minden nem-grounded (bizonytalan) válasz **kizárólag** emberi jóváhagyás után jut el az ügyfélhez — a rendszer sosem tippel, sosem esik vissza ellenőrizetlen internetes válaszra ügyfél felé (ez tudatos eltérés a belső agent viselkedésétől, ahol a `web_search`-fallback megmarad).
- **Visszavehetőség**: egyetlen env-változó (`CUSTOMER_CHAT_ENABLED=false`) + újraindítás → a customer/internal route-ok ténylegesen nem is regisztrálódnak, percek alatt kikapcsolható, a régi (emberi) ügyfélszolgálati csatorna érintetlen marad.
- **Adat**: nincs PII-gyűjtés (nincs `customers` tábla), csak a nyilvános katalógus és a gondozási tudásbázis megy a modellhez.
- **Naplózás**: minden kérdés/válasz/eszkaláció auditálható (`logs/`, `escalations` tábla) — visszakereshető, mikor és miért utasított el/eszkalált a rendszer egy kérdést.

## 7. Rollout terv

| Mérföldkő | Mikorra | Mi a döntés a végén |
|---|---|---|
| Pilot indul, a top 30 termékre/cikkre szűkítve, 1 webshop-oldalon | +2 hét | eléri-e a válaszminőség és az eszkalációs arány a küszöböt |
| Döntési pont: bővítünk vagy visszaveszünk | +4 hét | teljes katalógusra/tudásbázisra nyitunk-e |
| Teljes webshop, gazda kijelölve | +10 hét | megy-e a második use case |

Gazda a go-live után: **ügyfélszolgálat vezetője** (napi eszkaláció-kezelés) + **e-commerce csapat** (üzemeltetés, mérési riport).

## 8. Mérési terv (összefoglaló) + mit kérünk

Legalább egy metrika a megoldott fájdalomhoz (**válaszidő**), legalább egy az agent hibájához/korlátjához kötve (**eszkalációs arány**) — a teljes tábla: [`meresi-terv.md`](meresi-terv.md).

| Mit mérünk | Honnan | Kinek |
|---|---|---|
| Válaszidő az ügyfél felé | `logs/*.jsonl` + `logs/rag/*.jsonl` (MÉRT) | ügyfélszolgálat vezetője |
| Eszkalációs arány | `escalations` tábla / összes customer-kérdés | ügyfélszolgálat vezetője, szponzor |

**Mit kérünk**: 930 e Ft egyszeri keretet és az ügyfélszolgálat egy munkatársának napi 30 percét (eszkalációs sor kezelése) egy 4 hetes pilotra, döntési ponttal a 4. héten.
