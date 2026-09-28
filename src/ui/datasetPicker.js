import { DATASETS, FINAL_TEST_TEXTS, VALIDATION_TEXTS } from '../data/index.js';
import { countPerClass } from '../dataChecks.js';
import { validateCustomDataset } from '../customData.js';
import { MIX_NAME, mixRows, validateMix } from '../mixData.js';
import { allowedDatasets } from '../lessons.js';
import { LABEL_NAMES } from '../config.js';
import { buildVocabulary } from '../ml/vectorizer.js';
import { h, replace, table } from './dom.js';
import { mountModelDemo } from './modelDemo.js';

const examples = (rows) => {
  const spam = rows.filter((r) => r.label === 'spam').slice(0, 2);
  const ham = rows.filter((r) => r.label === 'vanlig').slice(0, 2);
  return h(
    'ul',
    { class: 'examples' },
    [...spam, ...ham].map((r) => h('li', {}, h('span', { class: 'tag' }, LABEL_NAMES[r.label]), ` ${r.text}`)),
  );
};

/** Hopfälld ruta med några exempel (alltid) och, i Standard, alla texter och vokabulärens storlek. */
const cardDetails = (rows, vocabSize) =>
  h(
    'details',
    { class: 'card-details' },
    h('summary', { text: 'Visa exempel' }),
    examples(rows),
    h(
      'div',
      { class: 'only-standard' },
      h('p', { class: 'muted', text: `Vokabulär: ${vocabSize} olika ord.` }),
      table({ headers: ['Klass', 'Text'], rows: rows.map((r) => [LABEL_NAMES[r.label], r.text]) }),
    ),
  );

export function mountDatasetPicker(root, store) {
  const cards = h('div', { class: 'choice-grid' });
  const note = h('p', { class: 'muted', id: 'dataset-mode-note' });
  const fieldset = h('fieldset', { class: 'choice-fieldset' }, h('legend', { text: 'Dataset för träning' }), cards);

  const separation = table({
    caption: 'Vilken data används till vad?',
    headers: ['Data', 'Antal texter', 'Används till', 'Får modellen träna på den?'],
    rows: [
      ['Träningsdata (valt dataset)', '40 (20 spam, 20 vanliga)', 'Modellen lär sig av dessa texter.', 'Ja'],
      ['Valideringsdata', `${VALIDATION_TEXTS.length} (10 spam, 10 vanliga)`, 'Följa och jämföra träningen på texter modellen inte tränat på. Fast och kan inte ändras.', 'Nej, aldrig'],
      ['Sluttest', `${FINAL_TEST_TEXTS.length} (10 spam, 10 vanliga)`, 'Ett engångstest efter förbättringen (lektion 4). Visas först när det körs.', 'Nej, aldrig'],
    ],
    className: 'plain',
    rowHeaders: true,
  });

  const demoRoot = h('div', { class: 'model-demo' });

  root.append(
    h('p', {}, 'Ett dataset är en samling texter med facit (spam eller vanligt). Alla texter är påhittade.'),
    fieldset,
    note,
    h('details', { class: 'only-standard' }, h('summary', { text: 'Vilken data används till vad?' }), separation, h('p', { class: 'muted', text: 'Modellen tränar bara på träningsdata.' })),
    h('p', { class: 'only-simple muted', text: 'Modellen tränar bara på träningsdata. Valideringsdata och sluttestet används bara för att testa modellen.' }),
    demoRoot,
  );
  mountModelDemo(demoRoot, store);

  let lastKey = null;
  const syncSelection = (key) => {
    for (const input of cards.querySelectorAll('input[name="dataset"]')) {
      input.checked = input.value === key;
      input.closest('.choice').classList.toggle('is-selected', input.value === key);
    }
  };
  const render = (state) => {
    // Kortens innehåll byggs om bara när läge eller ändringar ändras. Ett byte av dataset uppdaterar bara markeringen,
    // så att tangentbordsfokus på radioknappen inte försvinner.
    const sig = `${state.lesson}|${state.mode}|${JSON.stringify(state.edits)}|${state.mixIds.join(',')}`;
    if (sig === lastKey) {
      syncSelection(state.datasetKey);
      return;
    }
    lastKey = sig;
    const custom = validateCustomDataset(state.edits);
    const mixCheck = validateMix(state.mixIds);
    const mk = (key, name, description, rows, extra) => {
      const c = countPerClass(rows);
      const input = h('input', {
        type: 'radio',
        name: 'dataset',
        id: `ds-${key}`,
        value: key,
        checked: state.datasetKey === key,
        onchange: () => store.set({ datasetKey: key }),
      });
      return h(
        'div',
        { class: `choice${state.datasetKey === key ? ' is-selected' : ''}` },
        h('label', { for: `ds-${key}`, class: 'choice-label' }, input, h('span', { class: 'choice-title', text: name })),
        h('p', { class: 'muted', text: `${c.spam} spam · ${c.vanlig} vanliga · ${description}` }),
        extra,
      );
    };
    const vocabSize = (rows) => buildVocabulary(rows.map((r) => r.text)).words.length;
    const allowed = allowedDatasets(state.lesson);
    const all = {
      a: () => mk('a', DATASETS.a.name, DATASETS.a.description, DATASETS.a.texts, cardDetails(DATASETS.a.texts, vocabSize(DATASETS.a.texts))),
      b: () => mk('b', DATASETS.b.name, DATASETS.b.description, DATASETS.b.texts, cardDetails(DATASETS.b.texts, vocabSize(DATASETS.b.texts))),
      custom: () =>
        mk('custom', 'Egen förbättrad version av B', 'dataset B där du bytt ut fem texter per klass', custom.rows, h('p', { class: custom.ok ? 'ok' : 'warn' }, custom.ok ? 'Giltig och redo att tränas. ' : 'Inte klar än: ', custom.ok ? '' : h('a', { href: '#byt-texter', text: 'Gå till steget Byt ut texter' }))),
      mix: () =>
        mk('mix', MIX_NAME, 'du väljer själv 20 + 20 texter ur A och B', mixRows(state.mixIds), h('p', { class: mixCheck.ok ? 'ok' : 'warn' }, mixCheck.ok ? 'Giltigt och redo att tränas.' : 'Inte klart än: ', mixCheck.ok ? '' : h('a', { href: '#extra', text: 'Välj texter i steget Fördjupning' }))),
    };
    replace(cards, allowed.map((key) => all[key]()));
    const locked = state.mode !== 'single';
    fieldset.disabled = locked;
    note.textContent = locked
      ? {
          'compare-datasets': 'I Lektion 2 tränas dataset A och dataset B, båda med samma inställningar.',
          'compare-epochs': 'I Lektion 3 används dataset B.',
          improve: 'I Lektion 4 används dataset B före och din förbättrade version efter. Skapa den i steget Byt ut texter.',
          'compare-abc': 'I den här laborationen tränas dataset A, dataset B och ditt eget mix C.',
          'compare-lr': 'I den här laborationen används dataset B.',
          'compare-hidden': 'I den här laborationen används dataset B.',
        }[state.mode]
      : 'Välj vilket dataset modellen ska tränas på. Lektion 2 låter dig jämföra två dataset.';
  };
  store.subscribe(render);
  render(store.get());
}
