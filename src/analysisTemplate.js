import { APP_VERSION } from './config.js';
import { formatDateTime } from './report.js';
import { formatMetric } from './metrics.js';

/**
 * Analysmall för lektion 5: rubriker och stödfrågor med elevens egna siffror ifyllda.
 * Appen skriver ingen analys åt eleven. Alla tolkningar lämnas tomma.
 */
export function buildAnalysisTemplate({ attemptName, now = new Date(), runs, finalTest = null }) {
  const L = [
    'ANALYS – Träna och undersök ett spamfilter',
    `Försöksnamn: ${attemptName || '(inget namn)'}`,
    `Datum och tid: ${formatDateTime(now)}`,
    `Appversion: ${APP_VERSION}`,
    '',
    '1. Frågeställning och hypotes',
    '(Vad ville du undersöka? Vad trodde du skulle hända innan du tränade, och varför?)',
    '',
    '2. Metod',
  ];
  if (runs.length === 0) {
    L.push('(Inga körningar finns i appen just nu. Träna först och skapa mallen igen, eller klistra in dina resultatblock här.)');
  } else {
    for (const r of runs) {
      const s = r.settings;
      L.push(`- ${r.label}: ${r.datasetName}, ${r.counts.spam} spam och ${r.counts.vanlig} vanliga träningstexter, ${s.epochs} epoker, slumpfrö ${s.seed}, learning rate ${String(s.learningRate).replace('.', ',')}, batchstorlek ${s.batchSize}, ${s.hiddenUnits} dolda noder.`);
    }
  }
  L.push('(Beskriv med egna ord vad du jämförde och vad som var lika i alla körningar.)', '', '3. Resultat (siffror från dina körningar)');
  if (runs.length) {
    L.push('Körning | Accuracy | Precision | Recall | F1 | Falskt positiva | Falskt negativa | Training accuracy');
    for (const r of runs) {
      const m = r.validation.metrics;
      L.push(`${r.label} | ${formatMetric(m.accuracy)} | ${formatMetric(m.precision)} | ${formatMetric(m.recall)} | ${formatMetric(m.f1)} | ${m.fp} | ${m.fn} | ${formatMetric(r.train.metrics.accuracy)}`);
    }
  }
  if (finalTest) {
    L.push('', `Sluttest (körts ${finalTest.count} gång/gånger):`);
    for (const e of finalTest.entries) L.push(`- ${e.runLabel}: accuracy ${formatMetric(e.evaluation.metrics.accuracy)}, falskt positiva ${e.evaluation.metrics.fp}, falskt negativa ${e.evaluation.metrics.fn}`);
  }
  L.push(
    '',
    '4. Förklaring',
    '- Vilka fel gjorde modellen? Hur många var falskt positiva och hur många falskt negativa, och vad betyder det i praktiken för en användare?',
    '- Vilka ord eller mönster i träningsdata kan förklara felen? (Titta på felklassificerade texter och felanalysen i appen.)',
    '- Om du jämförde dataset, epoker eller inställningar: vilken skillnad ser du i dina siffror, och hur förklarar du den?',
    '',
    '5. Osäkerhet och begränsningar',
    '- Hur säker är slutsatsen med 20 valideringstexter (och 20 sluttesttexter)? Vad händer med accuracy om en enda text blir rätt eller fel?',
    '- Kan slumpen (slumpfröet) förklara skillnaden? Hur kan du undersöka det?',
    '- Vad kan modellen inte göra? (Den förstår inte text som en människa.)',
    '',
    '6. Slutsats',
    '(Skriv dina slutsatser. Varje påstående ska stödjas av ett tal från tabellen i avsnitt 3.)',
    '',
    '7. Förbättringsförslag',
    '(Vad skulle du ändra i data, inställningar eller tröskel? Vad förutspår du att det ger, och varför?)',
  );
  return L.join('\n');
}

export const PEER_REVIEW_CHECKLIST = [
  'Stöds varje påstående i slutsatsen av ett tal från författarens egna körningar?',
  'Står det tydligt vilka inställningar (dataset, epoker, slumpfrö) som användes i varje jämförelse?',
  'Jämförs körningar som bara skiljer sig på en sak i taget?',
  'Förklaras både falskt positiva och falskt negativa med egna ord, och kopplas de till träningsdata?',
  'Nämns osäkerheten (få valideringstexter, slumpen) och drar författaren inte större slutsatser än siffrorna tillåter?',
  'Används sluttestet bara som ett sista test och inte för att justera modellen?',
  'Påstår texten någonstans att modellen "förstår" eller "vet" något på ett mänskligt sätt? Kan det formuleras mer exakt?',
];

export const peerReviewText = () => ['GRANSKNINGSCHECKLISTA (kamratgranskning)', '', ...PEER_REVIEW_CHECKLIST.map((q, i) => `${i + 1}. ${q}\n   Svar/kommentar:`)].join('\n');
