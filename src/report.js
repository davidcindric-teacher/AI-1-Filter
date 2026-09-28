import { APP_VERSION, LABEL_NAMES, THRESHOLD } from './config.js';
import { formatMetric, formatNumber, misclassified } from './metrics.js';
import { summarizeSpread } from './thresholdAnalysis.js';

/**
 * Bygger ett resultatblock i vanlig, läsbar text som kan klistras in i Google Docs eller Word.
 * Inga uppgifter hårdkodas: allt kommer från de körningar som eleven faktiskt har gjort.
 *
 * input = { attemptName, now: Date, runs: [result], testLog: [{ runLabel, text, probability, predicted }],
 *           finalTest: null | { count, entries: [{ runLabel, evaluation }] }, changes: [{ label, before, after }] }
 */

export const formatDateTime = (date) =>
  new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);

/** Ett begripligt urval av epoker att visa i kurvtabellen. */
export function sampleEpochs(total) {
  const wanted = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 250, 300];
  const set = new Set(wanted.filter((e) => e <= total));
  set.add(total);
  return [...set].sort((a, b) => a - b);
}

/** Skillnad i procentenheter, t.ex. "+5,0" eller "-10,0". */
export function formatDiff(after, before) {
  if (after === null || before === null) return 'Ej definierat';
  const d = (after - before) * 100;
  return `${d > 0 ? '+' : ''}${d.toFixed(1).replace('.', ',')}`;
}

/** Hur många frön blev bättre, lika eller sämre efter förbättringen (mätt i validation accuracy)? */
export function summarizeImprovement(pairs) {
  const res = { better: 0, same: 0, worse: 0, n: pairs.length };
  for (const p of pairs) {
    const d = Math.round((p.after.validation.metrics.accuracy - p.before.validation.metrics.accuracy) * 1e6);
    if (d > 0) res.better++;
    else if (d < 0) res.worse++;
    else res.same++;
  }
  return res;
}

export const architectureText = (r) =>
  `Indata: ${r.vocabSize} ord (bag-of-words, 1 om ordet finns, annars 0) → dolt lager: ${r.settings.hiddenUnits} noder med ReLU → utdata: 1 nod med sigmoid (sannolikhet för spam). Klassificering: spam om sannolikheten är minst ${formatNumber(r.settings.threshold, 2)}. Optimerare: SGD.`;

function metricLines(m) {
  return [
    `Accuracy: ${formatMetric(m.accuracy)}`,
    `Precision (spam): ${formatMetric(m.precision)}`,
    `Recall (spam): ${formatMetric(m.recall)}`,
    `F1 (spam): ${formatMetric(m.f1)}`,
    'Förväxlingsmatris (rader = riktig klass, kolumner = modellens svar):',
    `  Riktig spam:        modellen sa spam: ${m.tp} (sant positiva) | modellen sa vanligt: ${m.fn} (falskt negativa)`,
    `  Riktigt vanligt:    modellen sa spam: ${m.fp} (falskt positiva) | modellen sa vanligt: ${m.tn} (sant negativa)`,
    `Antal fel: falskt positiva = ${m.fp}, falskt negativa = ${m.fn}`,
  ];
}

function errorLines(rows, title) {
  const errors = misclassified(rows);
  if (errors.length === 0) return [`${title}: inga`];
  return [
    `${title} (${errors.length} st):`,
    ...errors.map(
      (r) =>
        `  - "${r.text}" | riktig klass: ${LABEL_NAMES[r.label]} | modellens svar: ${LABEL_NAMES[r.predicted]} | spam-sannolikhet: ${formatMetric(r.probability)}`,
    ),
  ];
}

function runSection(run, index) {
  const s = run.settings;
  const epochs = sampleEpochs(s.epochs);
  const lines = [
    `--- Körning ${index + 1}: ${run.label} ---`,
    `Dataset: ${run.datasetName} (datasetversion ${run.datasetVersion})`,
    `Antal träningstexter: ${run.counts.spam} spam och ${run.counts.vanlig} vanliga`,
    'Valideringsdata: 20 fasta texter (10 spam, 10 vanliga), används inte för träning',
    `Slumpfrö: ${s.seed}`,
    `Antal epoker: ${s.epochs}`,
    `Modellarkitektur: ${architectureText(run)}`,
    `Learning rate: ${formatNumber(s.learningRate, 3)}`,
    `Batchstorlek: ${s.batchSize}`,
    `Startläge-id (fingeravtryck av startvikterna): ${run.startId}`,
    '',
    'Resultat på valideringsdata (slutlig modell):',
    ...metricLines(run.validation.metrics),
    ...errorLines(run.validation.rows, 'Felklassificerade texter i valideringsdata'),
    '',
    `Träffsäkerhet på träningsdata: ${formatMetric(run.train.metrics.accuracy)} (training accuracy)`,
    `Träffsäkerhet på valideringsdata: ${formatMetric(run.validation.metrics.accuracy)} (validation accuracy)`,
    '',
    'Kurvvärden (urval av epoker): epok | training accuracy | validation accuracy | träningsförlust | valideringsförlust',
    ...epochs.map((e) => {
      const h = run.history[e - 1];
      return `  ${e} | ${formatMetric(h.trainAccuracy)} | ${formatMetric(h.valAccuracy)} | ${formatNumber(h.trainLoss)} | ${formatNumber(h.valLoss)}`;
    }),
  ];
  return lines;
}

