# HF4 - A Plantbase AI Act besorolása

**Készítette:** Rajnai Rafael  
**Dátum:** 2026. augusztus 8.  
**Kiindulási use case:** a HF3-ban továbbfejlesztett Plantbase agent (A)

## 2. AI Act besorolás

### 2.1 Javasolt besorolás

**Álláspontom szerint a jelenlegi Plantbase nem magas kockázatú AI-rendszer, azonban a közvetlen AI-interakció miatt az AI Act 50. cikk (1) bekezdése szerinti átláthatósági kötelezettség vonatkozik rá.**

Az indoklás:

1. **Nem tiltott gyakorlat.** A Plantbase nem alkalmazza az [AI Act 5. cikkében](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng) felsorolt manipulatív, kizsákmányoló, social scoring vagy tiltott biometrikus gyakorlatokat.
2. **Az AI Act 6. cikk (1) bekezdése nem alkalmazható.** A rendszer nem az Annex I szerinti szabályozott termék biztonsági komponense, és nem tartozik olyan termékhez, amely harmadik fél általi megfelelőségértékelést igényelne.
3. **Az Annex III egyik felhasználási esete sem illik rá.** Nem biometria, kritikus infrastruktúra, oktatási értékelés, foglalkoztatási döntés, hitelképesség-vizsgálat vagy alapvető szolgáltatásról szóló döntés, bűnüldözés, migráció, illetve igazságszolgáltatás. A növényajánlás kereskedelmi és szakmai döntést támogat, de nem érinti közvetlenül természetes személy alapvető jogát vagy alapvető szolgáltatáshoz való hozzáférését. Emiatt az [AI Act 6. cikk (2)-(4)](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng) szerinti Annex III-kivétel dokumentálására sincs szükség: a Plantbase eleve nem kerül be az Annex III hatálya alá.
4. **Az 50. cikk (1) bekezdése viszont releváns.** A webes chat és az interaktív CLI természetes személlyel kommunikál, ezért a felületnek egyértelműen jeleznie kell, hogy a felhasználó AI-rendszerrel beszél. Nem támaszkodnék arra a kivételre, hogy ez a körülményekből „nyilvánvaló”: a chat fejlécében és az első válasz előtt tartós „AI-asszisztens” jelölést alkalmaznék. Az [Európai Bizottság aktuális tájékoztatója](https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-high-risk-systems) szerint az új átláthatósági szabályok végrehajtása 2026. augusztus 2-án megkezdődött.
5. **Az AI-jártasság általános kötelezettsége is fennáll.** Az AI Act 4. cikke alapján a szolgáltató és az üzembe helyező a szerepükhöz igazodó oktatást ad a rendszert fejlesztő, felügyelő és használó személyeknek. A lakberendezőnek például értenie kell, hogy az ajánlás ellenőrzendő, a RAG-forrás nem garantál hibátlanságot, és személyes ügyféladatot csak engedélyezett módon szabad a kérdésbe írni.

### 2.2 Szerep a láncban

Az [AI Act 3. cikk (3)-(4)](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng) alapján a **szolgáltató (provider)** az, aki a rendszert fejleszti vagy fejleszteti, majd saját neve alatt piacra helyezi vagy üzembe helyezi; az **üzembe helyező (deployer)** pedig az, aki a rendszert a saját irányítása alatt szakmai célra használja.

Ebben a use case-ben **fejlesztőként szolgáltatói (provider) szerepben vagyok**, feltéve, hogy a Plantbase-t saját nevem alatt adom át vagy helyezem üzembe. Ezen nem változtat, hogy nem én fejlesztettem az alapmodelleket: az Anthropic és az OpenAI a saját modelljeik szolgáltatói, én pedig az ezeket a modelleket, saját toolokat, RAG-tudásbázist és vezérlési logikát integráló kész Plantbase rendszer downstream szolgáltatója vagyok.

Jelenleg önmagában a fejlesztés és tesztelés miatt nem vagyok üzembe helyező. **Akkor venném fel az üzembe helyezői (deployer) szerepet is, ha például saját növényes vállalkozást indítanék, és annak szakmai működésében a Plantbase-t a saját irányításom alatt használnám.** Ebben az esetben nem szűnne meg a szolgáltatói szerepem: ugyanazon rendszer kapcsán egyszerre lennék szolgáltató és üzembe helyező.

Az ellenkező irányú átcsúszás is lehetséges. Egy olyan lakberendező vagy növénykereskedő vállalkozás, amely a Plantbase-t változtatás nélkül használja, alapvetően üzembe helyező. Szolgáltatóvá válhat azonban, ha a rendszert saját neve alatt új rendszerként kínálja vagy helyezi üzembe. Magas kockázatú rendszereknél az [AI Act 25. cikke](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng) ezt külön is kimondja saját név vagy védjegy elhelyezése, jelentős módosítás, illetve a rendeltetés magas kockázatúvá változtatása esetén. A szerepek tehát nem pusztán attól függenek, hogy ki írta a kódot, hanem attól is, hogy ki, milyen név alatt, milyen rendeltetéssel helyezi piacra, üzembe vagy használja a rendszert.

Ha viszont csak megbízott fejlesztőként írnék kódot egy ügyfél számára, és a kész rendszert kizárólag az ügyfél helyezné üzembe a saját neve alatt, akkor a technikai fejlesztői közreműködés önmagában még nem feltétlenül tenne engem AI Act szerinti szolgáltatóvá; ezt a szerződéses és tényleges szerepek alapján kellene eldönteni.

### 2.3 Határeset - mitől ugrana magasabb szintre?

