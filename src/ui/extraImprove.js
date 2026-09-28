import { formatMetric } from '../metrics.js';
import { formatDiff, summarizeImprovement } from '../report.js';
import { SEED_COUNT } from '../experiments.js';
import { h, replace, table } from './dom.js';
import { startSeedImprove } from './train.js';

/** Lektion 4: håller förbättringen över flera slumpfrön? Plus en kostnadsfråga. */
export function mountImproveSeeds(root, store) {
  const btn = h('button', { type: 'button', class: 'btn btn-primary', text: `Kör före och efter med ${SEED_COUNT} frön`, onclick: () => startSeedImprove(store) });
  const out = h('div');
  root.append(
    h('h4', { text: 'Håller förbättringen? Före och efter över flera frön' }),
    h('p', {}, 'En förbättring som syns med ett slumpfrö kan bero på tur. Här tränas dataset B före och efter din förbättring (avsnittet Skapa egen förbättrad data) med ', String(SEED_COUNT), ' olika frön. Sedan ser du i hur många av fallen förbättringen faktiskt ger högre validation accuracy. Sluttestet används inte här.'),
    h('div', { class: 'button-row' }, btn),
    out,
    h('h4', { text: 'Kostnadsfråga: vilket fel är värst?' }),
    h('p', {}, 'Tänk dig att modellen ska filtrera mejl på en skola. Vad är värst: att ett viktigt mejl från en lärare försvinner som spam (falskt positivt) eller att ett spammejl kommer fram (falskt negativt)? Motivera i ditt dokument och koppla till precision och recall. Testa sedan tröskelreglaget under Lektion 1: vilken tröskel skulle du välja, och vad kostar det?'),
  );
  let last = null;
  const render = (state) => {
    btn.disabled = Boolean(state.training);
    if (state.seedImprove === last) return;
    last = state.seedImprove;
    if (!state.seedImprove) {
      replace(out);
      return;
    }
    const pairs = state.seedImprove.pairs;
    const s = summarizeImprovement(pairs);
    replace(
      out,
      table({
        caption: 'Dataset B före och efter din förbättring (valideringsdata)',
        headers: ['Frö', 'Accuracy före', 'Accuracy efter', 'Skillnad (procentenheter)', 'Falskt pos. före/efter', 'Falskt neg. före/efter'],
        rows: pairs.map(({ before, after }) => {
          const [b, a] = [before.validation.metrics, after.validation.metrics];
          return [String(before.settings.seed), formatMetric(b.accuracy), formatMetric(a.accuracy), formatDiff(a.accuracy, b.accuracy), `${b.fp} / ${a.fp}`, `${b.fn} / ${a.fn}`];
        }),
      }),
      h('p', {}, h('strong', { text: 'Sammanfattning: ' }), `efter var bättre i ${s.better} av ${s.n} frön, lika i ${s.same} och sämre i ${s.worse}.`),
      h('p', { class: 'muted', text: 'Med bara 20 valideringstexter är även detta osäkert. Om förbättringen inte syns i de flesta frön kan den bero på slumpen. Resultatet tas med i resultatblocket.' }),
    );
  };
  store.subscribe(render);
  render(store.get());
}