export function buildResultBlock({ attemptName, now = new Date(), runs, testLog = [], finalTest = null, changes = [], history = [], seedExperiment = null, seedImprove = null, thresholdExp = null }) {
  const lines = [
    'RESULTAT – Träna och undersök ett spamfilter',
    `Försöksnamn: ${attemptName || '(inget namn)'}`,
    `Datum och tid: ${formatDateTime(now)}`,
    `Appversion: ${APP_VERSION}`,
    '',
  ];
  if (runs.length === 0) {
    lines.push('Inga körningar ännu. Träna en modell först.');
  }
  runs.forEach((run, i) => {
    lines.push(...runSection(run, i), '');
  });

  if (history.length > 1) {
    lines.push(
      'Körningshistorik (alla körningar i den här sessionen):',
      '  nr | tid | körning | epoker | frö | training accuracy | validation accuracy | precision | recall | F1 | falskt pos. | falskt neg.',
      ...history.map((h) => `  ${h.nr} | ${h.time} | ${h.label} | ${h.epochs} | ${h.seed} | ${formatMetric(h.trainAccuracy)} | ${formatMetric(h.valAccuracy)} | ${formatMetric(h.precision)} | ${formatMetric(h.recall)} | ${formatMetric(h.f1)} | ${h.fp} | ${h.fn}`),
      '',
    );
  }

  if (changes.length) {
    lines.push('Ändrade träningstexter (dataset B före och efter):');
    for (const c of changes) lines.push(`  - Klass ${c.label}: "${c.before}" → "${c.after}"`);
    lines.push('');
  }

  if (testLog.length) {
    lines.push('Egna testtexter (påverkar inte modellen):');
    for (const t of testLog) {
      lines.push(`  - [${t.runLabel}] "${t.text}" → ${LABEL_NAMES[t.predicted]} (spam-sannolikhet ${formatMetric(t.probability)})`);
    }
    lines.push('');
  }

  if (seedExperiment && seedExperiment.runs.length) {
    const sp = summarizeSpread(seedExperiment.runs);
    const first = seedExperiment.runs[0];
    lines.push(
      `Frö-experiment: ${first.datasetName}, ${first.settings.epochs} epoker, samma inställningar men ${seedExperiment.runs.length} olika slumpfrön`,
      '  frö | training accuracy | validation accuracy | precision | recall | F1 | falskt positiva | falskt negativa',
      ...seedExperiment.runs.map((r) => {
        const m = r.validation.metrics;
        return `  ${r.settings.seed} | ${formatMetric(r.train.metrics.accuracy)} | ${formatMetric(m.accuracy)} | ${formatMetric(m.precision)} | ${formatMetric(m.recall)} | ${formatMetric(m.f1)} | ${m.fp} | ${m.fn}`;
      }),
      `  Validation accuracy varierade mellan ${formatMetric(sp.min)} och ${formatMetric(sp.max)} (medelvärde ${formatMetric(sp.mean)}).`,
      '',
    );
  }

  if (seedImprove && seedImprove.pairs.length) {
    lines.push('Före/efter över flera frön (dataset B före och efter förbättringen, samma inställningar):', '  frö | validation accuracy före | efter | skillnad (procentenheter) | falskt pos. före/efter | falskt neg. före/efter');
    for (const p of seedImprove.pairs) {
      const [b, a] = [p.before.validation.metrics, p.after.validation.metrics];
      lines.push(`  ${p.before.settings.seed} | ${formatMetric(b.accuracy)} | ${formatMetric(a.accuracy)} | ${formatDiff(a.accuracy, b.accuracy)} | ${b.fp}/${a.fp} | ${b.fn}/${a.fn}`);
    }
    const s = summarizeImprovement(seedImprove.pairs);
    lines.push(`  Efter var bättre i ${s.better} av ${s.n} frön, lika i ${s.same} och sämre i ${s.worse}.`, '');
  }

  if (thresholdExp) {
    const m = thresholdExp.metrics;
    lines.push(
      `Tröskelexperiment på valideringsdata (modell: ${thresholdExp.runLabel}). Den vanliga modellen använder tröskel ${formatNumber(THRESHOLD, 2)}.`,
      `  Vald tröskel: ${formatNumber(thresholdExp.threshold, 2)} | accuracy ${formatMetric(m.accuracy)} | precision ${formatMetric(m.precision)} | recall ${formatMetric(m.recall)} | F1 ${formatMetric(m.f1)} | falskt positiva ${m.fp} | falskt negativa ${m.fn}`,
      '',
    );
  }

  if (finalTest) {
    lines.push(
      `SLUTTEST (20 låsta texter, 10 spam och 10 vanliga). Sluttestet har körts ${finalTest.count} gång(er).`,
      'Sluttestet får inte användas för att justera modellen efteråt.',
    );
    for (const { runLabel, evaluation } of finalTest.entries) {
      lines.push(`Modell: ${runLabel}`, ...metricLines(evaluation.metrics), ...errorLines(evaluation.rows, 'Felklassificerade texter i sluttestet'), '');
    }
  }

  lines.push(
    'Att tänka på:',
    '- Resultatet beror på träningsdata, slumpfrö och inställningar.',
    '- 20 valideringstexter (och 20 sluttesttexter) är ett litet underlag, så slutsatser är osäkra.',
    '- Hög accuracy betyder inte automatiskt att modellen är bra. Precision och recall visar olika typer av fel.',
    '- Resultat på valideringsdata garanterar inte samma resultat på nya texter.',
    `- Modellen förstår inte text som en människa: den räknar med vilka ord som finns (tröskel ${formatNumber(THRESHOLD, 2)}).`,
  );
  return lines.join('\n');
}
