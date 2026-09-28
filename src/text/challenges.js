// Extra uppgifter (för elever som blir klara tidigt). Bara text: ingen ny logik och ingen bedömning i appen.
// Svaren skrivs i elevens eget arbetsdokument.
export const CHALLENGES = [
  {
    key: 'single',
    title: 'Lektion 1: Grundmodell',
    tasks: [
      'Lura filtret: skriv ett spammeddelande som modellen släpper igenom och ett vanligt meddelande som den felaktigt kallar spam (steget Testa egen text). Vilka ord tror du lurade den?',
      'Okända ord: testa en text som bara innehåller ord modellen aldrig sett. Vad svarar den, och varför?',
      'Kör frö-experimentet ovan. Hur mycket varierar validation accuracy? Hur säker kan du vara på en enskild körning?',
      'Testa tröskelreglaget ovan: hitta en tröskel där inget vanligt meddelande blockeras. Vad händer med recall?',
    ],
  },
  {
    key: 'compare-datasets',
    title: 'Lektion 2: Träningsdata',
    tasks: [
      'Hitta en påhittad spamtext som modell A släpper igenom men modell B upptäcker, eller tvärtom (testa på båda i steget Testa egen text). Förklara utifrån träningsdatan.',
      'Jämför antal ord i vokabulären för A och B. Hur kan det förklara skillnaderna i resultat?',
      'Kör frö-experimentet ovan. Är skillnaden mellan A och B i din jämförelse större eller mindre än spridningen mellan olika frön? Kan du med säkerhet säga att det ena datasetet är bättre?',
      'Titta på felen i A och B. Vilken typ av fel (falskt positivt eller negativt) dominerar i respektive modell?',
      'Öppna ordvikterna för modell A och modell B. Vilka ord styr mest? Vad säger det om vad modellen egentligen har lärt sig?',
      'Skapa ditt eget dataset C (välj 20 + 20 texter) och träna A, B och C. Blev ditt val bättre eller sämre än A och B, och varför tror du det?',
    ],
  },
  {
    key: 'compare-epochs',
    title: 'Lektion 3: Antal epoker',
    tasks: [
      'Titta på kurvorna för 100 epoker. Förutsäg vad som skulle hända med training accuracy och validation accuracy om du tränade ännu längre, till exempel 300 epoker. Motivera med vad kurvorna redan visar.',
      'Välj "Jämför learning rate" under Utökade laborationer i steget Välj inställningar och träna. Beskriv hur kurvorna för 0,01, 0,1 och 0,5 skiljer sig.',
      'Vid vilken epok når training accuracy 100 % första gången? Vad hände med validation accuracy vid samma tid?',
      'Förklara skillnaden mellan underanpassning och överanpassning med stöd av dina kurvor. Ge minst två mått som stöd och en sak som gör slutsatsen osäker.',
      'Välj "Utökade laborationer" i steget Välj inställningar och jämför antal dolda noder (2, 8, 32). Behövs ett stort nätverk för så här små data?',
      'Diagrammet markerar epoken med högst validation accuracy. Varför är det problematiskt att välja antal epoker efter just det värdet?',
    ],
  },
  {
    key: 'improve',
    title: 'Lektion 4: Förbättring och sluttest',
    tasks: [
      'Innan du byter ut texter: skriv en hypotes om vilka fem spamtexter och fem vanliga texter som är mest värda att byta, och varför (titta på felklassificerade texter).',
      'Prova två olika förbättringsstrategier och jämför dem på valideringsdata. Välj den bästa. Kör sedan sluttestet EN gång. Använd aldrig sluttestet för att välja mellan strategierna.',
      'Kör "Före och efter över flera frön" (ovan i steget Fördjupning). Håller förbättringen i de flesta frön, eller kan den bero på slumpen?',
      'Använd felanalysen under dina felklassificerade texter: vilka ord saknades i träningsdatan, och vilka fem texter borde du byta för att åtgärda det?',
      'Kostnadsfrågan: vilket fel är värst för ett skolmejl, falskt positivt eller falskt negativt? Koppla till precision och recall.',
      'Förklara varför en förbättring på valideringsdata inte behöver synas på sluttestet.',
    ],
  },
  {
    key: 'analysis',
    title: 'Lektion 5: Individuell analys',
    tasks: [
      'Kopiera analysmallen (ovan i steget Fördjupning) och fyll i rubrikerna med egna ord.',
      'Byt analys med en kamrat och granska med checklistan. Vilka påståenden saknar stöd i siffror?',
      'Sammanställ dina körningar i en tabell (dataset, epoker, frö, accuracy, precision, recall, F1) med hjälp av dina resultatblock.',
      'Skriv en slutsats där varje påstående stöds av ett tal från dina egna körningar, och ange minst en osäkerhet.',
      'Välj ett fel som modellen gör och förklara det med ord som modellen kände igen eller inte kände igen.',
      'Föreslå en konkret förändring (data, epoker eller tröskel) som du inte hunnit testa, och förutsäg vad som händer.',
    ],
  },
];
