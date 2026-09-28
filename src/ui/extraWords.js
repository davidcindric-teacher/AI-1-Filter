import { topInfluentialWords } from '../analysis.js';
import { formatNumber } from '../metrics.js';
import { h, replace, table } from './dom.js';
import { runDisplayName } from './tester.js';

const signed = (v) => `${v > 0 ? '+' : ''}${formatNumber(v, 2)}`;

/** Lektion 2: vilka ord drar mest mot spam respektive vanligt i den tränade modellen? */
export function mountWords(root, store) {
  const select = h('select', { id: 'words-model' });
  const out = h('div');
  const noRuns = h('p', { class: 'muted', text: 'Träna en modell först (avsnittet Förbered och träna).' });
  const controls = h('div', { class: 'field' }, h('label', { for: 'words-model', text: 'Modell' }), select);

  const render = () => {
    const run = store.get().runs.find((r) => r.id === select.value);
    if (!run) {
      replace(out);
      return;
    }
    const top = topInfluentialWords(run, 10);
    const rows = (list) => list.map((w) => [w.word, signed(w.effect), `${w.spamCount} / ${w.hamCount}`]);
    replace(
      out,
      h('div', { class: 'run-grid runs-2' }, [
        h('div', {}, table({ caption: 'Ord som drar mot spam', headers: ['Ord', 'Effekt', 'Spam / vanliga i träningsdata'], rows: rows(top.spam) })),
        h('div', {}, table({ caption: 'Ord som drar mot vanligt meddelande', headers: ['Ord', 'Effekt', 'Spam / vanliga i träningsdata'], rows: rows(top.ham) })),
      ]),
      h('p', { class: 'muted', text: `Vokabulären har ${top.total} ord. Effekten är en förenkling: vi ger modellen en text med bara ordet och jämför med en tom text (i log-odds). Positivt tal drar mot spam, negativt mot vanligt. I verkligheten samverkar orden i det dolda lagret.` }),
      h('p', {}, 'Fundera på: Är det ord du väntade dig? Finns det ord som bara råkar förekomma i en klass i träningsdatan men som inte har med spam att göra? Jämför modell A och B, särskilt hur repetitiva formuleringar syns i listan.'),
    );
  };

  root.append(
    h('h4', { text: 'Ordvikter: vilka ord styr modellen?' }),
    h('p', {}, 'Här ser du vilka ord som mest får modellen att svara spam eller vanligt. Det visar att modellen räknar med ord och inte förstår innehållet.'),
    noRuns,
    controls,
    out,
  );
  select.addEventListener('change', render);
  let last = null;
  store.subscribe((state) => {
    if (state.runs === last) return;
    last = state.runs;
    const prev = select.value;
    replace(select, state.runs.map((r) => h('option', { value: r.id, text: runDisplayName(r) })));
    if (state.runs.some((r) => r.id === prev)) select.value = prev;
    noRuns.hidden = state.runs.length > 0;
    controls.hidden = state.runs.length === 0;
    render();
  });
  controls.hidden = true;
}
