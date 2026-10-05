import { CORE_MODES, DEFAULTS, EPOCH_COMPARISON, EXTENDED_MODES, HIDDEN_COMPARISON, LIMITS, LR_COMPARISON, MODES, THRESHOLD } from '../config.js';
import { buildVocabulary } from '../ml/vectorizer.js';
import { datasetPhrase, datasetRows, shownDataset } from '../experiments.js';
import { LESSON_MODES } from '../lessons.js';
import { EXPLAIN } from '../text/explanations.js';
import { explained, h, replace } from './dom.js';

const fmt = (v) => String(v).replace('.', ',');

/** Värdena som en låst laboration faktiskt tränar med, t.ex. "5/30/100". */
const COMPARISONS = { epochs: EPOCH_COMPARISON, learningRate: LR_COMPARISON, hiddenUnits: HIDDEN_COMPARISON };
const shown = (key) => COMPARISONS[key].map(fmt).join('/');

const parseNumber = (raw) => {
  const v = String(raw).trim().replace(',', '.');
  return v === '' ? NaN : Number(v);
};

const LESSON_HELP = {
  single: 'Träna en modell på ett dataset. Testa sedan fyra egna påhittade meddelanden i steget Testa egen text.',
  'compare-datasets': 'Tränar dataset A och dataset B som två separata modeller med samma slumpfrö, valideringsdata, arkitektur och antal epoker. Resultaten visas sida vid sida.',
  'compare-epochs': `Tränar dataset B tre gånger: ${EPOCH_COMPARISON.join(', ')} epoker. Varje körning börjar om från samma startläge och fortsätter inte från en tidigare körning.`,
  improve: 'Tränar dataset B före och efter din förbättring (steget Byt ut texter), med samma inställningar. Sedan kan du köra sluttestet, ett engångstest.',
  'compare-abc': 'Tränar dataset A, B och ditt eget mix C (välj texter i steget Fördjupning). Alla med samma slumpfrö, epoker och valideringsdata. Vad händer när du själv väljer träningstexterna?',
  'compare-lr': `Tränar dataset B tre gånger med learning rate ${LR_COMPARISON.map((v) => String(v).replace('.', ',')).join(', ')}. Allt annat är lika, inklusive slumpfrö och startvikter. Titta på hur kurvorna skiljer sig.`,
  'compare-hidden': `Tränar dataset B tre gånger med ${HIDDEN_COMPARISON.join(', ')} dolda noder. Samma slumpfrö används, men startvikterna skiljer sig eftersom nätverken har olika storlek.`,
};

