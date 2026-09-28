// Valideringsdata: 20 fasta texter (10 spam, 10 vanliga). Används för att följa och jämföra träningen.
// Får aldrig ingå i träningsdata och kan inte ändras i gränssnittet. Filen är avsiktligt skrivskyddad (Object.freeze).
// Några vanliga texter använder ord som ofta finns i spam (t.ex. "gratis", "vinner") för att visa modellens gränser.

const rows = [
  ['v-spam-01', "Grattis! Du har vunnit en resa till Spanien. Klicka på länken för att hämta din vinst.", 'spam'],
  ['v-spam-02', "Din bank behöver att du bekräftar dina kortuppgifter idag, annars stängs kortet.", 'spam'],
  ['v-spam-03', "Tjäna 5000 kr i veckan på nätet, helt utan arbete. Anmäl dig nu!", 'spam'],
  ['v-spam-04', "Ditt paket väntar på ett lager. Betala fraktavgiften här så levererar vi det.", 'spam'],
  ['v-spam-05', "Superpris: 90 % rabatt på alla klockor, endast under dagen!", 'spam'],
  ['v-spam-06', "Snabblån utan krångel! Pengarna på ditt konto inom en timme.", 'spam'],
  ['v-spam-07', "Du har blivit utvald till vår gratis provperiod. Aktivera ditt erbjudande nu.", 'spam'],
  ['v-spam-08', "Varning: din dator har flera virus. Ladda ner vår rensare direkt.", 'spam'],
  ['v-spam-09', "Vill du gå ner i vikt snabbt? Beställ våra tabletter och se resultat på en vecka.", 'spam'],
  ['v-spam-10', "Din lott har dragits! Skicka dina kontouppgifter så får du 15 000 kr.", 'spam'],
  ['v-vanlig-01', "Hej, glöm inte att ta med dig matlådan imorgon, vi ska på utflykt.", 'vanlig'],
  ['v-vanlig-02', "Kan vi flytta redovisningen till torsdag? Jag är sjuk idag.", 'vanlig'],
  ['v-vanlig-03', "Det är gratis inträde på skolans fest på fredag, kom gärna!", 'vanlig'],
  ['v-vanlig-04', "Tack för att du kom på födelsedagsfesten igår, det var jättetrevligt.", 'vanlig'],
  ['v-vanlig-05', "Kan du skicka anteckningarna från historielektionen? Jag missade den.", 'vanlig'],
  ['v-vanlig-06', "Vi vinner säkert matchen på lördag om alla kommer på träningen.", 'vanlig'],
  ['v-vanlig-07', "Läraren har lagt ut provresultaten. Jag fick godkänt på matten!", 'vanlig'],
  ['v-vanlig-08', "Ska vi ta bussen tillsammans till stan på lördag klockan elva?", 'vanlig'],
  ['v-vanlig-09', "Mamma frågade om du vill äta middag hos oss på söndag.", 'vanlig'],
  ['v-vanlig-10', "Jag har köpt biljetter till konserten, de kostade 350 kr per person.", 'vanlig'],
];

export const VALIDATION_TEXTS = Object.freeze(
  rows.map(([id, text, label]) => Object.freeze({ id, text, label, source: 'validation' })),
);
