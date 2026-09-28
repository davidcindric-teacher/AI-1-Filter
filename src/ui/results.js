import { APP_VERSION, LABEL_NAMES } from '../config.js';
import { formatMetric, formatNumber, misclassified } from '../metrics.js';
import { EXPLAIN } from '../text/explanations.js';
import { architectureText } from '../report.js';
import { analyzeErrors, bestEpochIndex } from '../analysis.js';
import { legend, lineChart } from './charts.js';
import { explained, h, replace, table } from './dom.js';
import { goToSection } from './nav.js';
import { mountRestore } from './save.js';

const pct = (v) => formatMetric(v);

/** Neutral, försiktig tolkning av kurvorna. Påstår aldrig att fler epoker alltid ger bättre resultat. */
export function interpretationNotes(run) {
  const last = run.history[run.history.length - 1];
  const gap = (last.trainAccuracy - last.valAccuracy) * 100;
  const notes = [];
  if (last.trainAccuracy < 0.8 && last.valAccuracy < 0.8) {
    notes.push('Både training accuracy och validation accuracy är låga. Det kan vara ett tecken på underanpassning: modellen har inte hunnit lära sig mönstren. Fler epoker, mer varierad data eller en annan inlärningstakt kan prövas, men det finns ingen garanti.');
  }
  if (gap >= 15) {
    notes.push(`Training accuracy är ${gap.toFixed(0).replace('.', ',')} procentenheter högre än validation accuracy. Ett stort avstånd kan vara ett tecken på överanpassning: modellen klarar träningstexterna bättre än nya texter. Med bara 20 valideringstexter är slutsatsen osäker.`);
  }
  const bestVal = Math.max(...run.history.map((e) => e.valAccuracy ?? 0));
  if (bestVal - last.valAccuracy >= 0.1) {
    notes.push('Validation accuracy var som bäst tidigare under träningen och är lägre i slutet. Det kan vara ett tecken på överanpassning, men kan också bero på slumpen när valideringsmängden är så liten.');
  }
  if (notes.length === 0) {
    notes.push('Inga tydliga tecken på under- eller överanpassning enligt de här enkla måtten, men det utesluter inte problem. Jämför kurvorna och testa modellen på egna texter.');
  }
  if (run.history.length > 1) {
    const best = bestEpochIndex(run.history);
    notes.push(`Högst validation accuracy (${pct(run.history[best].valAccuracy)}) nåddes vid epok ${best + 1} (markerad i diagrammet). Att välja epok efter så här få valideringstexter är osäkert, och en epok som valts efter valideringsresultatet är inte längre ett oberoende resultat.`);
  }
  return notes;
}

function metricsTable(run) {
  const m = run.validation.metrics;
  return table({
    caption: `Mått på valideringsdata (${m.n} texter)`,
    headers: ['Mått', 'Värde'],
    rowHeaders: true,
    className: 'plain',
    rows: [
      [explained('Validation accuracy', EXPLAIN.valAccuracy), pct(m.accuracy)],
      [explained('Precision för spam', EXPLAIN.precision), pct(m.precision)],
      [explained('Recall för spam', EXPLAIN.recall), pct(m.recall)],
      [explained('F1 för spam', EXPLAIN.f1), pct(m.f1)],
    ],
  });
}

/** Training accuracy mäts på träningsdata och står därför för sig, inte i tabellen över valideringsdata. */
function trainAccuracyLine(run) {
  return h('p', { class: 'train-accuracy' }, 'På träningsdata: ', explained('Training accuracy', EXPLAIN.trainAccuracy), ' ', h('strong', { text: pct(run.train.metrics.accuracy) }));
}

