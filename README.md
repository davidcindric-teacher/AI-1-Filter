# Träna och undersök ett spamfilter

Statisk webbapp för en laboration i **AI nivå 1** (gymnasiet, fem lektioner à 80 minuter, elever två och två på iPad eller dator).
Eleverna tränar en liten neural nätverksmodell som klassificerar påhittade svenska textmeddelanden som *spam* eller *vanligt meddelande*
och undersöker hur modellen beter sig. Appen är på svenska. Ingen installation, inloggning, server, databas eller API-nyckel behövs, och ingen data lämnar enheten.

Appen **ersätter inte elevernas arbetsdokument**. Den är ett labbverktyg. Lektion 5 (individuell analys) görs i elevens eget dokument.

## Lektionerna i appen

| Lektion | Laboration (välj lektion överst) | Vad som händer |
|---|---|---|
| 1 | En träning | Dataset A, 30 epoker, fast valideringsmängd. Eleven testar fyra egna meddelanden (Testa egen text). Testtexter läggs aldrig till i träningsdata. |
| 2 | Jämför A och B | Två separata modeller, samma slumpfrö, arkitektur, epoker och valideringsdata. Resultat sida vid sida. |
| 3 | Jämför 5, 30, 100 epoker | Dataset B tränas tre gånger från samma startläge. Kurvor, mått per epok, försiktiga tolkningshjälp. Appen påstår inte att fler epoker alltid är bättre. |
| 4 | Före och efter förbättring | Eleven byter ut exakt 5 texter per klass i B (Skapa egen förbättrad data). Före/efter jämförs på valideringsdata och på ett **låst sluttest**. |
| 5 | (görs i arbetsdokumentet) | Appen ger resultatblock som kan kopieras in. |

## Lektionsväljare och lektionsguide

- **Vilken lektion arbetar du med? (1–5 eller Alla)** ligger överst och styr vilka avsnitt, dataset-kort och laborationer som visas. Exempelvis visas "Skapa egen förbättrad data och kör sluttest" bara i lektion 4, och "eget mix C" bara i lektion 2. **Alla** visar hela appen (för lärare).
- **Lektionsguide** med steg som bockas av automatiskt när eleven gjort något i appen (tränat, testat fyra egna meddelanden, kopierat resultat), och kryssrutor för steg som handlar om det egna dokumentet. Guiden finns både i sidhuvudet och i hamburgarmenyn. Kopieringssteget nollas när en ny körning görs.
- **Alla dina körningar hittills:** kompakt tabell över sessionens körningar (i minnet, försvinner vid omladdning), med i resultatblocket.
- **Resultatkort:** det viktigaste syns direkt (mått, förväxlingsmatris, felen, accuracy-kurvan). Modell, förlustkurva och värden per epok ligger bakom "Detaljer". Tolkningstipsen om under-/överanpassning visas direkt i lektion 3.
- **Felmeddelanden** visas i den fasta toppraden så att sidan inte hoppar och eleven ser dem oavsett var hen är.
- Avsnitten är numrerade **utan siffror** i gränssnittet så att de inte förväxlas med lektionerna.

## Kompakt redigerare i lektion 4 (byt ut-knappar i stället för 40 öppna textrutor)

Alla 40 texterna i dataset B visas som korta, stängda rader (bara texten och en knapp), inte som 40 samtidigt
öppna textrutor. Varje rad har tre lägen:

- **Oförändrad, stängd:** visar originaltexten och en **"Byt ut"**-knapp som öppnar en textruta för just den raden.
- **Öppen:** textrutan är synlig och fokuserad. **"Klart, dölj texten"** stänger raden igen (behåller det eleven skrivit),
  **"Återställ till dataset B"** återställer originaltexten och stänger.
- **Ändrad, stängd:** visar den nya texten med en **"Ändrad"**-badge, en **"Redigera"**-knapp (öppnar igen) och
  **"Återställ till dataset B"**.

Ingen logik ändrades (samma `edits`, samma validering och samma återställningstext som tidigare) — bara hur raderna
visas. En importerad återställning med tidigare ändringar visas direkt i "ändrad, stängd"-läge, inte som öppna textrutor.

## Flikvy för tre körningar (lektion 3 och de utökade laborationerna)

När en laboration ger tre körningar (5/30/100 epoker, eller de utökade jämförelserna av learning rate/dolda noder/dataset C)
visas jämförelsetabellen som vanligt överst, men de fulla resultatkorten (mått, diagram, felanalys, snabbtest) visas ett i
taget bakom flikknappar i stället för tre fulla kort efter varandra. Det korta antalet mätvärden i jämförelsetabellen
försvinner alltså aldrig, bara de tunga korten. Lektion 2 (2 körningar) och lektion 4 (före/efter) visas fortfarande
sida vid sida, eftersom det är hanterbart och ofta vill jämföras visuellt direkt.

## Interaktiv modelldemo och snabbtest

