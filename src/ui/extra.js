import { DATASETS } from '../data/index.js';
import { formatMetric } from '../metrics.js';
import { metricsAtThreshold, summarizeSpread, sweepThresholds } from '../thresholdAnalysis.js';
import { SEED_COUNT } from '../experiments.js';
import { THRESHOLD } from '../config.js';
import { CHALLENGES } from '../text/challenges.js';
import { h, replace, table } from './dom.js';
import { confusionTable } from './results.js';
import { runDisplayName } from './tester.js';
import { mountWords } from './extraWords.js';
import { mountMix } from './extraMix.js';
import { mountImproveSeeds } from './extraImprove.js';
import { mountAnalysis } from './extraAnalysis.js';
import { startSeedExperiment } from './train.js';

const pct = formatMetric;

/** Extra 1: samma träning med flera slumpfrön. */
function mountSeed(root, store) {
  const info = h('p', { class: 'muted' });
  const btn = h('button', { type: 'button', class: 'btn btn-primary', text: `Kör med ${SEED_COUNT} olika frön`, onclick: () => startSeedExperiment(store) });
  const out = h('div');
  root.append(
    h('h3', { text: 'Frö-experiment' }),
    h('p', {}, 'Ett resultat beror delvis på slumpen (startvikter och ordning på träningstexterna). Här tränas samma modell med samma data och inställningar men med ', String(SEED_COUNT), ' olika slumpfrön i följd. Då ser du hur mycket resultatet varierar bara på grund av slumpen.'),
    info,
    h('div', { class: 'button-row' }, btn),
    out,
  );
  let lastRuns = null;
  const render = (state) => {
    const ds = state.datasetKey === 'custom' ? 'din förbättrade version av B' : DATASETS[state.datasetKey].name;
    const s = state.settings;
    info.textContent = `Använder ${ds} (steget Välj dataset), ${s.epochs} epoker och frö ${s.seed}, ${s.seed + 1}, … (steget Välj inställningar).`;
    btn.disabled = Boolean(state.training);
    const exp = state.seedExperiment;
    if (exp === lastRuns) return;
    lastRuns = exp;
    if (!exp) {
      replace(out);
      return;
    }
    const sp = summarizeSpread(exp.runs);
    replace(
      out,
      table({
        caption: `${exp.runs[0].datasetName}, ${exp.runs[0].settings.epochs} epoker: resultat för olika frön`,
        headers: ['Frö', 'Training accuracy', 'Validation accuracy', 'Precision', 'Recall', 'F1', 'Falskt pos.', 'Falskt neg.'],
        rows: exp.runs.map((r) => {
          const m = r.validation.metrics;
          return [String(r.settings.seed), pct(r.train.metrics.accuracy), pct(m.accuracy), pct(m.precision), pct(m.recall), pct(m.f1), String(m.fp), String(m.fn)];
        }),
      }),
      h('p', {}, h('strong', { text: 'Spridning: ' }), `validation accuracy varierade mellan ${pct(sp.min)} och ${pct(sp.max)} (medelvärde ${pct(sp.mean)}).`),
      h('p', { class: 'muted', text: 'Skillnader som är lika små som spridningen här kan bero på slumpen. Fundera på vad det betyder för hur säkra dina slutsatser är. Resultatet tas med i resultatblocket.' }),
    );
  };
  store.subscribe(render);
  render(store.get());
}