/** errorTypes: visa förklaringen av falskt positivt/negativt under matrisen (bara vid den första på sidan). */
export function confusionTable(m, caption = 'Förväxlingsmatris', { errorTypes = false } = {}) {
  return h(
    'div',
    { class: 'confusion' },
    h('p', { class: 'table-title' }, explained(caption, EXPLAIN.confusion)),
    h(
      'div',
      { class: 'table-scroll' },
      h(
        'table',
        { class: 'matrix' },
        h('thead', {}, h('tr', {}, h('td', {}), h('th', { scope: 'col', text: 'Modellen svarade: spam' }), h('th', { scope: 'col', text: 'Modellen svarade: vanligt' }))),
        h(
          'tbody',
          {},
          h('tr', {}, h('th', { scope: 'row', text: 'Riktig klass: spam' }), h('td', { class: 'good' }, h('strong', { text: String(m.tp) }), h('br'), explained('Sant positiva', EXPLAIN.tp)), h('td', { class: 'bad' }, h('strong', { text: String(m.fn) }), h('br'), explained('Falskt negativa', EXPLAIN.fn))),
          h('tr', {}, h('th', { scope: 'row', text: 'Riktig klass: vanligt' }), h('td', { class: 'bad' }, h('strong', { text: String(m.fp) }), h('br'), explained('Falskt positiva', EXPLAIN.fp)), h('td', { class: 'good' }, h('strong', { text: String(m.tn) }), h('br'), explained('Sant negativa', EXPLAIN.tn))),
        ),
      ),
    ),
    !errorTypes ? null : h('ul', { class: 'error-types' }, h('li', {}, h('strong', { text: 'Falskt positivt: ' }), 'ett vanligt meddelande klassificeras som spam.'), h('li', {}, h('strong', { text: 'Falskt negativt: ' }), 'spam släpps igenom som vanligt meddelande.')),
  );
}

export function misclassifiedTable(rows, emptyText = 'Inga texter klassificerades fel.') {
  const wrong = misclassified(rows);
  if (wrong.length === 0) return h('p', { class: 'ok', text: emptyText });
  return table({
    caption: `Felklassificerade texter (${wrong.length} st)`,
    headers: ['Text', 'Riktig klass', 'Modellens svar', 'Spam-sannolikhet', 'Typ av fel'],
    rows: wrong.map((r) => [r.text, LABEL_NAMES[r.label], LABEL_NAMES[r.predicted], pct(r.probability), r.label === 'vanlig' ? 'Falskt positiv' : 'Falskt negativ']),
  });
}

/** Felanalys: vilka ord fanns i de felklassificerade texterna och hur vanliga är de i träningsdatan? */
function errorAnalysis(run) {
  const { items, unknownWords } = analyzeErrors(run);
  if (items.length === 0) return null;
  return h(
    'details',
    { class: 'only-standard' },
    h('summary', { text: 'Felanalys: vilka ord fanns i de felklassificerade texterna?' }),
    h('p', { class: 'muted', text: 'S = antal spamtexter i träningsdatan där ordet finns, V = antal vanliga texter. Ord som modellen inte känner igen (finns inte i träningsdatan) ignoreras helt av modellen.' }),
    table({
      headers: ['Text', 'Fel', 'Ord (S/V)'],
      rows: items.map(({ row, words }) => [
        row.text,
        row.label === 'vanlig' ? 'Falskt positiv' : 'Falskt negativ',
        h('span', {}, words.map((w, i) => [h('span', { class: `token ${w.known ? 'known' : 'unknown'}`, text: w.known ? `${w.word} (${w.spamCount}/${w.hamCount})` : `${w.word} (okänt)` }), i < words.length - 1 ? ' ' : ''])),
      ]),
    }),
    h('p', {}, unknownWords.length ? `Ord i felen som saknas i träningsdatan: ${unknownWords.join(', ')}.` : 'Alla ord i de felklassificerade texterna finns i träningsdatan.'),
    h('p', { class: 'muted', text: 'Fundera på: Finns orden mest i den andra klassen i träningsdatan? Saknas viktiga ord helt? Vad skulle du behöva lägga till för att modellen ska klara texten?' }),
  );
}

