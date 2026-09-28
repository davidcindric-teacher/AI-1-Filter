import { FINAL_TEST_TEXTS } from '../data/index.js';
import { evaluateOnTexts } from '../ml/trainer.js';
import { formatMetric } from '../metrics.js';
import { confusionTable, misclassifiedTable } from './results.js';
import { announce, h, replace, table } from './dom.js';

export function mountFinalTest(root, store) {
  const body = h('div');
  root.append(body);

  const runFinal = () => {
    const state = store.get();
    const entries = state.runs.map((run) => ({ runLabel: run.label, evaluation: evaluateOnTexts(run, FINAL_TEST_TEXTS) }));
    store.set({ finalTest: { count: state.finalTestRuns + 1, entries }, finalTestRuns: state.finalTestRuns + 1 });
    announce('Sluttestet är kört.');
  };

  let last = null;
  const render = (state) => {
    const sig = [state.runs, state.runsMode, state.finalTest, state.finalTestRuns];
    if (last && sig.every((v, i) => v === last[i])) return;
    last = sig;
    const ready = state.runsMode === 'improve' && state.runs.length === 2;
    const warning = h(
      'div',
      { class: 'callout callout-strong' },
      h('p', {}, h('strong', { text: 'Sluttestet är låst och får inte användas för att justera modellen. ' }), 'Kör det när du är färdig med din förbättring. Ändrar du modellen eller träningsdatan efter att du sett resultatet är sluttestet inte längre ett oberoende test.'),
    );
    const intro = h('p', { class: 'only-standard' }, `Sluttestet består av ${FINAL_TEST_TEXTS.length} texter (10 spam, 10 vanliga) som är skilda från både träningsdata och valideringsdata. Texterna kan inte redigeras och visas inte som träningsmaterial. Om modellen svarar fel visas just de texterna i resultatet.`);
    if (!ready) {
      replace(body, h('h3', { text: 'Sluttest' }), intro, warning, h('p', { class: 'muted', text: 'Träna först "före och efter" med knappen ovan (Lektion 4). Sedan kan du köra sluttestet här.' }), state.finalTestRuns ? h('p', { class: 'muted', text: `Sluttestet har körts ${state.finalTestRuns} gång(er) under den här sessionen.` }) : null);
      return;
    }
    const [before, after] = state.runs;
    const ft = state.finalTest;
    const parts = [
      h('h3', { text: 'Sluttest' }),
      intro,
      warning,
      h('div', { class: 'button-row' }, h('button', { type: 'button', class: 'btn btn-primary', text: ft ? 'Kör sluttestet igen' : 'Kör sluttestet', onclick: runFinal })),
    ];
    if (state.finalTestRuns > 1) {
      parts.push(h('p', { class: 'banner banner-warn', text: `Sluttestet har körts ${state.finalTestRuns} gånger. Om du har ändrat något efter att du såg ett tidigare resultat är sluttestet inte längre oberoende. Redovisa det i så fall.` }));
    }
    if (ft) {
      const [fb, fa] = ft.entries.map((e) => e.evaluation);
      const cell = (a, b, key) => [formatMetric(a[key]), formatMetric(b[key])];
      const row = (label, va, vb, fk) => [label, ...cell(before.validation.metrics, after.validation.metrics, va), ...cell(fb.metrics, fa.metrics, fk)];
      parts.push(
        table({
          caption: 'Före och efter: valideringsdata och sluttest',
          headers: ['Mått', 'Före (validering)', 'Efter (validering)', 'Före (sluttest)', 'Efter (sluttest)'],
          rowHeaders: true,
          rows: [
            row('Accuracy', 'accuracy', 'accuracy', 'accuracy'),
            row('Precision (spam)', 'precision', 'precision', 'precision'),
            row('Recall (spam)', 'recall', 'recall', 'recall'),
            row('F1 (spam)', 'f1', 'f1', 'f1'),
            ['Falskt positiva', String(before.validation.metrics.fp), String(after.validation.metrics.fp), String(fb.metrics.fp), String(fa.metrics.fp)],
            ['Falskt negativa', String(before.validation.metrics.fn), String(after.validation.metrics.fn), String(fb.metrics.fn), String(fa.metrics.fn)],
          ],
        }),
        h('p', { class: 'muted', text: 'Med bara 20 texter i varje mängd kan små skillnader bero på slumpen. Bra resultat på valideringsdata garanterar inte samma resultat på sluttestet eller på nya texter.' }),
        h('div', { class: 'run-grid runs-2' }, [
          [`Före: ${before.label}`, fb],
          [`Efter: ${after.label}`, fa],
        ].map(([title, ev]) => h('article', { class: 'run' }, h('h4', { text: `Sluttest, ${title}` }), confusionTable(ev.metrics, 'Förväxlingsmatris (sluttest)'), misclassifiedTable(ev.rows)))),
      );
    }
    replace(body, ...parts);
  };
  store.subscribe(render);
  render(store.get());
}