/** Extra 2: tröskelreglage på en redan tränad modell. */
function mountThreshold(root, store) {
  const select = h('select', { id: 'thr-model' });
  const range = h('input', { type: 'range', id: 'thr-range', min: '1', max: '99', step: '1', value: '50', 'aria-describedby': 'thr-help' });
  const output = h('output', { id: 'thr-value', for: 'thr-range', class: 'thr-value', text: '50 %' });
  const out = h('div', { 'aria-live': 'polite' });
  const noRuns = h('p', { class: 'muted', text: 'Träna en modell först (steget Träna modellen).' });
  const controls = h(
    'div',
    {},
    h('div', { class: 'field' }, h('label', { for: 'thr-model', text: 'Modell' }), select),
    h('div', { class: 'field' }, h('label', { for: 'thr-range', text: 'Tröskel för spam' }), h('div', { class: 'range-row' }, range, output)),
    h('p', { class: 'muted', id: 'thr-help', text: 'Modellen svarar spam om sannolikheten är minst tröskeln. Flytta reglaget (eller använd piltangenterna) och se hur felen ändras.' }),
    h('div', { class: 'button-row' }, h('button', { type: 'button', class: 'btn btn-secondary', text: `Återställ till ${Math.round(THRESHOLD * 100)} %`, onclick: () => { range.value = String(Math.round(THRESHOLD * 100)); update(); } })),
  );

  root.append(
    h('h3', { text: 'Tröskelreglage' }),
    h('p', {}, 'Modellen ger en sannolikhet för spam. Tröskeln bestämmer när det räknas som spam. Vad händer med precision, recall och de två typerna av fel om du flyttar tröskeln?'),
    noRuns,
    controls,
    out,
    h('p', { class: 'callout callout-strong' }, h('strong', { text: 'Obs: ' }), 'Det här ändrar inte modellen, bara hur svaret tolkas, och bara på valideringsdata. Den vanliga modellen i resten av appen använder alltid tröskeln 50 %. Använd inte sluttestet för att välja tröskel.'),
  );

  const currentRun = () => store.get().runs.find((r) => r.id === select.value);

  function update() {
    const run = currentRun();
    if (!run) {
      replace(out);
      return;
    }
    const t = Number(range.value) / 100;
    output.textContent = `${range.value} %`;
    const m = metricsAtThreshold(run.validation.rows, t);
    const base = run.validation.metrics;
    const changed = Math.abs(t - THRESHOLD) > 1e-9;
    store.set({ thresholdExp: changed ? { runLabel: runDisplayName(run), threshold: t, metrics: m } : null });
    replace(
      out,
      table({
        caption: `Mått vid tröskel ${range.value} % (valideringsdata)`,
        headers: ['Mått', `Vid ${range.value} %`, 'Vid 50 % (vanliga modellen)'],
        rowHeaders: true,
        className: 'plain',
        rows: [
          ['Accuracy', pct(m.accuracy), pct(base.accuracy)],
          ['Precision för spam', pct(m.precision), pct(base.precision)],
          ['Recall för spam', pct(m.recall), pct(base.recall)],
          ['F1 för spam', pct(m.f1), pct(base.f1)],
          ['Falskt positiva (vanliga som blockeras)', String(m.fp), String(base.fp)],
          ['Falskt negativa (spam som släpps igenom)', String(m.fn), String(base.fn)],
        ],
      }),
      confusionTable(m, `Förväxlingsmatris vid tröskel ${range.value} %`),
      h('details', {}, h('summary', { text: 'Visa alla trösklar från 10 % till 90 %' }), table({
        headers: ['Tröskel', 'Precision', 'Recall', 'Falskt positiva', 'Falskt negativa'],
        rows: sweepThresholds(run.validation.rows).map((s) => [`${Math.round(s.threshold * 100)} %`, pct(s.metrics.precision), pct(s.metrics.recall), String(s.metrics.fp), String(s.metrics.fn)]),
      })),
      h('p', { class: 'muted', text: `Ett lägre tröskelvärde ger fler svar "spam" (fler falskt positiva, färre falskt negativa). Ett högre ger tvärtom. Vilken sorts fel är värst? Det beror på situationen.` }),
    );
  }

  range.addEventListener('input', update);
  select.addEventListener('change', update);
  let lastRuns = null;
  store.subscribe((state) => {
    if (state.runs === lastRuns) return;
    lastRuns = state.runs;
    const prev = select.value;
    replace(select, state.runs.map((r) => h('option', { value: r.id, text: runDisplayName(r) })));
    if (state.runs.some((r) => r.id === prev)) select.value = prev;
    noRuns.hidden = state.runs.length > 0;
    controls.hidden = state.runs.length === 0;
    update();
  });
  noRuns.hidden = false;
  controls.hidden = true;
}

/** Utmaningar: bara den valda lektionens ruta visas (alla vid "Alla"). */
function mountChallenges(root, store) {
  const KEY = { 1: 'single', 2: 'compare-datasets', 3: 'compare-epochs', 4: 'improve', 5: 'analysis' };
  const boxes = CHALLENGES.map((c) => ({ key: c.key, el: h('details', { class: 'challenge', open: true }, h('summary', { text: c.title }), h('ol', {}, c.tasks.map((t) => h('li', { text: t })))) }));
  root.append(
    h('h3', { text: 'Utmaningar' }),
    h('p', {}, 'Uppgifter för dig som blir klar tidigt. Skriv svaren i ditt eget arbetsdokument. Appen bedömer ingenting.'),
    ...boxes.map((b) => b.el),
  );
  const render = (state) => {
    for (const b of boxes) b.el.hidden = state.lesson !== 'all' && KEY[state.lesson] !== b.key;
  };
  store.subscribe(render);
  render(store.get());
}

export function mountExtra(root, store) {
  // Varje del visas bara i de lektioner den hör till (data-lessons). "Alla" visar allt.
  // Delarna har egna H3-rubriker (inga "Lektion N"-rubriker), så att rubriknivåerna stämmer i varje lektion.
  const part = (lessons) => {
    const el = h('div', { class: 'extra-part' });
    el.dataset.lessons = lessons;
    return el;
  };
  const seed = part('1 2 4');
  const thr = part('1 4');
  const words = part('2');
  const mix = part('2');
  const epochsInfo = part('3');
  const improve = part('4');
  const analysis = part('5');
  const ch = part('1 2 3 4 5');
  root.append(
    h('p', {}, 'Fördjupning för dig som blir klar tidigt. Ingenting här ändrar dina vanliga resultat i steget Resultat. Frö- och tröskelexperiment tas med i resultatblocket.'),
    seed,
    thr,
    words,
    mix,
    epochsInfo,
    improve,
    analysis,
    ch,
  );
  mountSeed(seed, store);
  mountThreshold(thr, store);
  mountWords(words, store);
  mountMix(mix, store);
  epochsInfo.append(
    h('h3', { text: 'Fler jämförelser och markerad bästa epok' }),
    h('p', {}, 'I resultaten är epoken med högst validation accuracy markerad i diagrammet. I steget ', h('a', { href: '#installningar', text: 'Välj inställningar' }), ' finns dessutom utökade laborationer där du jämför learning rate (0,01, 0,1 och 0,5) eller antal dolda noder (2, 8 och 32). Välj dem under "Utökade laborationer".'),
  );
  mountImproveSeeds(improve, store);
  mountAnalysis(analysis, store);
  mountChallenges(ch, store);
}