function accuracyChart(run) {
  const tr = run.history.map((e) => e.trainAccuracy);
  const va = run.history.map((e) => e.valAccuracy);
  const last = run.history[run.history.length - 1];
  return h(
    'div',
    { class: 'charts' },
    h(
      'figure',
      {},
      h('figcaption', {}, explained('Training accuracy och validation accuracy per epok', EXPLAIN.accuracy)),
      lineChart({
        series: [{ key: 'train', values: tr }, { key: 'validation', values: va }],
        marker: run.history.length > 1 ? { key: 'validation', index: bestEpochIndex(run.history) } : null,
        title: `Accuracy per epok för ${run.label}`,
        description: `Efter ${run.settings.epochs} epoker: training accuracy ${pct(last.trainAccuracy)}, validation accuracy ${pct(last.valAccuracy)}.`,
      }),
    ),
    legend(h, { marker: run.history.length > 1 }),
  );
}

function lossChart(run) {
  const trl = run.history.map((e) => e.trainLoss);
  const val = run.history.map((e) => e.valLoss);
  const last = run.history[run.history.length - 1];
  const lossMax = Math.ceil(Math.max(0.7, ...trl, ...val) * 10) / 10;
  return h(
    'figure',
    { class: 'charts' },
    h('figcaption', {}, explained('Training loss och validation loss per epok', EXPLAIN.loss)),
    lineChart({
      series: [{ key: 'train', values: trl }, { key: 'validation', values: val }],
      yMax: lossMax,
      percent: false,
      title: `Loss per epok för ${run.label}`,
      description: `Efter ${run.settings.epochs} epoker: training loss ${formatNumber(last.trainLoss)}, validation loss ${formatNumber(last.valLoss)}.`,
    }),
  );
}

function epochTable(run) {
  return h(
    'details',
    { class: 'epoch-details' },
    h('summary', { text: `Visa värden för alla ${run.history.length} epoker` }),
    h(
      'div',
      { class: 'table-scroll tall' },
      table({
        headers: ['Epok', 'Training accuracy', 'Validation accuracy', 'Training loss', 'Validation loss', 'Precision (val.)', 'Recall (val.)', 'F1 (val.)'],
        rows: run.history.map((e) => [String(e.epoch), pct(e.trainAccuracy), pct(e.valAccuracy), formatNumber(e.trainLoss), formatNumber(e.valLoss), pct(e.valPrecision), pct(e.valRecall), pct(e.valF1)]),
      }),
    ),
  );
}

/**
 * Ett resultatkort. Det viktigaste (mått, förväxlingsmatris, felen, accuracy-kurvan) syns direkt.
 * Tekniska detaljer (modell, startläge-id, loss-kurva, alla epoker) ligger bakom "Detaljer".
 * Egna texter testas i nästa steg (Testa egen text), inte i kortet.
 * I lektion 3 visas tolkningstipsen om under- och överanpassning direkt eftersom de är lektionens fokus.
 */
