import { CLASS_SIZE } from '../config.js';
import { MIX_POOL, mixCounts, normalizeMixIds, validateMix } from '../mixData.js';
import { h, replace } from './dom.js';
import { startTraining } from './train.js';

/** Lektion 2 (utökad): välj själv exakt 20 spam och 20 vanliga texter ur A och B, som dataset C. */
export function mountMix(root, store) {
  const boxes = new Map();
  const status = h('div', { class: 'mix-status', role: 'status', 'aria-live': 'polite' });

  const setIds = (ids) => store.set({ mixIds: normalizeMixIds(ids) });
  const toggle = (id, on) => {
    const cur = new Set(store.get().mixIds);
    if (on) cur.add(id);
    else cur.delete(id);
    setIds([...cur]);
  };
  const suggestion = () => {
    const pick = (label, source) => MIX_POOL.filter((r) => r.label === label && r.source === source).slice(0, CLASS_SIZE / 2).map((r) => r.id);
    setIds([...pick('spam', 'dataset-a'), ...pick('spam', 'dataset-b'), ...pick('vanlig', 'dataset-a'), ...pick('vanlig', 'dataset-b')]);
  };

  const group = (label, name) =>
    h(
      'fieldset',
      { class: 'edit-group' },
      h('legend', { text: `${name} (välj exakt ${CLASS_SIZE})` }),
      MIX_POOL.filter((r) => r.label === label).map((r) => {
        const input = h('input', { type: 'checkbox', id: `mix-${r.id}`, onchange: (e) => toggle(r.id, e.target.checked) });
        boxes.set(r.id, input);
        return h('div', { class: 'check-row' }, h('label', { for: `mix-${r.id}` }, input, h('span', {}, h('span', { class: 'tag', text: r.source === 'dataset-a' ? 'A' : 'B' }), ` ${r.text}`)));
      }),
    );

  root.append(
    h('h4', { text: 'Dataset C: välj egna träningstexter' }),
    h('p', {}, `Plocka själv ${CLASS_SIZE} spamtexter och ${CLASS_SIZE} vanliga texter ur dataset A och B (A och B har 40 texter var). Du får då ett eget dataset C. Vad händer när du själv bestämmer träningsdatan? Validerings- och sluttestdata finns aldrig bland valen.`),
    status,
    h(
      'div',
      { class: 'button-row' },
      h('button', { type: 'button', class: 'btn btn-secondary', text: 'Förslag: hälften från A, hälften från B', onclick: suggestion }),
      h('button', { type: 'button', class: 'btn btn-secondary', text: 'Rensa mina val', onclick: () => setIds([]) }),
      h('button', { type: 'button', class: 'btn btn-primary', text: 'Träna A, B och C', onclick: () => { store.set({ mode: 'compare-abc' }); startTraining(store); } }),
    ),
    h('details', {}, h('summary', { text: 'Visa alla 80 texter och välj' }), h('div', { class: 'edit-groups' }, group('spam', 'Spamtexter'), group('vanlig', 'Vanliga texter'))),
  );

  let last = null;
  store.subscribe((state) => {
    if (state.mixIds === last) return;
    last = state.mixIds;
    const set = new Set(state.mixIds);
    for (const [id, box] of boxes) box.checked = set.has(id);
    const c = mixCounts(state.mixIds);
    const check = validateMix(state.mixIds);
    replace(
      status,
      h('p', {}, h('strong', { text: 'Ditt val: ' }), `spam ${c.spam} av ${CLASS_SIZE} · vanliga ${c.vanlig} av ${CLASS_SIZE}`),
      check.ok ? h('p', { class: 'ok', text: 'Dataset C är giltigt och kan tränas.' }) : h('p', { class: 'warn', text: check.problems.join(' ') }),
    );
  });
  // första rendering
  const s = store.get();
  const set = new Set(s.mixIds);
  for (const [id, box] of boxes) box.checked = set.has(id);
  const c = mixCounts(s.mixIds);
  const check = validateMix(s.mixIds);
  replace(status, h('p', {}, h('strong', { text: 'Ditt val: ' }), `spam ${c.spam} av ${CLASS_SIZE} · vanliga ${c.vanlig} av ${CLASS_SIZE}`), check.ok ? h('p', { class: 'ok', text: 'Dataset C är giltigt och kan tränas.' }) : h('p', { class: 'warn', text: check.problems.join(' ') }));
  last = s.mixIds;
}
