// Sluttest: 20 låsta texter (10 spam, 10 vanliga), separata från både träningsdata och valideringsdata.
// Sluttestet används EN gång efter förbättringen och får inte användas för att justera modellen.
// Texterna visas inte i gränssnittet förrän sluttestet har körts, och de kan inte redigeras.

const rows = [
  ['f-spam-01', "Vinstmeddelande! Du har dragits ut som veckans vinnare. Skriv ditt namn och din adress för att få priset.", 'spam'],
  ['f-spam-02', "Din försäkring har gått ut. Förnya idag och få 40 % rabatt, klicka på knappen.", 'spam'],
  ['f-spam-03', "Vi har försökt nå dig angående din skuld. Betala direkt för att undvika extra kostnader.", 'spam'],
  ['f-spam-04', "Fantastisk chans att tjäna pengar på aktier! Vår expert ger dig säkra tips varje dag.", 'spam'],
  ['f-spam-05', "Ditt lösenord löper ut i dag. Ange det här för att behålla åtkomsten till ditt konto.", 'spam'],
  ['f-spam-06', "Gratis present till alla nya medlemmar. Registrera dig och ta ditt val direkt.", 'spam'],
  ['f-spam-07', "Bli av med rynkorna på en vecka med vår mirakelkräm. Beställ två och få en gratis!", 'spam'],
  ['f-spam-08', "Är du redo för en förändring? Ny karriär som hemarbetare, hög lön och flexibla tider.", 'spam'],
  ['f-spam-09', "Sista påminnelsen: ditt bidrag på 4 200 kr väntar. Bekräfta dina bankuppgifter här.", 'spam'],
  ['f-spam-10', "Slumpvis utvald till en lyxig weekendresa för två. Svara inom en timme för att behålla platsen.", 'spam'],
  ['f-vanlig-01', "Hej! Jag har glömt min nyckel, kan du öppna dörren när du kommer hem?", 'vanlig'],
  ['f-vanlig-02', "Vi ses utanför biblioteket klockan tre så går vi igenom presentationen.", 'vanlig'],
  ['f-vanlig-03', "Tack för boktipset! Jag började läsa den i går och kan inte sluta.", 'vanlig'],
  ['f-vanlig-04', "Kom ihåg att lämna in blanketten till mentorn senast på onsdag.", 'vanlig'],
  ['f-vanlig-05', "Skolan är stängd på fredag för studiedag, så ingen undervisning då.", 'vanlig'],
  ['f-vanlig-06', "Kan du lägga upp bilderna från klassresan i mappen? De blev jättefina.", 'vanlig'],
  ['f-vanlig-07', "Hunden var hos veterinären i dag och allt såg bra ut.", 'vanlig'],
  ['f-vanlig-08', "Jag tar en tidigare buss så vi träffas vid stationen i stället.", 'vanlig'],
  ['f-vanlig-09', "Grattis till dig som klarade körkortsprovet! Vi firar med tårta ikväll.", 'vanlig'],
  ['f-vanlig-10', "Är det okej om jag lånar din cykel till affären? Jag är tillbaka om en halvtimme.", 'vanlig'],
];

export const FINAL_TEST_TEXTS = Object.freeze(
  rows.map(([id, text, label]) => Object.freeze({ id, text, label, source: 'final-test' })),
);