function runArticle(run, index, lesson, store) {
  const s = run.settings;
  const headingId = `run-h-${run.id}`;
  const notes = h('div', { class: 'notes' }, h('h4', { text: 'Möjliga tecken att undersöka' }), h('ul', {}, interpretationNotes(run).map((t) => h('li', { text: t }))));
  const notesInMain = lesson === 3 || lesson === 'all';
  const meta = h(
    'dl',
    { class: 'meta' },
    h('div', {}, h('dt', { text: 'Dataset' }), h('dd', { text: `${run.datasetName} (version ${run.datasetVersion}), ${run.counts.spam} spam och ${run.counts.vanlig} vanliga` })),
    h('div', {}, h('dt', {}, explained('Slumpfrö', EXPLAIN.seed)), h('dd', { text: String(s.seed) })),
    h('div', {}, h('dt', { text: 'Modell' }), h('dd', { text: `${run.vocabSize} ord in → ${s.hiddenUnits} noder (ReLU) → sigmoid, tröskel ${formatNumber(s.threshold, 2)}` })),
    h('div', {}, h('dt', { text: 'Learning rate / batch' }), h('dd', { text: `${formatNumber(s.learningRate, 3)} / ${s.batchSize} (SGD)` })),
    h('div', {}, h('dt', {}, explained('Startläge-id', EXPLAIN.startId)), h('dd', { text: run.startId })),
    h('div', {}, h('dt', { text: 'Appversion' }), h('dd', { text: APP_VERSION })),
  );
  return h(
    'article',
    { class: 'run', 'aria-labelledby': headingId },
    h('h3', { id: headingId, text: `Körning ${index + 1}: ${run.label}` }),
    h('p', { class: 'run-summary', text: `${run.datasetName} · ${s.epochs} epoker · slumpfrö ${s.seed}` }),
    metricsTable(run),
    trainAccuracyLine(run),
    confusionTable(run.validation.metrics, 'Förväxlingsmatris (valideringsdata)', { errorTypes: index === 0 }),
    misclassifiedTable(run.validation.rows),
    accuracyChart(run),
    notesInMain ? notes : null,
    errorAnalysis(run),
    h('details', { class: 'only-standard run-details' }, h('summary', { text: 'Detaljer: modell, loss-kurva och värden per epok' }), meta, lossChart(run), notesInMain ? null : notes, epochTable(run)),
  );
}

function comparison(runs, mode) {
  const row = (label, fn) => [label, ...runs.map(fn)];
  const showVocab = ['compare-datasets', 'compare-abc'].includes(mode);
  const showLr = mode === 'compare-lr';
  const showHidden = mode === 'compare-hidden';
  const mainRows = [
    // Raden behövs bara när kolumnrubrikerna inte redan är datasetens namn (t.ex. i lektion 3).
    runs.every((r) => r.label === r.datasetName) ? null : row('Dataset', (r) => r.datasetName),
    row('Antal epoker', (r) => String(r.settings.epochs)),
    row('Slumpfrö', (r) => String(r.settings.seed)),
    row('Startläge-id', (r) => r.startId),
    showVocab ? row('Ord i vokabulären', (r) => String(r.vocabSize)) : null,
    showLr ? row('Learning rate', (r) => formatNumber(r.settings.learningRate, 3)) : null,
    showHidden ? row('Antal dolda noder', (r) => String(r.settings.hiddenUnits)) : null,
    row('Training accuracy', (r) => pct(r.train.metrics.accuracy)),
    row('Validation accuracy', (r) => pct(r.validation.metrics.accuracy)),
    row('Precision (spam)', (r) => pct(r.validation.metrics.precision)),
    row('Recall (spam)', (r) => pct(r.validation.metrics.recall)),
    row('F1 (spam)', (r) => pct(r.validation.metrics.f1)),
    row('Falskt positiva', (r) => String(r.validation.metrics.fp)),
    row('Falskt negativa', (r) => String(r.validation.metrics.fn)),
  ].filter(Boolean);
  const techRows = [
    showVocab ? null : row('Ord i vokabulären', (r) => String(r.vocabSize)),
    showLr ? null : row('Learning rate', (r) => formatNumber(r.settings.learningRate, 3)),
    showHidden ? null : row('Antal dolda noder', (r) => String(r.settings.hiddenUnits)),
  ].filter(Boolean);
  const headers = ['', ...runs.map((r) => r.label)];
  return h(
    'div',
    { class: 'comparison' },
    h('h3', { text: 'Jämförelse sida vid sida' }),
    table({ caption: 'Alla körningar har samma valideringsdata.', headers, rowHeaders: true, rows: mainRows }),
    techRows.length ? h('details', { class: 'only-standard' }, h('summary', { text: 'Fler tekniska uppgifter' }), table({ headers, rowHeaders: true, rows: techRows })) : null,
  );
}