Kis, üzletileg elképzelhető bővítés lenne, ha a webshop részletfizetést kínálna, és a Plantbase az ügyfél jövedelme, fizetési múltja vagy tranzakciói alapján eldöntené, illetve pontozná, hogy jogosult-e rá. Ez már természetes személy hitelképességének értékelése lenne, ezért az **Annex III 5. pont (b)** alapján magas kockázatú besorolást eredményezne. Nem változtatna ezen önmagában az, ha a végső gombot egy munkatárs nyomná meg: ha az AI-pontszám érdemben befolyásolja a döntést, a human-in-the-loop nem veszi ki a felhasználási esetet az Annex III-ból.

Ezzel szemben az, hogy a felhasználó megad egy egyszerű keretösszeget, és az agent csak az annál olcsóbb növényeket listázza, továbbra sem hitelképesség-vizsgálat.

## 3. Átfedő szabályozások

| Szabályozás | Kapcsolódó eredeti jogszabály-idézet (angol) | Miért érinti vagy mikor érintené a Plantbase-t? |
|---|---|---|
| [GDPR - (EU) 2016/679 rendelet](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) | “‘personal data’ means any information relating to an identified or identifiable natural person (‘data subject’)” — **Article 4(1)** | Bár a növénykatalógus szintetikus, a felhasználó szabad szöveges kérdése és a részletes interakciós napló személyes adatot is tartalmazhat. Emiatt a rendszer valós használatakor a GDPR adatkezelési szabályai alkalmazandók lehetnek. |
| [Tisztességtelen kereskedelmi gyakorlatokról szóló 2005/29/EK irányelv](https://eur-lex.europa.eu/eli/dir/2005/29/oj/eng) és magyar átültetése | “A commercial practice shall be regarded as misleading if it contains false information and is therefore untruthful” — **Article 6(1)** | A jelenlegi belső, professzionális használatban korlátozott a jelentősége. Ha azonban a Plantbase közvetlenül otthoni fogyasztóknak ajánl növényt, árat vagy akciót, a pontatlan állítás befolyásolhatja a vásárlási döntésüket. |
| [DSM szerzői jogi irányelv - (EU) 2019/790, különösen 4. cikk](https://eur-lex.europa.eu/eli/dir/2019/790/oj/eng) | “shall apply on condition that the use of works and other subject matter referred to in that paragraph has not been expressly reserved” — **Article 4(3)** | A Plantbase növényápolási cikkeket tárol, darabol és dolgoz fel a RAG-tudásbázisban, ezért a felhasznált tartalmak szerzői jogi és szöveg- és adatbányászati feltételeit vizsgálni kell. A forrás megjelölése önmagában nem tesz minden ilyen felhasználást jogszerűvé. |
| [Cyber Resilience Act - (EU) 2024/2847](https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng) | “This Regulation applies to products with digital elements made available on the market” — **Article 2(1)** | A jelenlegi kurzusprojekt nem kereskedelmi termék. Ha azonban a Plantbase szoftvertermékként kerülne az uniós piacra, a digitális elemeket tartalmazó termékekre vonatkozó kiberbiztonsági és sérülékenység-kezelési követelmények relevánssá válhatnak. |

**Nem látok közvetlen DORA- vagy MDR-kötelezettséget.** A Plantbase nem pénzügyi szervezet ICT-rendszere és nem orvostechnikai rendeltetésű termék. A NIS2 sem automatikusan alkalmazandó: ehhez az üzemeltetőnek az irányelv hatálya alá tartozó ágazatba és szervezeti kategóriába kellene esnie. Ezeket új ügyfél, új szektor vagy új rendeltetés esetén ismét ellenőrizni kell.

## 4. Email a jogi csapatnak

**Címzett:** a Plantbase-t üzemeltető ügyfél jogi és adatvédelmi csapata  
**Tárgy:** Plantbase AI-asszisztens - javasolt AI Act besorolás és jogi megerősítés kérése

Kedves Jogi Csapat!

A bevezetés előtt szeretném megerősíttetni a Plantbase AI-asszisztens szabályozási besorolását és a szükséges következő lépéseket.

A rendszert lakberendezők használják növénycsomagok összeállításához. A felhasználó természetes nyelven kérdez; katalóguskérdésnél a rendszer read-only SQL-lekérdezést futtat ár-, méret-, kategória- és készletadatokon, növényápolási kérdésnél pedig saját forrásolt tudásbázisból válaszol, és csak elégtelen találat esetén használ webes keresést. A rendszer nem rendel, nem módosít adatot, nem bírál hitelt vagy álláspályázatot, és nem hoz természetes személy jogát vagy alapvető szolgáltatáshoz való hozzáférését érintő döntést. A lakberendező ellenőrzi az ajánlást és maga dönt annak felhasználásáról.

A katalógus v1-ben szintetikus adatot tartalmaz, de a felhasználó szabad szöveges kérdése és a naplózott interakció személyes adatot is tartalmazhat. A rendszer a kérdést, a tool-hívásokat és a választ JSONL-ben naplózza; az LLM-funkciók Anthropic- és OpenAI-szolgáltatást használnak. Téves válasz esetén a fő kár hibás vagy drágább ajánlat, pontatlan készletinformáció, illetve rossz növényápolási tanács lehet. A legtöbb hiba emberi ellenőrzéssel javítható, de például mérgező növény háziállat mellé ajánlása miatt egészségügyi kockázatot is kezelnünk kell.

Javaslatom szerint a jelenlegi rendszer nem esik az AI Act 6. cikke és Annex III magas kockázatú esetei közé. A közvetlen chat-interakció miatt ugyanakkor alkalmaznánk az 50. cikk (1) bekezdését: a felület egyértelműen jelzi, hogy AI-asszisztenssel történik a kommunikáció. A Plantbase-t saját név alatt fejlesztő és átadó fél szolgáltató, az ügyfél pedig üzembe helyező; ha ugyanaz a jogi személy fejleszti és használja, a két szerep összeérhet.

Kérem a megerősítésüket az alábbiakban:

1. helyes-e a „nem magas kockázatú, 50. cikk szerinti átláthatósággal érintett” besorolás;
2. elfogadják-e a fenti szolgáltató/üzembe helyező szereposztást;
3. milyen GDPR-jogalapot, megőrzési időt, adatfeldolgozói és nemzetközi adattovábbítási feltételeket írjunk elő;
4. megfelelőek-e a RAG-források licencei, illetve milyen fogyasztóvédelmi tájékoztatás kell egy későbbi B2C felülethez;
5. szükséges-e DPIA, CRA-scope vizsgálat vagy további belső jóváhagyás a pilot előtt.

Megerősítésük után a jóváhagyott követelményeket release checklistbe és üzemeltetési kontrollokba fordítjuk.

Üdvözlettel,  
Rajnai Rafael  
AI-rendszer fejlesztő

## 5. A kapott use case elemzése - QueueGenius

### 5.1 Saját elemzés

#### Érvek az egyes kockázati szintek mellett

| Lehetséges szint | Mellette szóló érvek | Ellene szóló érvek |
|---|---|---|
| Tiltott | Nincs érdemi érv. | A rendszer nem alkalmaz az 5. cikk szerinti manipulációt, social scoringot vagy tiltott biometrikus gyakorlatot. |
| Magas kockázatú | A rendszer hitelkérelmeket dolgoz fel, pontszámot ad, majd sorrendet állít fel. Ha a „teljességi” pontszám ténylegesen a jövedelem minőségét, a dokumentum tartalmát vagy a várható jóváhagyhatóságot is értékeli, az a hitelképesség rejtett proxyjává válhat. A sor hátrájára kerülő ügyfél lassabban juthat finanszírozáshoz, ezért a rangsor érdemben hathat a hozzáférésre. Ilyen rendeltetésnél az Annex III 5. pont (b) szerinti hitelképesség-értékelés lehet a helyes besorolás. | Az Annex III 5. pont (b) nem általában minden hitelügyi szoftvert, hanem a természetes személy hitelképességét értékelő vagy credit score-t megállapító rendszert nevezi meg. A brief szerint a QueueGenius csak azt nézi, hogy minden előírt dokumentum megvan-e, nem fér hozzá a scoringhoz, és nem hoz hiteldöntést. |
| Nem magas kockázatú, szűk adminisztratív rendszer | A dokumentumlista kipipálása szűk, eljárási feladat. Ha mégis Annex III-közeli előkészítő feladatként tekintenénk rá, az AI Act 6. cikk (3) bekezdés (a) és (d) pontja is a nem magas kockázatú minősítés mellett szólhat: szűk eljárási vagy előkészítő feladat, amely nem befolyásolja érdemben a döntés eredményét. | A kivétel nem használható, ha természetes személy profilozása történik. A „gördülékeny ügy” üzleti célja könnyen oda vezethet, hogy a rendszer már nem pusztán hiányt észlel, hanem a kérelmező tulajdonságai alapján jósolja a feldolgozhatóságot. Az operatív sorrend tényleges hatását is mérni kell, nem elég a „csak adminisztrál” termékcímke. |
| Átláthatósággal érintett | Ha a QueueGenius közvetlenül kommunikálna a kérelmezővel, az 50. cikk szerinti AI-tájékoztatás felmerülne. | A megadott briefben back-office eszköz, amely az ügyintéző munkalistáját rendezi; önmagában emiatt nincs közvetlen ember-AI chat kötelezettség. Az AI-jártasság 4. cikke ettől még releváns. |

#### Végső álláspont és feltételek

**Feltételesen nem magas kockázatú, szűk eljárási/előkészítő rendszernek sorolnám**, ha az alábbi korlátok mind dokumentáltan teljesülnek:

1. a teljességi ellenőrzés előre rögzített dokumentumlistán dolgozik, és csak jelenlétet, olvashatóságot, fájlazonosságot vizsgál;
2. nem értékeli a jövedelem összegét, stabilitását, a munkáltatót, lakóhelyet, életkort vagy bármely hitelképességi/proxy tulajdonságot;
3. az output sem közvetlenül, sem feature-ként nem kerül a scoringba vagy a hiteldöntés indokolásába;
4. nincs természetes személyek profilozása;
5. a rangsor nem okozhat automatikus elutasítást, határidőn túli feldolgozást vagy eltérő szolgáltatási szintet; az ügyintéző felülírhatja, és az elöregedő ügyek automatikusan előre kerülnek;
6. a bank méri a teljességi tévesztést, a csoportonkénti várakozási időt, az override-ot és a panaszokat, továbbá rendszeresen ellenőrzi, hogy az adminisztratív funkció nem sodródott át hitelképességi értékelésbe.

Ha a rendszer a dokumentumok tartalmából a várható jóváhagyás esélyét, az ügyfél kockázatát vagy hitelképességét becsüli, illetve a rangsor ténylegesen meghatározza a finanszírozáshoz jutás esélyét, **magas kockázatúként** kezelném az Annex III 5. pont (b) alapján. A nem magas kockázatú értékelést írásban dokumentálnám; az AI Act 6. cikk (4) bekezdése szerinti dokumentáció és regisztráció akkor különösen releváns, ha a szervezet úgy ítéli meg, hogy a rendszer az Annex III körébe tartozna, de a 6. cikk (3) bekezdésének kivételére támaszkodik.

#### Szerepek

- Az amerikai SaaS-cég a saját modelljének/szolgáltatásának upstream szolgáltatója.
- A bank biztosan **üzembe helyező**, mert saját hitelügyi folyamatában, saját irányítása alatt használja a rendszert.
- A bank **downstream szolgáltatóvá is válhat**, ha a SaaS-komponensekből maga határozza meg a QueueGenius rendeltetését és saját neve alatt helyezi üzembe a kész AI-rendszert. Magas kockázat esetén a saját márkanév, a jelentős módosítás vagy a magas kockázatúvá változtatott rendeltetés az AI Act 25. cikke alapján kifejezetten szolgáltatói felelősséget eredményezhet.
- A „csak promptokat konfigurálunk” mondat önmagában nem mentesít és nem is tesz automatikusan szolgáltatóvá. A szerződés, a SaaS eredeti rendeltetése, a bank által meghatározott szabályok és a tényleges műszaki kontroll alapján kell dönteni.

### 5.2 LLM-teszt

**Teszt időpontja:** 2026. augusztus 12.  
**Modell:** ChatGPT 5.6 Sol Light  
**Módszer:** külön one-shot besorolás; a use case szövege változtatás nélkül szerepelt a promptban.

#### Használt prompt

> Az alábbi use case-t sorold be az EU AI Act szerint. Mutasd be az érveket a tiltott, magas kockázatú és nem magas kockázatú besorolás mellett/ellen; térj ki az Article 6(3) kivételre, valamint arra, ki a szolgáltató és ki az üzembe helyező. Válassz végső besorolást, és nevezd meg, milyen tények változtatnák meg azt.
>
> Fintech — „QueueGenius": Az agent nem hoz hiteldöntést, hozzá sem ér a scoringhoz. Csak beolvassa a beérkező hitelkérelmek dokumentumait, teljességi pontszámot ad (megvan-e minden irat), és ez alapján okosan sorba rendezi az ügyintézők munkalistáját, hogy a „gördülékeny" ügyek ne ragadjanak be. Az ügyintéző minden döntést maga hoz. A rendszer egy amerikai SaaS-ra épül, mi csak a promptokat és a szabályokat konfiguráljuk, és a bank saját belső márkaneve alatt fut.

#### Chat-átirat - az LLM válasza

> **Végső álláspont**
>
> A leírt működés alapján a QueueGenius nem magas kockázatú AI-rendszer. Elsődleges indok: nem értékeli a kérelmező hitelképességét, nem állapít meg credit score-t, és nem tesz javaslatot a hitel engedélyezésére. Dokumentumokat ellenőriz és adminisztratív munkasorrendet állít fel.
>
> Ha azonban a rendszert az Annex III szerinti hitelbírálati folyamat részének tekintenék, akkor is erős érv szól az Article 6(3) kivétel alkalmazása mellett: szűk eljárási, illetve előkészítő feladatot végez, feltéve, hogy a sorrend ténylegesen nem befolyásolja érdemben a hitelhez jutást.
>
> **1. Tiltott AI-gyakorlat?**
>
> Nem.
>
> A rendszer a leírás szerint nem alkalmaz az Article 5 szerinti tiltott módszereket:
>
> - nem használ manipulatív vagy megtévesztő technikát;
> - nem használja ki az ügyfelek életkorából, fogyatékosságából vagy társadalmi-gazdasági helyzetéből eredő sérülékenységét;
> - nem végez általános „social scoringot”;
> - nem végez bűnelkövetési kockázatbecslést;
> - nem használ tiltott biometrikus kategorizálást, érzelemfelismerést vagy távoli biometrikus azonosítást.
>
> A „teljességi pontszám” elnevezés önmagában nem teszi social scoringgá vagy hitelpontozássá a rendszert. A pontszám tárgya az iratcsomag teljessége, nem az ügyfél személyisége, társadalmi viselkedése vagy hitelképessége. Az Article 5 tiltott gyakorlatait az AI Act 5. cikke sorolja fel.
>
> **2. Érvek a magas kockázatú besorolás mellett**
>
> Az Annex III 5(b) alapján magas kockázatúak azok a rendszerek, amelyek természetes személyek hitelképességének értékelésére vagy hitelpontszámuk megállapítására szolgálnak. Ennek oka, hogy az ilyen eredmény meghatározhatja a pénzügyi forrásokhoz és alapvető szolgáltatásokhoz való hozzáférést. Annex III, 5(b)
>
> A QueueGenius mellett a következő érvek szólhatnak a magas kockázatú minősítés mellett:
>
> - A hitelkérelmi folyamatban működik, és természetes személyek dokumentumait elemzi.
> - Egy pontszám alapján rangsorolja az egyes kérelmeket.
> - A sorrend közvetetten hatással lehet arra, hogy egy ügyfél kérelmét mikor dolgozzák fel.
> - Ha az alacsony teljességi pontszámú kérelmek rendszeresen hátrasorolódnak, az késedelmet, rosszabb ügyfélélményt vagy szélsőséges esetben a hitelhez való tényleges hozzáférés akadályozását okozhatja.
> - Az „ügyintéző dönt” önmagában nem zárja ki a magas kockázatú minősítést. Egy AI-rendszer akkor is befolyásolhat érdemben egy döntési folyamatot, ha formálisan ember hozza meg a végső döntést.
>
> Különösen problémás lenne, ha a „teljesség” értékelése valójában nemcsak azt vizsgálná, hogy egy dokumentum megvan-e, hanem annak tartalmából például jövedelmi stabilitást, foglalkoztatási kockázatot vagy visszafizetési képességet is következtetne.
>
> **3. Érvek a magas kockázatú besorolás ellen**
>
> Az erősebb értelmezés szerint a QueueGenius eleve nem tartozik az Annex III 5(b) alá:
>
> - nem értékeli a hitelképességet;
> - nem állapít meg hitelpontszámot;
> - nem számítja ki a nemteljesítés kockázatát;
> - nem tesz jóváhagyási vagy elutasítási javaslatot;
> - nem ad kamatra, hitelösszegre vagy biztosítékra vonatkozó ajánlást;
> - a pontszám kizárólag azt mutatja, hogy a szükséges iratok rendelkezésre állnak-e;
> - a munkasorrend eljárási-logisztikai célú, nem pedig a kérelmező érdemi pénzügyi értékelése.
>
> Az Annex III kategóriáit a rendszer rendeltetési célja és tényleges funkciója alapján kell vizsgálni. Nem minden, hitelügyintézésben használt AI válik automatikusan magas kockázatúvá. A Bizottság összefoglalója is hangsúlyozza, hogy a besorolás a rendszer funkciójától, konkrét céljától és használati módjától függ. Európai Bizottság – Navigating the AI Act
>
> **4. Az Article 6(3) kivétel**
>
> Az Article 6(3) alapján egy Annex III környezetében működő rendszer sem minősül magas kockázatúnak, ha:
>
> - nem jelent számottevő kockázatot az egészségre, biztonságra vagy alapvető jogokra – különösen azért, mert nem befolyásolja érdemben a döntés eredményét –, és
> - teljesül legalább egy felsorolt feltétel.
>
> A QueueGeniusra két feltétel is alkalmazható:
>
> - **Article 6(3)(a): szűk eljárási feladat.** A dokumentumok felismerése, kategorizálása és a hiányzó iratok megjelölése tipikus szűk adminisztratív feladat. A preambulum példaként említi a beérkező dokumentumok kategóriákba sorolását is.
> - **Article 6(3)(d): értékelést előkészítő feladat.** A dokumentumcsomag teljességének vizsgálata előkészítheti a későbbi, ember által végzett hitelbírálatot, de önmagában nem tartalmaz hitelképességi értékelést.
>
> A kivétel azonban nem automatikus. A banknak azt is igazolnia kell, hogy a sorba rendezés nem jár számottevő alapjogi kockázattal, és nem befolyásolja érdemben a hitelkérelem eredményét.
>
> Az alábbi biztosítékok erősítenék a kivétel alkalmazhatóságát:
>
> - a hátrasorolás nem jelenthet automatikus elutasítást;
> - minden kérelemnek garantált feldolgozási határidőt kell kapnia;
> - az ügyintéző felülírhatja a sorrendet;
> - a dokumentumhiány javítható, és az ügyfél értesítést kap róla;
> - a teljességi pontszám nem használ személyes vagy pénzügyi jellemzőket;
> - ellenőrizni kell, hogy egyes ügyfélcsoportok kérelmei nem kerülnek-e rendszeresen hátrányba;
> - a pontszám nem jelenhet meg a hitelkockázati modell bemeneti adataként.
>
> Ha a rendszer természetes személyek profilalkotását végezné, az Article 6(3) kivétel nem lenne alkalmazható: az Annex III körébe tartozó, profilalkotást végző AI-rendszer mindig magas kockázatúnak minősül. A kivétel és annak feltételei az AI Act 6(3)–(4) bekezdésében találhatók.
>
> Fontos továbbá, hogy ha a szolgáltató az Article 6(3) alapján nem magas kockázatúnak minősít egy Annex III-ba tartozó rendszert, akkor:
>
> - ezt az értékelést az üzembe helyezés előtt dokumentálnia kell;
> - a rendszert az Article 49(2) szerint nyilvántartásba kell vennie;
> - az értékelést kérésre át kell adnia az illetékes hatóságnak.
>
> **5. Ki a szolgáltató és ki az üzembe helyező?**
>
> Az AI Act szóhasználatával:
>
> - **Provider – szolgáltató:** aki a rendszert kifejleszti vagy kifejleszteti, majd saját neve vagy védjegye alatt forgalomba hozza vagy üzembe helyezi.
> - **Deployer – alkalmazó/üzemeltető:** aki a rendszert saját irányítása alatt, szakmai tevékenységében használja.
>
> Ebben a konstrukcióban a bank az alkalmazó, mert saját hitelügyintézési folyamatában, saját irányítása alatt használja a QueueGeniust.
>
> Ugyanakkor nagy valószínűséggel a bank a végső QueueGenius-rendszer szolgáltatója is, mert:
>
> - a rendszer a bank saját belső márkaneve alatt fut;
> - a bank vagy az általa megbízott csapat határozza meg a promptokat és működési szabályokat;
> - ezzel meghatározza a konkrét rendszer rendeltetési célját és működését.
>
> Az amerikai SaaS-cég ettől még az alapul szolgáló AI-rendszer, modell vagy szolgáltatás eredeti/upstream szolgáltatója lehet. A konkrét QueueGenius rendszer tekintetében azonban az Article 25(1)(a) különösen fontos: ha egy már forgalomba hozott vagy üzembe helyezett magas kockázatú rendszerre a bank a saját nevét vagy védjegyét teszi, akkor főszabály szerint maga válik annak szolgáltatójává. Hasonló eredményre vezethet a rendeltetési cél magas kockázatúvá változtatása vagy egy lényeges módosítás is. AI Act 25. cikk
>
> A puszta promptkonfiguráció nem minden esetben „lényeges módosítás”. Itt azonban a saját márkanév és a bank által kialakított konkrét rendeltetési cél miatt nem lenne biztonságos abból kiindulni, hogy kizárólag az amerikai SaaS-cég a szolgáltató. A szerződéses felelősségmegosztás fontos, de önmagában nem írhatja felül az AI Act szerinti tényleges szerepköröket.
>
> **6. Mi változtatná meg a besorolást?**
>
> Magas kockázatúvá válhatna, ha a rendszer:
>
> - a dokumentumok tartalmából hitelképességet vagy nemfizetési kockázatot becsülne;
> - a jövedelem, munkaviszony, családi helyzet vagy költési szokások alapján pontozna;
> - jóváhagyási vagy elutasítási ajánlást készítene;
> - meghatározná a hitelösszeget, kamatot vagy biztosítéki követelményt;
> - a teljességi pontszámot átadná a scoringrendszernek;
> - profilalkotást végezne;
> - a rangsor ténylegesen eldöntené, mely kérelmeket dolgozzák fel, illetve melyek maradnak tartósan feldolgozatlanul;
> - az ügyintéző csak névlegesen döntene, de a gyakorlatban automatikusan követné az AI eredményét.
>
> A nem magas kockázatú besorolást erősítené, ha:
>
> - a rendszer kizárólag előre meghatározott dokumentumlistát ellenőrizne;
> - nem elemezné a dokumentumok érdemi pénzügyi tartalmát;
> - a munkasorrend nem lenne összekapcsolva a hiteldöntéssel;
> - minden kérelemre kötelező maximális feldolgozási idő vonatkozna;
> - az ügyintéző látná az indokot és egyszerűen felülírhatná a sorrendet;
> - a rendszer kimenete nem kerülne be semmilyen hitelbírálati vagy scoringmodellbe.
>
> Összefoglalva: a jelenlegi tényállás alapján a QueueGenius nem tiltott és nem magas kockázatú rendszer. Elsődlegesen azért, mert nem végez Annex III 5(b) szerinti hitelképesség-értékelést; másodlagosan pedig azért, mert szűk eljárási és előkészítő funkciójára jó eséllyel alkalmazható az Article 6(3) kivétel. A legnagyobb kockázati pont nem a „pontszám” elnevezése, hanem az, hogy a sorba rendezés a gyakorlatban okozhat-e érdemi hozzáférési hátrányt.

#### Összevetés a saját elemzésemmel

1. **Egyezés a végső besorolásban:** mindkét elemzés szerint a QueueGenius a megadott működés alapján nem tiltott és feltételesen nem magas kockázatú rendszer. Az elsődleges indok mindkét esetben az, hogy nem értékeli a kérelmező hitelképességét, nem állapít meg credit score-t, és nem készít hiteldöntési javaslatot.
2. **Egyezés az érvelés sorrendjében:** az LLM is először azt vizsgálja, hogy a QueueGenius egyáltalán az Annex III 5(b) hatálya alá tartozik-e. Csak másodlagos, alternatív érvként alkalmazza az Article 6(3)(a) szerinti szűk eljárási és a 6(3)(d) szerinti előkészítő feladatra vonatkozó kivételt. Ez megegyezik a saját elemzésem logikájával.
3. **Egyezés a döntő határfeltételekben:** mindkét elemzés szerint magas kockázat felé mozdítaná a rendszert a dokumentumok pénzügyi tartalmának értékelése, a hitelképességi proxyk használata, a scoringrendszerrel való összekapcsolás, a profilalkotás vagy az, ha a rangsor ténylegesen akadályozná a hitelhez jutást. A nem magas kockázatú minősítést az előre rögzített dokumentumlista, a maximális feldolgozási idő, az emberi felülbírálhatóság és az output scoringtól való elkülönítése erősíti.
4. **Kiegészítés az Article 6(3) alkalmazásához:** az LLM részletesebben felsorolja azokat a biztosítékokat, amelyekkel bizonyítható a szűk adminisztratív működés. Hasznos kiegészítés a dokumentumhiány javíthatósága és az ügyfél értesítése, továbbá annak kifejezett ellenőrzése, hogy bizonyos ügyfélcsoportok kérelmei nem kerülnek-e rendszeresen hátrányba. Szintén pontosan kiemeli, hogy a 6. cikk (3) bekezdésére támaszkodó értékelést dokumentálni kell, a rendszert a 49. cikk (2) bekezdése szerint nyilvántartásba kell venni, és az értékelést kérésre a hatóság rendelkezésére kell bocsátani.
5. **Árnyalatnyi eltérés a szerepkérdésben:** az LLM nagy valószínűséggel a bankot tekinti a végső QueueGenius-rendszer szolgáltatójának is, mert az saját márkanév alatt fut, és a bank határozza meg a promptokat, szabályokat és rendeltetést. A saját elemzésem ugyanezt valós lehetőségnek tartja, de feltételesebben fogalmaz: a bank biztosan üzembe helyező, a szolgáltatói státuszt pedig a SaaS eredeti rendeltetése, a tényleges műszaki kontroll, a saját név alatti üzembe helyezés és – magas kockázatú rendszer esetén – a 25. cikk szerinti körülmények együttesen döntik el. A puszta promptkonfiguráció egyik elemzés szerint sem jelent automatikusan lényeges módosítást.
6. **Amit az LLM-válasz megerősített:** a rendszer elnevezése vagy a „pontszám” szó önmagában nem dönti el a besorolást; a tényleges funkció és hatás a meghatározó. A legfontosabb mérendő kockázat ezért nemcsak a hibás teljességi értékelés, hanem az is, hogy a rangsorolás okoz-e tartós késedelmet vagy csoportszintű hozzáférési hátrányt.

## 6. Válasz a jogi csapatnak - teendők és mérések

**Feladó:** Rajnai Rafael, AI-rendszer fejlesztő  
**Címzett:** dr. Kertész Anna, megfelelőségi vezető  
**Tárgy:** Re: AI-asszisztens - magas kockázatú besorolás, intézkedési terv szükséges

Kedves Anna!

Köszönöm a besorolást és az elvárt feladatok összefoglalását. A válaszban abból indulok ki, hogy itt a levélben leírt ügyfélszolgálati asszisztensről van szó: a rendszer az ügyfél panasza, szerződése és tranzakciói alapján kompenzációs javaslatot készít, de a végső döntést az ügyintéző hozza meg.

Az alábbiakban minden felsorolt kötelezettségnél leírom, mit jelent a követelmény a mi rendszerünknél, milyen intézkedést vezetünk be, és mivel tudjuk egy későbbi audit során bizonyítani, hogy az valóban működik.

### Kockázatkezelés - kockázatkezelési rendszer (9. cikk)

> Az AI Act eredeti angol megfogalmazása: “[Risk management system](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng)” — **Article 9**

**Mit jelent ez nálunk?** Előre össze kell gyűjtenünk, milyen hibákat okozhat a rendszer. Ilyen lehet például, ha jogosulatlan ügyfélnek ajánl kompenzációt, a megfelelőnél kisebb vagy nagyobb összeget javasol, érzékeny adatot fed fel, egy ügyfélcsoporttal következetesen rosszabbul bánik, vagy az ügyintéző gondolkodás nélkül elfogadja a gép javaslatát.

**Intézkedés:** közös kockázati nyilvántartást vezetünk. Minden kockázat mellé felelőst, megelőző intézkedést, ellenőrző tesztet és teendőt rendelünk. Éles indulás előtt minden kritikus esetet kipróbálunk, utána havonta felülvizsgáljuk a listát, súlyos hiba után pedig rendkívüli vizsgálatot tartunk.

**Mérés és bizonyíték:** minden kritikus kockázatnak legyen kijelölt felelőse és sikeresen lefuttatott tesztje; elfogadhatatlan, kezeletlen kockázattal a rendszer nem indulhat el. Mérjük a káros hibák számát, az ismétlődő hibákat, valamint azt, mennyi idő alatt vesszük észre és javítjuk ki őket. Auditkor a kockázati lista korábbi változatai, a tesztjegyzőkönyvek, a jóváhagyások és az incidensekről készült kivizsgálások szolgálnak bizonyítékul.

### A felhasznált adatok kezelése - adat-governance (10. cikk)

> Az AI Act eredeti angol megfogalmazása: “[Data and data governance](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng)” — **Article 10**

**Mit jelent ez nálunk?** A kompenzációs javaslat csak akkor lehet megbízható, ha pontosan tudjuk, honnan származik minden adat, és az valóban szükséges-e a döntés előkészítéséhez. A modellnek nem kell megkapnia például az ügyfél teljes személyes adatkészletét, ha a panasz elbírálásához csak néhány szerződéses és tranzakciós adat szükséges.

**Intézkedés:** dokumentáljuk az adatok forrását és útját a panasz beérkezésétől a javaslat elkészítéséig. A felesleges személyes azonosítókat eltávolítjuk vagy kitakarjuk. Készítünk egy ellenőrzött teszteset-gyűjteményt különböző panasztípusokkal, termékekkel és ritka esetekkel; a helyes válaszokat két ember ellenőrzi.

**Mérés és bizonyíték:** minden felhasznált adatmezőnél vissza kell tudnunk mutatni annak forrását és célját. Mérjük a hiányos, hibás, elavult és ismétlődő adatok arányát, valamint azt, hogy az eltérő ügyfélcsoportoknál különbözik-e a hibaarány. Bizonyíték lesz az adatjegyzék, az adatfolyam leírása, a tesztesetek verziói, a kettős ellenőrzés eredménye, továbbá az adatkezelési és megőrzési szabályzat.

### Naplózás és visszakövethetőség - naplózás és eseményrögzítés (12. cikk)

> Az AI Act eredeti angol megfogalmazása: “[Record-keeping](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng)” — **Article 12**

**Mit jelent ez nálunk?** Egy későbbi panasz vagy ellenőrzés során vissza kell tudnunk nézni, hogy a rendszer milyen információk alapján, melyik szabály- és modellverzióval, pontosan milyen kompenzációt javasolt, majd az ügyintéző mit tett ezzel.

**Intézkedés:** minden ügy egyedi azonosítót kap. Rögzítjük a felhasznált adatforrásokat, a modell és az utasítások verzióját, a javasolt összeget és indokot, a bizonytalanság jelzését, valamint azt, hogy az ügyintéző elfogadta, módosította vagy elutasította a javaslatot. A naplóhoz csak felhatalmazott személy férhet hozzá, és ahol lehet, a teljes személyes adat helyett maszkolt adatot vagy hivatkozást tárolunk.

**Mérés és bizonyíték:** a kötelező naplómezők kitöltöttsége legyen 100%, a rendszerfutások legalább 99,9%-a legyen teljesen visszakövethető, jogosulatlan naplóhozzáférés pedig ne történjen. Havonta ellenőrizzük, hogy a naplókat nem módosították-e, negyedévente pedig véletlenszerű ügyeken végigjátsszuk a teljes folyamatot. Bizonyíték a napló szerkezeti leírása, mintanaplók, hozzáférési kimutatások, sértetlenségi ellenőrzések és a jogilag jóváhagyott megőrzési szabály.

### Az emberi döntés biztosítása - emberi felügyelet (14. cikk)

> Az AI Act eredeti angol megfogalmazása: “[Human oversight](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng)” — **Article 14**

**Mit jelent ez nálunk?** A rendszer javaslatot adhat, de nem fizethet ki automatikusan kompenzációt, és nem módosíthatja önállóan az ügyfél szerződését. Az ügyintézőnek értenie kell, miért született a javaslat, és tényleges lehetőséget kell kapnia annak felülbírálására.

**Intézkedés:** a felületen jól láthatóan jelezzük, hogy nem végleges döntésről van szó, és megmutatjuk a felhasznált szabályokat és bizonyítékokat. Az ügyintéző elfogadhatja, módosíthatja vagy elutasíthatja a javaslatot, illetve további adatot kérhet. Nagy összegű, bizonytalan vagy egymásnak ellentmondó esetnél második ellenőrző személy jóváhagyása szükséges. A felhasználók oktatást kapnak arról is, hogy a gépi javaslat tévedhet.

**Mérés és bizonyíték:** az automatikus kifizetések száma nulla; a kötelező második ellenőrzést igénylő ügyek 100%-a kapjon ilyen jóváhagyást; minden aktív ügyintéző végezze el az oktatást. Mérjük, milyen gyakran fogadják el, módosítják vagy utasítják el a javaslatot, és előfordul-e elfogadás a bizonyítékok megtekintése nélkül. Bizonyíték a felület képernyőképe, a jogosultságok listája, az oktatási nyilvántartás és az emberi döntéseket tartalmazó napló.

### A rendszer megbízható működése - pontosság és robusztusság (15. cikk)

> Az AI Act eredeti angol megfogalmazása: “[Accuracy, robustness and cybersecurity](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng)” — **Article 15**

**Mit jelent ez nálunk?** A rendszernek a megszokott és a ritka esetekben is megbízhatóan kell működnie. Nem elég egyszer letesztelni: egy modell-, utasítás- vagy szabályváltozás korábban jól működő eseteket is elronthat. Arra is fel kell készülni, hogy valaki manipuláló szöveggel próbálja félrevezetni a rendszert, vagy a külső AI-szolgáltatás átmenetileg nem érhető el.

**Intézkedés:** fenntartunk egy állandó, szakértők által ellenőrzött teszteset-gyűjteményt, és minden változtatás előtt újra lefuttatjuk. Külön teszteljük a hibás dokumentumokat, az ellentmondó adatokat, a jogosulatlan adatkérést, az adatszivárgást és a manipuláló utasításokat. Ha a rendszer bizonytalan vagy valamelyik szolgáltatás kiesik, nem adhat magabiztos javaslatot: az ügyet emberi feldolgozásra továbbítja.

**Mérés és bizonyíték:** induló célként a kompenzációs kategória és összegsáv legalább az ellenőrzött tesztesetek 95%-ában legyen helyes; kritikus, jogosulatlan kompenzáció legfeljebb az esetek 0,5%-ában fordulhat elő; forrással nem igazolható lényeges állítás legfeljebb 1% lehet. A tiltott műveleteket és jogosulatlan adathozzáférést vizsgáló kritikus teszteknek 100%-ban sikerülniük kell. A végleges határértékeket a pilot eredményei alapján a jogi és üzleti csapat hagyja jóvá. Bizonyíték a verziózott tesztkészlet, a változtatások előtti eredménykimutatás, a biztonsági tesztek jegyzőkönyve és az éles hibákról készített havi jelentés.

### A rendszert használó társaság feladatai - üzembe helyezői kötelezettségek (26. cikk)

> Az AI Act eredeti angol megfogalmazása: “[Obligations of deployers](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng)” — **Article 26**

**Mit jelent ez nálunk?** A rendszert használó társaság nem háríthat mindent a fejlesztőkre. Neki kell biztosítania, hogy csak megfelelően képzett és felhatalmazott munkatársak használják a rendszert, figyeljék annak működését, és probléma esetén le tudják állítani.

**Intézkedés:** készítünk jóváhagyott használati utasítást, kijelöljük, hogy ki felel az üzemeltetésért, a jogi megfelelésért, az adatvédelemért és az incidensek kezeléséért. Lesz eljárás a rendszer felfüggesztésére, a szolgáltató és szükség esetén a hatóság értesítésére, valamint az ügyfélpanaszok és helyesbítési kérelmek kezelésére. A munkavállalókat tájékoztatjuk arról, hogy magas kockázatú AI-rendszerrel dolgoznak.

**Mérés és bizonyíték:** az aktív felhasználók 100%-ának legyen érvényes oktatása és jóváhagyott hozzáférése. Negyedévente felülvizsgáljuk a jogosultságokat, félévente pedig elpróbáljuk a leállítási és értesítési folyamatot. Mérjük a riasztások kivizsgálási idejét és az ügyfélpanaszok lezárását. Bizonyíték a használati utasítás, a felelősségi lista, az oktatási jegyzőkönyv, a hozzáférések felülvizsgálata, a leállítási próba és a panasznapló.

### Az alapjogi hatások vizsgálata - az alapjogi hatásvizsgálat szükségességének vizsgálata (27. cikk)

> Az AI Act eredeti angol megfogalmazása: “[Fundamental rights impact assessment](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng)” — **Article 27**

**Mit jelent ez nálunk?** Meg kell vizsgálni, hogy a rendszer működése sértheti-e például az egyenlő bánásmódot, a személyes adatok védelmét vagy az ügyfelek tisztességes ügyintézéshez és jogorvoslathoz való lehetőségét. Különösen fontos annak ellenőrzése, hogy egyes ügyfélcsoportok nem kapnak-e rendszeresen alacsonyabb kompenzációt vagy lassabb ügyintézést.

**Intézkedés:** az éles indulás előtt a jogi csapattal írásban eldöntjük, hogy a 27. cikk szerinti vizsgálat kötelező-e. Ettől függetlenül elkészítünk egy alapjogi kockázati értékelést, amely bemutatja az érintett ügyfélcsoportokat, a lehetséges károkat, az emberi felügyeletet, a panasz- és jogorvoslati lehetőséget, valamint a kockázatcsökkentő lépéseket. Ezt lehetőség szerint összehangoljuk a GDPR adatvédelmi hatásvizsgálatával.

**Mérés és bizonyíték:** a pilot előtt legyen aláírt döntés a hatásvizsgálat szükségességéről; az éles induláskor ne maradjon nyitott kritikus intézkedés; minden feladathoz tartozzon felelős és határidő. A vizsgálatot legalább évente, illetve minden jelentős modell-, adat- vagy rendeltetésváltozás után frissítjük. Bizonyíték a jóváhagyott hatásvizsgálat, a bevont szakértők és érintettek észrevételei, az intézkedési lista és annak verziótörténete.

Összefoglalva: minden változtatás előtt lefuttatjuk a jóváhagyott teszteket, működés közben figyeljük a kritikus hibákat, havonta vagy negyedévente pedig áttekinthető jelentést készítünk. Modell- vagy szabályváltozás csak akkor kerülhet élesbe, ha az új verzió eredményeit összevetettük a korábbival, és a szükséges üzleti, jogi és műszaki jóváhagyások megszülettek.

Kérem, hogy a következő egyeztetésen erősítsük meg a kötelező alapjogi és adatvédelmi hatásvizsgálat körét, a naplók megőrzési idejét, valamint a kritikus hibák és kompenzációs összegek végleges mérési határait. Ezután az intézkedéseket konkrét fejlesztési és üzemeltetési feladatokra bontjuk, mindegyikhez felelőssel és ellenőrizhető elfogadási feltétellel.

Üdvözlettel,  
Rajnai Rafael