- **"Så blir din text till siffror"** (i steget Välj dataset): eleven skriver en egen text och ser direkt vilka ord som finns i det valda datasetets vokabulär (gröna, blir en etta) och vilka som ignoreras (grå). Kräver ingen träning och ändrar inget. Ersätter den tidigare rent textbaserade beskrivningen som första steg; den fullständiga tekniska beskrivningen (dolt lager, sannolikhet, vikter) finns kvar hopfälld i Steg 2.
- **Snabbtest i varje resultatkort:** en liten testruta direkt under de felklassificerade texterna, så eleven kan prova en idé utan att scrolla till avsnittet Testa egen text. Skriver till samma lista (testLog) som huvudtestet, så det räknas i lektionsguiden och resultatblocket.
- Introduktionen är kortare (en duplicerad sparpåminnelse togs bort) och är hopfälld som standard på smala skärmar (mobil) i alla lektioner, för att korta vägen till Steg 3: Träna modellen.

## Navigering och visningsläge

- **Hamburgarmeny (vänster i toppraden)** med genvägar till alla avsnitt. Esc, Tab-fälla och fokushantering fungerar med tangentbord. Signaturen "Skapad av David Cindric, Amerikanska Gymnasiet" ligger till höger i toppraden.
- **Standard / Förenklad** (i sidhuvudet): förenklad döljer extra förklaringar, detaljer, utökade laborationer och hela Extra-avsnittet. Påverkar bara presentationen, aldrig modell eller resultat.

## Extra för elever som blir klara tidigt (avsnittet Extra)

Ändrar aldrig de vanliga resultaten. Alla extra-experiment tas med i resultatblocket och nämns här per lektion.

| Lektion | Extra |
|---|---|
| 1 | **Frö-experiment** (samma träning med 5 frön) och **tröskelreglage** (1–99 %, bara valideringsdata). |
| 2 | **Ordvikter** (vilka ord drar mest mot spam/vanligt) och **dataset C**: eleven väljer själv 20 + 20 texter ur A och B, med laborationen "Jämför A, B och C". |
| 3 | **Bästa epok markerad** i diagrammet (med varning om att valet är osäkert) och utökade laborationer för **learning rate** (0,01/0,1/0,5) och **dolda noder** (2/8/32). |
| 4 | **Felanalys** under de felklassificerade texterna (kända/okända ord, hur vanliga i träningsdata), **före/efter över 5 frön** och en kostnadsfråga (falskt positivt eller negativt?). |
| 5 | **Analysmall** med elevens siffror ifyllda (tolkningar lämnas tomma) och **kamratgranskning**-checklista. |

Dessutom finns **utmaningar** (textuppgifter) för lektion 1–5 i `src/text/challenges.js`. Den aktuella lektionens ruta öppnas automatiskt.

Dataset C sparas i återställningstexten som `mixIds` (fältet är valfritt, formatversion 1). Ordvikterna är en förenkling: ordet testas ensamt mot en tom text.

## Snabbstart

Kräver Node.js 20 eller senare.

```bash
npm install
npm run dev        # utveckling, http://localhost:5173
npm run lint       # ESLint
npm test           # enhetstester (Vitest)
npm run build      # produktionsbygge till dist/
npm run preview    # förhandsgranska bygget lokalt
npm run check      # lint + test + build
```

## Publicera på GitHub Pages

1. Skapa ett repo på GitHub och pusha projektet till `main`.
2. Gå till **Settings → Pages** och välj **Source: GitHub Actions**.
3. Workflowen `.github/workflows/deploy.yml` kör lint, tester och bygge och publicerar `dist/` vid varje push till `main`.
4. Sidan hamnar på `https://<användare>.github.io/<repo>/`.

`vite.config.js` använder `base: './'`, så bygget fungerar oavsett repots namn. Mappen `dist/` kan också läggas på vilken statisk webbserver som helst.

## Så fungerar modellen

- **Text till siffror:** gemener, uppdelning i ord (bokstäver och siffror, å/ä/ö behålls), bag-of-words: 1 om ordet finns, annars 0. Okända ord ignoreras.
- **Vokabulär:** alla ord i träningsdata (sorterade). Validering och sluttest bidrar aldrig.
- **Nätverk:** indata → dolt lager med 8 noder (ReLU) → 1 utnod (sigmoid) = sannolikhet för spam. Tröskel 0,5.
- **Träning:** SGD, learning rate 0,1, batchstorlek 4, förlust = log loss.
- **Implementerad i ren JavaScript, inte TensorFlow.js.** Skäl: full determinism (samma slumpfrö ger bit-för-bit samma resultat oberoende av WebGL/WASM/webbläsare), noll runtime-beroenden, ~25 kB gzip, fungerar offline och stabilt på iPad, och modellen är så liten att träningen tar under en sekund.

### Reproducerbarhet

