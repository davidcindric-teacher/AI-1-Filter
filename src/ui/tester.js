import { LABEL_NAMES } from '../config.js';
import { testText } from '../ml/trainer.js';
import { formatMetric } from '../metrics.js';
import { h, replace, table } from './dom.js';

export const runDisplayName = (run) => `${run.label} · ${run.settings.epochs} epoker · frö ${run.settings.seed}`;

/**
 * Testar en text på en modell och loggar den i testLog (delas av huvudtestet och snabbtestet i resultatkorten).
 * Kastar UserError vid tom text (samma fel som testText). Ändrar aldrig modellen eller träningsdata.
 */
export function testAndLog(store, run, text) {
  const answer = testText(run, text);
  store.set({ testLog: [...store.get().testLog, { runLabel: runDisplayName(run), text: answer.text, probability: answer.probability, predicted: answer.predicted }] });
  return answer;
}

export function mountTester(root, store) {
  const select = h('select', { id: 'tester-model' });
  const textarea = h('textarea', { id: 'tester-text', rows: '3', maxlength: '300', placeholder: 'Skriv ett påhittat meddelande, till exempel: Hej! Ska vi ses efter skolan?' });
  const output = h('div', { class: 'tester-output', role: 'status', 'aria-live': 'polite' });
  const logBox = h('div');
  const counter = h('p', { class: 'test-counter', 'aria-live': 'polite' });
  const noRuns = h('p', { class: 'muted', hidden: true, text: 'Träna en modell först (avsnittet Förbered och träna). Sedan kan du testa egna texter här.' });

  const run = () => {
    const state = store.get();
    const model = state.runs.find((r) => r.id === select.value);
    if (!model) {
      replace(output, h('p', { class: 'banner banner-error', text: 'Träna en modell först. Det finns ingen modell att testa på.' }));
      return;
    }
    try {
      const answer = testAndLog(store, model, textarea.value);
      const spam = answer.predicted === 'spam';
      replace(
        output,
        h('p', { class: `verdict ${spam ? 'verdict-spam' : 'verdict-ham'}` }, 'Modellens svar: ', h('strong', { text: LABEL_NAMES[answer.predicted] })),
        h('p', {}, 'Sannolikhet för spam: ', h('strong', { text: formatMetric(answer.probability) })),
        h('p', { class: 'muted', text: 'Sannolikheten är modellens uppskattning och inte en garanti. Modellen kan ha fel, särskilt på texter som skiljer sig från träningsdata.' }),
        h(
          'p',
          { class: 'only-standard' },
          'Så här såg modellen din text (grönmarkerade ord finns i vokabulären, övriga ignoreras): ',
          answer.tokens.length ? answer.tokens.map((t, i) => [h('span', { class: `token ${t.known ? 'known' : 'unknown'}`, text: t.word }), i < answer.tokens.length - 1 ? ' ' : '']) : 'inga ord',
          h('span', { class: 'muted', text: ` (${answer.knownCount} av ${new Set(answer.tokens.map((t) => t.word)).size} olika ord kändes igen)` }),
        ),
        h('p', { class: 'muted', text: 'Din text har inte lagts till i träningsdata och har inte ändrat modellen.' }),
      );
      // Ingen egen announce() här: output har redan role="status" aria-live="polite", så innehållet
      // läses upp automatiskt när det byts ut. Ett extra announce()-anrop skulle läsa upp det två gånger.
    } catch (err) {
      replace(output, h('p', { class: 'banner banner-error', text: err.message }));
      textarea.focus();
    }
  };

  const clear = () => {
    textarea.value = '';
    replace(output);
    textarea.focus();
  };

  root.append(
    h('p', {}, 'Skriv en egen påhittad text och se hur modellen svarar. Att testa en text ändrar ', h('strong', { text: 'inte' }), ' modellen eller träningsdata.'),
    h('div', { class: 'field' }, h('label', { for: 'tester-model', text: 'Modell att testa' }), select),
    counter,
    noRuns,
    h('div', { class: 'field' }, h('label', { for: 'tester-text', text: 'Egen text' }), textarea),
    h('div', { class: 'button-row' }, h('button', { type: 'button', class: 'btn btn-primary', text: 'Testa texten', onclick: run }), h('button', { type: 'button', class: 'btn btn-secondary', text: 'Rensa texten', onclick: clear })),
    output,
    logBox,
  );

  let lastRuns = null;
  let lastLog = null;
  const render = (state) => {
    const n = new Set(state.testLog.map((t) => t.text.trim().toLowerCase())).size;
    const goal = state.lesson === 1 || state.lesson === 'all' ? 4 : state.lesson === 2 ? 2 : 0;
    counter.hidden = goal === 0;
    counter.textContent = goal ? `Testa minst ${goal} egna påhittade meddelanden. Du har testat ${n} av ${goal}.${n >= goal ? ' Klart!' : ''}` : '';
    if (state.runs !== lastRuns) {
      lastRuns = state.runs;
      const prev = select.value;
      replace(select, state.runs.map((r) => h('option', { value: r.id, text: runDisplayName(r) })));
      if (state.runs.some((r) => r.id === prev)) select.value = prev;
      select.disabled = state.runs.length === 0;
      noRuns.hidden = state.runs.length > 0;
      if (state.runs.length === 0) replace(output);
    }
    if (state.testLog !== lastLog) {
      lastLog = state.testLog;
      replace(
        logBox,
        state.testLog.length
          ? [
              h('h3', { text: 'Dina testade texter' }),
              table({
                headers: ['Text', 'Modell', 'Modellens svar', 'Spam-sannolikhet'],
                rows: state.testLog.map((t) => [t.text, t.runLabel, LABEL_NAMES[t.predicted], formatMetric(t.probability)]),
              }),
              h('p', { class: 'muted only-standard', text: 'Listan tas med i resultatblocket. Den försvinner om du laddar om sidan.' }),
              h('button', { type: 'button', class: 'btn btn-secondary', text: 'Rensa listan', onclick: () => store.set({ testLog: [] }) }),
            ]
          : null,
      );
    }
  };
  store.subscribe(render);
  render(store.get());
}