/** Kompakt tabell över alla körningar i sessionen, så att man kan jämföra även efter att ha tränat om. */
function historyBox(history, onClear) {
  if (history.length < 2) return null;
  return h(
    'details',
    { class: 'history' },
    h('summary', { text: `Alla dina körningar hittills (${history.length})` }),
    table({
      caption: 'För att jämföra körningar även när du ändrat en inställning och tränat om. Tabellen finns kvar tills du laddar om sidan och tas med i resultatblocket.',
      headers: ['Nr', 'Körning', 'Epoker', 'Frö', 'Validation accuracy', 'Precision', 'Recall', 'Falskt pos.', 'Falskt neg.'],
      rows: history.map((e) => [String(e.nr), e.label, String(e.epochs), String(e.seed), pct(e.valAccuracy), pct(e.precision), pct(e.recall), String(e.fp), String(e.fn)]),
    }),
    h('button', { type: 'button', class: 'btn btn-small btn-secondary', text: 'Rensa historiken', onclick: onClear }),
  );
}

/**
 * Visar körningarna. Med 1–2 körningar (lektion 1, 2 och 4) ryms alla sida vid sida.
 * Med 3 körningar (lektion 3, och de utökade laborationerna) blir tre fulla kort mycket långt att scrolla,
 * så här väljer eleven i stället en körning i taget med flikknappar. Jämförelsetabellen ovanför visar
 * ändå alla körningar samtidigt, så inget mått försvinner – bara de tunga korten (diagram, felanalys, snabbtest).
 */
function runsView(runs, lesson, store, tabState) {
  if (runs.length < 3) {
    return h('div', { class: `run-grid runs-${runs.length}` }, runs.map((r, i) => runArticle(r, i, lesson, store)));
  }
  if (tabState.index >= runs.length) tabState.index = 0;
  const panel = h('div', { class: 'run-tab-panel' });
  const buttons = runs.map((r, i) =>
    h('button', {
      type: 'button',
      class: 'btn run-tab',
      'aria-pressed': String(i === tabState.index),
      text: r.label,
      onclick: () => select(i),
    }),
  );
  function select(i) {
    tabState.index = i;
    buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    replace(panel, runArticle(runs[i], i, lesson, store));
  }
  select(tabState.index);
  return h(
    'div',
    { class: 'run-tabset' },
    h('p', { class: 'muted run-tabset-hint', text: 'Jämförelsetabellen ovan visar alla körningar samtidigt. Välj en körning nedan för att se hela resultatkortet (mått, diagram och fel) för just den.' }),
    h('div', { class: 'run-tabs', role: 'group', 'aria-label': 'Välj körning att visa i sin helhet' }, buttons),
    panel,
  );
}

const SMALL_DATA = 'Ett litet testunderlag (20 valideringstexter) ger osäkra slutsatser: en enda text ändrar accuracy med 5 procentenheter.';

/** Varningsrutans punkter: den om litet underlag alltid, resten efter vad lektionen handlar om. */
export function cautionPoints(lesson) {
  const byLesson = {
    1: ['Hög accuracy betyder inte automatiskt att modellen är bra. Precision och recall visar olika typer av fel.', 'Resultatet beror på träningsdata, slumpfrö och inställningar.'],
    2: ['Båda modellerna har samma inställningar och samma valideringsdata, så skillnaden kommer från träningsdatan. Men en skillnad på en eller två texter kan också vara slump.'],
    3: ['Fler epoker ger inte alltid bättre resultat. Jämför training accuracy med validation accuracy för att se om modellen lär sig träningstexterna utantill.'],
    4: ['En förbättring på valideringsdata behöver inte hålla på nya texter. Därför finns sluttestet.'],
  };
  if (byLesson[lesson]) return [SMALL_DATA, ...byLesson[lesson]];
  return [
    'Resultatet beror på träningsdata, slumpfrö och inställningar.',
    SMALL_DATA,
    'Hög accuracy betyder inte automatiskt att modellen är bra. Precision och recall visar olika typer av fel.',
    'Resultat på valideringsdata garanterar inte samma resultat på nya texter.',
    'Fler epoker ger inte alltid bättre resultat. Du måste kunna förklara dina resultat med stöd i dina egna försök.',
  ];
}

