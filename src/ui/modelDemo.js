import { DATASETS } from '../data/index.js';
import { validateCustomDataset } from '../customData.js';
import { mixRows } from '../mixData.js';
import { tokenize } from '../ml/tokenizer.js';
import { buildVocabulary } from '../ml/vectorizer.js';
import { h, replace } from './dom.js';

/**
 * Interaktiv demo: eleven skriver en egen text och ser direkt hur den blir till siffror (steg 1 i modellen).
 * Gröna ord finns i det valda datasetets vokabulär och blir en etta i indatavektorn; grå ord ignoreras helt.
 * Ändrar aldrig modellen eller träningsdata, och kräver ingen träning för att fungera.
 */
export function mountModelDemo(root, store) {
  const currentVocab = () => {
    const state = store.get();
    const rows = state.datasetKey === 'custom' ? validateCustomDataset(state.edits).rows : state.datasetKey === 'mix' ? mixRows(state.mixIds) : DATASETS[state.datasetKey].texts;
    return buildVocabulary(rows.map((r) => r.text));
  };

  const input = h('textarea', { id: 'demo-text', rows: '2', maxlength: '300', placeholder: 'Skriv en text, t.ex. "Vinn gratis pengar nu!"', oninput: update });
  // Ingen aria-live här: innehållet är en ren visuell demonstration som uppdateras vid varje tangenttryckning
  // i fältet ovanför. En live-region kopplad direkt till ett fält som just redigeras skulle läsas upp tecken
  // för tecken av en skärmläsare, vilket stör mer än det hjälper.
  const out = h('div', { class: 'demo-out' });

  function update() {
    const vocab = currentVocab();
    const text = input.value;
    if (!text.trim()) {
      replace(out, h('p', { class: 'muted', text: 'Skriv en text ovan för att se hur den blir till siffror.' }));
      return;
    }
    const tokens = tokenize(text);
    const uniqueTokens = new Set(tokens);
    const knownUnique = [...uniqueTokens].filter((w) => vocab.index.has(w));
    replace(
      out,
      h('p', { class: 'demo-tokens' }, tokens.map((w, i) => [h('span', { class: `token ${vocab.index.has(w) ? 'known' : 'unknown'}`, text: w }), i < tokens.length - 1 ? ' ' : ''])),
      h(
        'p',
        { class: 'muted small' },
        `${knownUnique.length} av ${uniqueTokens.size} olika ord finns i vokabulären (${vocab.words.length} ord totalt från det valda datasetet) och blir en etta i indatavektorn. Övriga ord ignoreras helt, oavsett hur viktiga de verkar.`,
      ),
    );
  }

  root.append(
    h('h4', { text: 'Så blir din text till siffror' }),
    h('p', {}, 'Modellen kan bara läsa siffror, inte text. Skriv en egen text nedan och se hur den tolkas med det dataset du just valde. ', h('span', { class: 'token known', text: 'gröna' }), ' ord finns i vokabulären och räknas, ', h('span', { class: 'token unknown', text: 'grå' }), ' ord ignoreras helt.'),
    h('div', { class: 'field' }, h('label', { for: 'demo-text', text: 'Egen text (bara en demonstration, ändrar inget)' }), input),
    out,
  );

  store.subscribe(() => {
    if (input.value.trim()) update();
  });
  update();
}