- Egen seedad generator (`src/ml/rng.js`), aldrig `Math.random()`.
- **Startvikter:** vikten för ett ord och en dold nod är en funktion av `slumpfrö|ord|nod`. Samma ord får alltså samma startvikt i dataset A, B och egna dataset, trots olika vokabulär. Utdatalagrets startvikter beror bara på slumpfröet.
- **Ordning på träningsdata:** deterministisk blandning per epok från slumpfröet. En 5-epokers körning är därför exakt de första 5 epokerna i en 30- eller 100-epokers körning.
- Varje träning skapar ett helt nytt nätverk. Inget fortsätter från en tidigare körning. Appen visar ett **startläge-id** (fingeravtryck av startvikterna).
- Valideringsdata är fasta. Ingen slump ändras automatiskt mellan jämförelser.
- Mikroskillnader i flyttal mellan olika webbläsare/processorer är teoretiskt möjliga (`Math.exp`), men har inte observerats i tester.
- Förvalt slumpfrö är 7. Det valdes för att vara representativt (nära genomsnittet över 40 testade frön), inte för att ge bäst resultat. Andra frön kan ge tydligt annorlunda resultat, vilket är en del av lärandet.

## Data

Alla texter är påhittade och ligger i `src/data/` (`datasetA.js`, `datasetB.js`, `validation.js`, `finalTest.js`). Varje text har `id`, `text`, `label` (`spam`/`vanlig`) och `source` (`dataset-a`, `dataset-b`, `validation`, `final-test`). Dataset A är repetitivt, B mer varierat, båda 20 + 20 texter. Validering (10 + 10) och sluttest (10 + 10) är separata, skrivskyddade (`Object.freeze`) och kontrolleras mot träningsdata både i redigeraren och i träningsfunktionen. Sluttestets texter visas inte i gränssnittet förrän det körts.

## Sparrutin för eleverna

> **Arbetsdokumentet är den riktiga sparplatsen. Kopiera resultat och återställningstext efter varje körning.**

1. **Kopiera resultatblock** (avsnittet Spara och återställ): vanlig text med försöksnamn, tid, appversion, dataset, slumpfrö, epoker, arkitektur, mått, förväxlingsmatris, felklassificerade texter, kurvvärden, egna testtexter och ev. sluttest. Klistras in i Google Docs/Word.
2. **Kopiera återställningstext:** läsbar JSON (`format`, `formatVersion`, appversion, datum, dataset, inställningar, slumpfrö, epoker, alla träningstexter med etiketter, elevens ändringar). Kan även laddas ner som `.json`, men eleven ska ändå kopiera texten till sitt dokument.
3. **Läs in återställning:** klistra in texten, appen validerar och ger tydliga svenska felmeddelanden. Träna sedan om. Samma frö, data och inställningar ger samma resultat.

`localStorage` används bara som extra bekvämlighet för inställningar och egna ändringar (aldrig resultat) och kan försvinna när som helst. Appen lovar aldrig att något finns kvar.

## Kodstruktur

```
src/
  config.js            konstanter, appversion, förval
  data/                dataset, validering, sluttest
  ml/                  rng, tokenizer, vectorizer, network (modell + SGD), trainer
  metrics.js           accuracy, precision, recall, F1, förväxlingsmatris
  dataChecks.js        kontroll av träningsdata (20/20, dubbletter, ingen läcka)
  customData.js        förbättrad dataset B (exakt 5 utbytta per klass)
  experiments.js       laborationsupplägg (lektion 1–4)
  report.js            resultatblock
  recovery.js          export/import av återställningstext
  storage.js           localStorage (bara bekvämlighet)
  mixData.js           dataset C (eget mix av A och B)
  analysis.js          ordvikter, felanalys, bästa epok
  analysisTemplate.js  analysmall och granskningschecklista
  thresholdAnalysis.js tröskelexperiment
  ui/                  paneler (dataset, inställningar, träning, resultat, test, redigerare, sluttest, extra, spara)
tests/                 Vitest
```

## Begränsningar

- Modellen är liten och förstår inte text som en människa. Den räknar med vilka ord som finns. Ordföljd, ironi och stavfel hanteras inte.
- 20 valideringstexter och 20 sluttesttexter ger osäkra slutsatser: en text motsvarar 5 procentenheter.
- Resultaten varierar med slumpfrö. Appen visar detta men försöker inte dölja det.
- Sluttestets texter finns i källkoden (statisk sajt) och kan alltså hittas av den som tittar i koden. Låsningen gäller gränssnittet och träningskontrollerna, inte en teknisk hemlighet.
- Appen samlar inte in och bedömer inga elevsvar.
- Inga riktiga personuppgifter, adresser eller telefonnummer förekommer i datan.

## Manuell kontrollista

Appstart · träna A · träna B · egen text (inkl. tom text) · kopiera resultatblock · exportera/importera återställning (inkl. felaktig text) · skapa förbättrad data (5+5, blockering av valideringstext) · sluttest före/efter · smal skärm (390 px) · tangentbord (Tab, Enter/mellanslag på `?`-knappar) · iPad Safari.