export function mountResults(root, store, { onCopy }) {
  const body = h('div');
  // Lektion 5: resultaten finns bara kvar tills sidan laddas om, så eleven läser först in en återställningstext
  // från en tidigare lektion. Rutan byggs en gång (inte i render) så att meddelandet efter inläsningen finns kvar.
  const restoreRoot = h('div');
  const restoreBox = h(
    'div',
    { class: 'callout restore-box' },
    h('h3', { text: 'Börja här: läs in dina resultat' }),
    h('p', {}, 'Resultaten från tidigare lektioner finns inte kvar i appen. Klistra in återställningstexten från ditt arbetsdokument, till exempel från lektion 4, och träna sedan om. Du får exakt samma resultat som förra gången.'),
    restoreRoot,
  );
  mountRestore(restoreRoot, store, { idPrefix: 'result-', keepLesson: true });
  root.append(restoreBox, body);
  let last = [];
  let lastRunsForTabs = null;
  const tabState = { index: 0 };
  const render = (state) => {
    restoreBox.hidden = !(state.lesson === 5 && state.runs.length === 0);
    const sig = [state.runs, state.lesson, state.history, state.runsMode, state.mode];
    if (sig.every((v, i) => v === last[i])) return;
    last = sig;
    if (state.runs !== lastRunsForTabs) {
      lastRunsForTabs = state.runs;
      tabState.index = 0;
    }
    const runs = state.runs;
    const improveFlow = state.runsMode === 'improve' && (state.lesson === 4 || state.lesson === 'all');
    const retrain = improveFlow ? '#fore-efter' : '#trana';
    if (runs.length === 0) {
      const howTo = state.mode === 'improve' ? 'Klicka på "Träna före och efter" i steget Träna före och efter.' : 'Klicka på "Träna från början" i steget Träna modellen.';
      replace(body, state.lesson === 5 ? null : h('p', { class: 'muted', text: `Inga resultat ännu. ${howTo}` }));
      return;
    }
    replace(
      body,
      h(
        'div',
        { class: 'callout only-standard' },
        h('p', {}, h('strong', { text: 'Läs resultaten med försiktighet.' })),
        h('ul', {}, cautionPoints(state.lesson).map((t) => h('li', { text: t }))),
      ),
      h('p', { class: 'callout only-simple' }, h('strong', { text: 'Tänk på: ' }), 'Resultatet beror på träningsdata. 20 valideringstexter är få, så slutsatserna är osäkra. Hög accuracy betyder inte automatiskt en bra modell.'),
      h(
        'div',
        { class: 'button-row result-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', text: 'Kopiera resultatblock', onclick: () => onCopy('result') }),
        // I lektion 4 leder knapparna vidare i förbättringsflödet i stället för tillbaka till början.
        improveFlow ? h('a', { class: 'btn btn-secondary btn-link', href: '#sluttest', text: 'Gå till sluttestet', onclick: (e) => { e.preventDefault(); goToSection('#sluttest'); } }) : null,
        state.lesson === 5 || improveFlow ? null : h('a', { class: 'btn btn-secondary btn-link', href: '#testa', text: 'Testa egen text', onclick: (e) => { e.preventDefault(); goToSection('#testa'); } }),
        state.lesson === 5 ? null : h('a', { class: 'btn btn-secondary btn-link', href: retrain, text: 'Träna om', onclick: (e) => { e.preventDefault(); goToSection(retrain); } }),
      ),
      runs.length > 1 ? comparison(runs, state.runsMode) : null,
      runsView(runs, state.lesson, store, tabState),
      // Historiken (hopfälld, sist) visas först när det finns äldre körningar utöver de som redan syns ovan.
      state.history.length > runs.length ? historyBox(state.history, () => store.set({ history: [] })) : null,
      h('p', { class: 'muted only-standard', text: `Modellbeskrivning: ${architectureText(runs[0])}` }),
    );
  };
  store.subscribe(render);
  render(store.get());
}
