# Plantbase — ügyfélirányú kiterjesztés (PoC)

> Ez a mappa a "kirakjuk a terméket az ügyfelek elé" feladat leadása: a meglévő, belső használatra épült Plantbase-agentre épülő ügyfélirányú PoC + döntéselőkészítő anyag. Semmi nem lett újraépítve — a katalógus-agent, a RAG-tudásbázis (HyDE+rerank+grounding) és a PDF-export a `packages/core/src/` meglévő, változatlan kódja. Az egyetlen új folyamat: az ügyfélirányú chat + egyetlen emberi jóváhagyási pont (eszkaláció).

## Mit csinál

Egy **második, ügyfeleknek szánt belépési pont** a már működő agent köré:

- **`/customer`** (`apps/web`) — ügyfélirányú chat-widget. Termékkérdésre a katalógusból válaszol, növényápolási kérdésre a tudásbázisból (ugyanaz a `packages/core` logika, mint a belső chatnél). Ha a tudásbázis nem tud biztos választ adni, **NEM** esik vissza internetes keresésre (ahogy a belső ág teszi) — helyette egyetlen emberi jóváhagyási pontra fut: az eset **eszkalálódik**, az ügyfél egy "egy kollégánk hamarosan válaszol" üzenetet lát, és a widget automatikusan pollozza a választ, amíg meg nem érkezik.
- **`/internal/escalations`** (`apps/web`) — belső nézet (nem ügyfélnek szánt), ahol egy munkatárs látja a nyitott eseteket, és **jóváhagyja/elküldi** a választ. Ez az egyetlen, kötelező emberi jóváhagyási pont.
- Grounded tudásbázis-válasznál a PDF-export (a meglévő Anthropic Agent Skill, `quote-document.ts`) is elérhető — az ügyfél letöltheti a gondozási választ PDF-ben. Excel-export az ügyfél-ágon nincs (az belső, katalógus-adminisztrációs formátum maradt).

## Mit old meg, és mit nem (a "10 fájdalom" közül)

Részletes indoklás: [`business-case.md`](business-case.md). Röviden:

- **Megoldja**: #1 (munkaidőn kívüli azonnali válasz), #5 (személyre szabott gondozási tanácsadás minden vásárlónak, nem csak a legnagyobbaknak).
- **Kimondottan NEM oldja meg**: #4 (rendelés-státusz — nincs rendelés-adat a rendszerben), #6 (tanulás a panaszokból — az eszkalációs napló ehhez alap lehetne, de ma nincs feldolgozva), #7 (szerződéskötés/papírmunka — nem értelmezhető erre a termékre), #10 (csendes lemorzsolódás — nincs vásárlási előzmény-adat).

## Hogyan indul

Előfeltétel: ugyanaz, mint a gyökér `README.md`-ben (Node ≥ 20, pnpm, Docker, `.env` kitöltve).

```bash
docker compose up -d
pnpm db:migrate        # az Escalation tábla migrációját is felviszi
pnpm api                # apps/api, :3333
npx nx serve web        # apps/web, :5173
```

Az `.env`-ben két új változó van (lásd `.env.example`):

```bash
CUSTOMER_CHAT_ENABLED="true"   # "false"-ra állítva a /api/customer/* és /api/internal/* route-ok TÉNYLEGESEN nem regisztrálódnak
INTERNAL_TOKEN="valassz-egy-sajat-tokent"   # az /internal/escalations nézet ezt kéri be
```

## Demó-forgatókönyv (mindhárom eset)

1. **Katalógus-kérdés** — nyisd meg `http://localhost:5173/customer`-t, kérdezd: *"Milyen kaktuszok vannak 5000 Ft alatt?"* → azonnali, streamelt válasz a `products` táblából.
2. **Tudásbázisban meglévő kérdés (grounded) + PDF** — *"Milyen gyakran öntözzem az aloe verát?"* → grounded válasz forráshivatkozással, PDF-letöltési lehetőség.
3. **Eszkaláció + emberi jóváhagyás** — egy, a tudásbázisban ténylegesen nem szereplő kérdés (pl. *"Hogyan bányászak aranyat egy virágcserépben?"* — lásd `docs/homework_3/rag-golden-set-evaluation.md` negatív tesztje) → a widget "egy kollégánk hamarosan válaszol" üzenetet mutat. Nyisd meg külön lapon `http://localhost:5173/internal/escalations`-t, add meg az `INTERNAL_TOKEN`-t, írd meg a választ, kattints "Jóváhagyás és küldés"-re → a `/customer` lap pollozása pár másodpercen belül megjeleníti a választ.

## Kikapcsolás (visszavehetőség)

`CUSTOMER_CHAT_ENABLED="false"` + `apps/api` újraindítás → a `/api/customer/chat` és `/api/internal/escalations*` route-ok nem is regisztrálódnak (nem csak elrejtve vannak), a belső `/api/chat` és a katalógus/RAG-funkció változatlanul működik.

## Egyéb leadandók ebben a mappában

- [`business-case.md`](business-case.md) — 6-8 diás prezentáció (üzleti eset, adattérkép, rollout terv, mérési terv).
- [`meresi-terv.md`](meresi-terv.md) — a mérési terv tábla teljes terjedelemben.
- [`kotekedok.md`](kotekedok.md) — a 6 kapott + 2 saját kötekedő kérdés, megválaszolva.