export function mountSettings(root, store) {
  const s0 = store.get();

  // Laborationstyp
  const modeRows = new Map();
  const modeRadio = (key) => {
    const input = h('input', { type: 'radio', name: 'mode', id: `mode-${key}`, value: key, checked: s0.mode === key, onchange: () => store.set({ mode: key }) });
    const row = h('div', { class: 'radio-row' }, h('label', { for: `mode-${key}` }, input, h('span', { text: MODES[key] })));
    modeRows.set(key, row);
    return row;
  };
  const modeHelp = h('p', { class: 'muted', id: 'mode-help' });
  const extendedBox = h('details', { class: 'only-standard extended-modes', open: EXTENDED_MODES.includes(s0.mode) }, h('summary', { text: 'Utökade laborationer (för dig som är klar tidigt)' }), EXTENDED_MODES.map(modeRadio));
  const modeSet = h('fieldset', { class: 'plain-fieldset' }, h('legend', { text: 'Välj laboration' }), CORE_MODES.map(modeRadio), extendedBox);

  const numberField = (id, key, labelNode, opts = {}) => {
    const input = h('input', {
      id,
      type: 'text',
      inputmode: opts.decimal ? 'decimal' : 'numeric',
      autocomplete: 'off',
      value: String(s0.settings[key]).replace('.', ','),
      'aria-describedby': `${id}-hint`,
      oninput: (e) => store.set({ settings: { ...store.get().settings, [key]: parseNumber(e.target.value) } }),
    });
    const [lo, hi] = LIMITS[key];
    return {
      input,
      el: h('div', { class: 'field' }, h('label', { for: id }, labelNode), input, h('span', { class: 'hint', id: `${id}-hint`, text: `Tillåtet: ${String(lo).replace('.', ',')}–${String(hi).replace('.', ',')}. Förval: ${String(DEFAULTS[key]).replace('.', ',')}.` })),
    };
  };

  const epochs = numberField('set-epochs', 'epochs', explained('Antal epoker', EXPLAIN.epoch));
  const seed = numberField('set-seed', 'seed', explained('Slumpfrö', EXPLAIN.seed));
  const lr = numberField('set-lr', 'learningRate', explained('Learning rate', EXPLAIN.learningRate), { decimal: true });
  const batch = numberField('set-batch', 'batchSize', explained('Batchstorlek', EXPLAIN.batchSize));
  const hidden = numberField('set-hidden', 'hiddenUnits', 'Antal noder i dolda lagret');
  const epochNote = h('p', { class: 'muted', id: 'epoch-note', hidden: true });

  const advanced = h(
    'details',
    { class: 'advanced only-standard' },
    h('summary', { text: 'Avancerade inställningar (behöver oftast inte ändras)' }),
    h('p', { class: 'muted', text: 'Ändra bara en sak i taget och behåll samma värden i alla körningar du vill jämföra.' }),
    h('div', { class: 'field-grid' }, lr.el, batch.el, hidden.el),
  );

  const reset = h('button', {
    type: 'button',
    class: 'btn btn-secondary',
    text: 'Återställ standardinställningar',
    onclick: () => store.set({ settings: { ...DEFAULTS }, mode: 'single', datasetKey: 'a' }),
  });

  // Vanlig (icke-live) text: den bara upprepar värden som redan finns i fälten ovan, så den ska inte avbryta
  // en skärmläsare med ett utrop vid varje knapptryckning medan eleven skriver i ett av fälten.
  const summary = h('p', { class: 'muted only-standard' });
  const info = h('div', { class: 'model-info' });

  root.append(
    modeSet,
    modeHelp,
    h('div', { class: 'field-grid' }, epochs.el, seed.el),
    epochNote,
    advanced,
    reset,
    summary,
    h('details', { class: 'only-standard' }, h('summary', { text: 'Läs mer om hela modellen (dolt lager, sannolikhet, vikter)' }), info),
    h('p', { class: 'only-simple muted', text: 'Modellen räknar vilka ord som finns i texten och ger en sannolikhet för spam. Tröskeln är 50 %.' }),
  );

  const fields = { epochs, seed, learningRate: lr, batchSize: batch, hiddenUnits: hidden };
  let lastInfo = '';

  const render = (state) => {
    modeHelp.textContent = LESSON_HELP[state.mode];
    // Visa bara de laborationer som hör till vald lektion. Finns det bara en behövs ingen val-ruta, bara beskrivningen.
    const visible = state.lesson === 'all' || !LESSON_MODES[state.lesson] ? [...CORE_MODES, ...EXTENDED_MODES] : LESSON_MODES[state.lesson];
    for (const [key, row] of modeRows) row.hidden = !visible.includes(key);
    extendedBox.hidden = !EXTENDED_MODES.some((k) => visible.includes(k));
    modeSet.hidden = visible.length <= 1;
    for (const input of root.querySelectorAll('input[name="mode"]')) input.checked = input.value === state.mode;
    // Vissa laborationer jämför just en inställning. Då är den inställningen låst, och fältet visar de värden
    // som faktiskt tränas (t.ex. 5/30/100) i stället för elevens vanliga värde, som inte används.
    const locks = { epochs: state.mode === 'compare-epochs', learningRate: state.mode === 'compare-lr', hiddenUnits: state.mode === 'compare-hidden' };
    for (const [key, f] of Object.entries(fields)) {
      f.input.disabled = Boolean(locks[key]);
      if (locks[key]) f.input.value = shown(key);
      else if (document.activeElement !== f.input) f.input.value = Number.isNaN(state.settings[key]) ? '' : fmt(state.settings[key]);
    }
    const lockText = { epochs: `I Lektion 3 är antal epoker fast: ${EPOCH_COMPARISON.join(', ')}.`, learningRate: `I den här laborationen är learning rate fast: ${LR_COMPARISON.map(fmt).join(', ')} (avancerade inställningar).`, hiddenUnits: `I den här laborationen är antal dolda noder fast: ${HIDDEN_COMPARISON.join(', ')} (avancerade inställningar).` };
    const lockedKey = Object.keys(locks).find((k) => locks[k]);
    epochNote.hidden = !lockedKey;
    epochNote.textContent = lockedKey ? lockText[lockedKey] : '';
    if (EXTENDED_MODES.includes(state.mode)) extendedBox.open = true;

    const s = state.settings;
    const v = (key) => (locks[key] ? shown(key) : fmt(s[key]));
    summary.textContent = `Nuvarande inställningar: slumpfrö ${s.seed}, ${v('epochs')} epoker, learning rate ${v('learningRate')}, batchstorlek ${s.batchSize}, ${v('hiddenUnits')} dolda noder.`;

    // Modellinformation
    // I låsta laborationer beskrivs laborationens dataset (t.ex. B i lektion 3), inte ett dolt tidigare val.
    const dsKey = shownDataset(state);
    const vocab = buildVocabulary(datasetRows(dsKey, state).map((r) => r.text)).words.length;
    const hiddenList = locks.hiddenUnits ? HIDDEN_COMPARISON : [s.hiddenUnits];
    const sig = `${vocab}|${hiddenList.join(',')}|${dsKey}`;
    if (sig === lastInfo) return;
    lastInfo = sig;
    const dsName = datasetPhrase(dsKey);
    const hiddenText = hiddenList.length > 1 ? `${hiddenList.join(', ')} noder (en modell per värde)` : `${s.hiddenUnits} noder`;
    const weights = hiddenList.map((n) => vocab * n + n * 2 + 1);
    const weightText = weights.length > 1 ? `Varje modell har vikter (${weights.join(', ')} tal)` : `Modellen har vikter (${weights[0]} tal)`;
    replace(
      info,
      h(
        'ol',
        { class: 'steps' },
        h('li', {}, h('strong', { text: 'Text blir siffror. ' }), 'Texten görs om till gemener och delas upp i ord (skiljetecken tas bort). Sedan skapas en lista med ett tal per ord i vokabulären: 1 om ordet finns i texten, annars 0. Ordföljden spelar ingen roll och ord som modellen inte sett vid träningen ignoreras. Prova själv i "Så blir din text till siffror" i steget Välj dataset.'),
        h('li', {}, h('strong', { text: 'Indatalager. ' }), `Lika många indata som ord i vokabulären. Med ${dsName} är vokabulären ${vocab} ord (bara ord från träningsdata).`),
        h('li', {}, h('strong', { text: 'Dolt lager. ' }), `${hiddenText} som var och en räknar ihop de ord den reagerar på och sedan tillämpar ReLU (negativa tal blir 0).`),
        h('li', {}, h('strong', { text: 'Utdatalager. ' }), 'En nod med sigmoid som ger en sannolikhet för spam mellan 0 och 1.'),
        h('li', {}, h('strong', { text: 'Klassificering. ' }), `Om sannolikheten är minst ${String(THRESHOLD).replace('.', ',')} (tröskeln) svarar modellen spam, annars vanligt meddelande. Tröskeln ändras inte i laborationen.`),
        h('li', {}, h('strong', { text: 'Vikter och träning. ' }), `${weightText} som ändras under träningen. Efter varje liten grupp texter (batch) justeras vikterna med SGD så att felen blir mindre. Startvikterna bestäms av slumpfröet.`),
      ),
    );
  };
  store.subscribe(render);
  render(s0);
}
