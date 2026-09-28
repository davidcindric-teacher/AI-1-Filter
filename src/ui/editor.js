import { CLASS_SIZE, LABEL_NAMES, MAX_TEXT_LENGTH, SWAP_COUNT } from '../config.js';
import { BASE_ROWS, effectiveEdits, validateCustomDataset } from '../customData.js';
import { announce, h, replace } from './dom.js';
import { startTraining } from './train.js';

/**
 * Varje text visas som en kompakt rad (bara texten och en knapp) i stället för 40 öppna textrutor samtidigt.
 * "Byt ut" öppnar en textruta för just den raden. En ändrad text visas åter som kompakt förhandsvisning
 * med en "Ändrad"-badge och en "Redigera"-knapp, så bara de rader eleven aktivt jobbar med tar plats.
 */
export function mountEditor(root, trainRoot, store) {
  const rowEls = new Map(); // id -> radens delar
  const expanded = new Set(); // id:n som just nu visar en öppen textruta
  const summary = h('div', { class: 'edit-summary', role: 'status', 'aria-live': 'polite' });
  const trainStatus = h('div');
  const problems = h('ul', { class: 'problems' });
  const changesList = h('div');

  const setEdit = (id, value) => {
    const base = BASE_ROWS.find((r) => r.id === id);
    const edits = { ...store.get().edits };
    if (value === base.text) delete edits[id];
    else edits[id] = value;
    store.set({ edits });
  };

  const group = (label, name) => {
    const rows = BASE_ROWS.filter((r) => r.label === label);
    return h(
      'fieldset',
      { class: 'edit-group' },
      h('legend', { text: `${name} (${rows.length} texter, byt ut exakt ${SWAP_COUNT})` }),
      rows.map((r, i) => {
        const inputId = `edit-${r.id}`;
        const rowLabel = `${name} ${i + 1}`;
        const textarea = h('textarea', { id: inputId, rows: '2', maxlength: String(MAX_TEXT_LENGTH), oninput: (e) => setEdit(r.id, e.target.value) });
        const badge = h('span', { class: 'badge', hidden: true, text: 'Ändrad' });
        const preview = h('p', { class: 'edit-row-text' });
        const swapBtn = h('button', { type: 'button', class: 'btn btn-small btn-secondary', text: 'Byt ut', 'aria-label': `Byt ut ${rowLabel.toLowerCase()}`, onclick: () => { expanded.add(r.id); textarea.value = store.get().edits[r.id] ?? r.text; render(store.get()); textarea.focus(); textarea.select(); } });
        const editBtn = h('button', { type: 'button', class: 'btn btn-small btn-secondary', text: 'Redigera', hidden: true, 'aria-label': `Redigera ${rowLabel.toLowerCase()} igen`, onclick: () => { expanded.add(r.id); textarea.value = store.get().edits[r.id] ?? r.text; render(store.get()); textarea.focus(); } });
        const doneBtn = h('button', { type: 'button', class: 'btn btn-small btn-secondary', text: 'Klart, dölj texten', hidden: true, onclick: () => { expanded.delete(r.id); render(store.get()); announce(`${rowLabel} är dold igen.`); } });
        const resetBtn = h('button', { type: 'button', class: 'btn btn-small btn-secondary', hidden: true, text: 'Återställ till dataset B', 'aria-label': `Återställ till dataset B: ${rowLabel.toLowerCase()}`, onclick: () => { expanded.delete(r.id); setEdit(r.id, r.text); } });
        const label = h('label', { for: inputId, class: 'edit-row-label' }, rowLabel, badge);
        const el = h('div', { class: 'edit-row' }, h('div', { class: 'edit-row-head' }, label, h('div', { class: 'button-row edit-row-actions' }, swapBtn, editBtn, doneBtn, resetBtn)), preview, textarea);
        rowEls.set(r.id, { el, textarea, preview, badge, swapBtn, editBtn, doneBtn, resetBtn, original: r.text });
        return el;
      }),
    );
  };

  const resetAll = h('button', {
    type: 'button',
    class: 'btn btn-secondary',
    text: 'Återställ till dataset B',
    onclick: () => {
      expanded.clear();
      store.set({ edits: {} });
    },
  });
  const trainBtn = h('button', {
    type: 'button',
    class: 'btn btn-primary',
    text: 'Träna före och efter',
    onclick: () => {
      store.set({ mode: 'improve' });
      startTraining(store);
    },
  });

  root.append(
    h('p', {}, 'Utgå från dataset B och byt ut exakt ', h('strong', { text: `${SWAP_COUNT} texter i varje klass` }), ' mot egna påhittade texter som du tror gör modellen bättre. Klasserna ligger fast: en spamtext byts mot en spamtext och en vanlig text mot en vanlig text. Datamängden ska fortfarande ha exakt ', String(CLASS_SIZE), ' spamtexter och ', String(CLASS_SIZE), ' vanliga texter.'),
    h('p', { class: 'callout' }, h('strong', { text: 'Tips: ' }), 'Vilka texter klassificerade modellen fel med dataset B i lektion 2 och 3? Titta i dina resultatblock på de felklassificerade texterna. Vilka ord saknades i träningsdatan? Byt ut texter som liknar varandra mot texter med sådana ord.'),
    h('p', { class: 'muted only-standard', text: 'Texter som är identiska med valideringsdata eller sluttestet, tomma texter och dubbletter nekas.' }),
    summary,
    problems,
    changesList,
    h('div', { class: 'edit-groups' }, group('spam', 'Spamtext'), group('vanlig', 'Vanlig text')),
    h('div', { class: 'button-row' }, resetAll),
  );
  trainRoot.append(
    h('p', {}, 'Nu tränas två modeller: en på dataset B (före) och en på din förbättrade version (efter). Resultaten visas sida vid sida i steget Resultat.'),
    trainStatus,
    h('div', { class: 'button-row' }, trainBtn),
    h('p', { class: 'muted only-standard', text: 'Båda modellerna tränas från samma startläge, med samma slumpfrö, antal epoker och valideringsdata som du valt i steget Välj inställningar.' }),
  );

  // Uppdaterar varje rads utseende (öppen/stängd, badge, förhandsvisning). Körs alltid, även när "expanded"
  // ändras lokalt (t.ex. "Byt ut" klickas) utan att store.edits har ändrats, till skillnad från resten av
  // render() nedan som bara behöver räknas om när edits faktiskt ändras.
  const syncRows = (state) => {
    const eff = effectiveEdits(state.edits);
    for (const [id, row] of rowEls) {
      const changed = id in eff;
      const isOpen = expanded.has(id);
      row.el.classList.toggle('is-changed', changed);
      row.el.classList.toggle('is-open', isOpen);
      row.badge.hidden = !changed;
      row.swapBtn.hidden = changed || isOpen;
      row.editBtn.hidden = !changed || isOpen;
      row.doneBtn.hidden = !isOpen;
      row.resetBtn.hidden = !changed && !isOpen;
      row.preview.hidden = isOpen;
      row.textarea.hidden = !isOpen;
      const currentText = state.edits[id] ?? row.original;
      row.preview.textContent = currentText;
      if (isOpen && document.activeElement !== row.textarea && row.textarea.value !== currentText) row.textarea.value = currentText;
    }
  };

  // summary har role="status" aria-live="polite" (kontrollraden är viktig feedback: giltig/inte giltig).
  // Den tunga omräkningen (validering, problemlista, ändringslista) skjuts upp en kort stund så att den inte
  // körs på varje enskild tangenttryckning medan eleven skriver en ersättningstext – annars skulle en
  // skärmläsare läsa upp kontrollraden på nytt för varje bokstav. Radernas eget utseende (syncRows) är
  // opåverkat och uppdateras alltid direkt.
  const HEAVY_DEBOUNCE_MS = 300;
  let heavyTimer = null;
  const updateHeavy = (state) => {
    const check = validateCustomDataset(state.edits);
    const spamRows = check.rows.filter((r) => r.label === 'spam').length;
    const hamRows = check.rows.filter((r) => r.label === 'vanlig').length;
    replace(
      summary,
      h('p', {}, h('strong', { text: 'Kontroll: ' }), `spam ${spamRows} av ${CLASS_SIZE} texter, ${check.changes.spam} av ${SWAP_COUNT} utbytta · vanliga ${hamRows} av ${CLASS_SIZE} texter, ${check.changes.vanlig} av ${SWAP_COUNT} utbytta`),
      check.ok ? h('p', { class: 'ok', text: 'Datamängden är giltig och kan tränas.' }) : h('p', { class: 'warn', text: 'Datamängden är inte klar än:' }),
    );
    replace(problems, check.ok ? null : check.problems.map((p) => h('li', { text: p })));
    replace(
      trainStatus,
      check.ok
        ? h('p', { class: 'ok', text: 'Din förbättrade datamängd är giltig och kan tränas.' })
        : h('p', { class: 'warn' }, 'Datamängden är inte klar än. ', h('a', { href: '#byt-texter', text: 'Gå tillbaka till steget Byt ut texter' })),
    );
    trainBtn.disabled = !check.ok;
    const eff = effectiveEdits(state.edits);
    const changed = BASE_ROWS.filter((r) => r.id in eff);
    replace(
      changesList,
      changed.length
        ? h('details', { open: true }, h('summary', { text: `Ändrade texter (${changed.length})` }), h('ul', {}, changed.map((r) => h('li', {}, h('span', { class: 'tag', text: LABEL_NAMES[r.label] }), ` "${r.text}" → "${(state.edits[r.id] ?? '').trim() || '(tom)'}"`))))
        : h('p', { class: 'muted', text: 'Inga texter är ändrade. Träningsdatan är samma som dataset B.' }),
    );
  };

  let lastEdits = null;
  let firstRender = true;
  const render = (state) => {
    syncRows(state);
    if (state.edits === lastEdits) return;
    lastEdits = state.edits;
    if (firstRender) {
      // Ingen fördröjning vid första visningen, annars ser eleven en tom kontrollrad i en bråkdels sekund.
      firstRender = false;
      updateHeavy(state);
      return;
    }
    clearTimeout(heavyTimer);
    heavyTimer = setTimeout(() => updateHeavy(state), HEAVY_DEBOUNCE_MS);
  };
  store.subscribe(render);
  render(store.get());
}
