// Korta förklaringar på svenska som visas när eleven öppnar en "?"-ruta.
export const EXPLAIN = {
  accuracy:
    'Accuracy (på svenska ungefär träffsäkerhet) är andelen av alla texter som modellen klassificerade rätt: (sant positiva + sant negativa) / alla texter. Ett högt värde betyder inte automatiskt att modellen är bra: den kan till exempel missa nästan allt spam och ändå få högt värde om det mesta är vanliga meddelanden.',
  precision:
    'Precision för spam: av alla texter som modellen kallade spam, hur många var verkligen spam? Sant positiva / (sant positiva + falskt positiva). Låg precision betyder att många vanliga meddelanden felaktigt hamnar i skräpposten.',
  recall:
    'Recall för spam: av allt spam som fanns, hur mycket hittade modellen? Sant positiva / (sant positiva + falskt negativa). Låg recall betyder att mycket spam släpps igenom.',
  f1: 'F1 för spam slår ihop precision och recall till ett tal (deras harmoniska medelvärde). Det är lågt om något av dem är lågt. Titta ändå alltid på precision och recall var för sig, eftersom de visar olika typer av fel.',
  tp: 'Sant positiv (TP): spam som modellen klassificerade som spam. Rätt svar.',
  tn: 'Sant negativ (TN): ett vanligt meddelande som modellen klassificerade som vanligt. Rätt svar.',
  fp: 'Falskt positiv (FP): ett vanligt meddelande klassificeras som spam. Det kan göra att viktiga meddelanden försvinner.',
  fn: 'Falskt negativ (FN): spam släpps igenom som vanligt meddelande.',
  confusion:
    'Förväxlingsmatrisen visar hur många texter som hamnade i varje ruta: raderna är den riktiga klassen och kolumnerna är modellens svar. Rutorna med rätt svar är sant positiva och sant negativa. De andra två rutorna är modellens två typer av fel.',
  trainAccuracy:
    'Training accuracy är accuracy på träningsdata: hur väl modellen klarar texterna den har tränat på. Den säger inte hur modellen klarar nya texter.',
  valAccuracy:
    'Validation accuracy är accuracy på valideringsdata: hur väl modellen klarar 20 texter som den inte har tränat på.',
  loss:
    'Loss (på svenska ungefär förlust) mäter hur långt modellens sannolikheter ligger från rätt svar. Lägre är bättre. Den visar ofta mer än accuracy, eftersom den också tar hänsyn till hur säker modellen är.',
  epoch: 'En epok är en genomgång av alla träningstexter. Efter varje epok justeras vikterna lite grann.',
  seed:
    'Slumpfröet bestämmer startvikterna och ordningen på träningstexterna. Samma frö och samma inställningar ger exakt samma resultat varje gång. Ett annat frö kan ge ett annat resultat, även med samma data.',
  learningRate: 'Learning rate (inlärningstakt) bestämmer hur stora steg vikterna tar vid varje justering. För liten ger långsam inlärning, för stor kan ge ostadig träning.',
  batchSize: 'Batchstorlek är hur många träningstexter modellen tittar på innan vikterna justeras.',
  startId:
    'Startläge-id är ett kort fingeravtryck av modellens startvikter. Samma id betyder att modellerna började med exakt samma vikter. Vid jämförelse mellan dataset A och B skiljer id:t eftersom vokabulären är olika stor, men vikterna för gemensamma ord och för utdatalagret är samma.',
};
