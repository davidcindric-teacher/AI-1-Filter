import { buildAnalysisTemplate, peerReviewText, PEER_REVIEW_CHECKLIST } from '../analysisTemplate.js';
import { CHALLENGES } from '../text/challenges.js';
import { copyToClipboard, h, replace } from './dom.js';

/** Körningarna som analysmallen bygger på: alla inlästa lektioner i lektion 5, annars de senaste körningarna. */
export const analysisRuns = (state) => (state.lesson === 5 && state.analysisRuns.length ? state.analysisRuns : state.runs);

/** Lektion 5: analysmall med elevens siffror ifyllda, och kamratgranskning. */
export function mountAnalysis(root, store) {
  const loaded = h('p', { class: 'muted' });
  const status = h('p', { class: 'save-status', role: 'status', 'aria-live': 'polite' });
  const preview = h('textarea', { readonly: true, rows: '10', 'aria-label': 'Text att kopiera manuellt' });
  const details = h('details', {}, h('summary', { text: 'Visa texten (kopiera manuellt om knappen inte fungerar)' }), preview);

  const copy = async (text, what) => {
    preview.value = text;
    details.open = true;
    const ok = await copyToClipboard(text);
    if (what === 'Analysmallen') store.set({ copied: { ...store.get().copied, analysis: true } });
    const msg = ok ? `${what} är kopierad. Klistra in den i ditt arbetsdokument.` : `${what} kunde inte kopieras automatiskt. Markera texten i rutan och kopiera manuellt.`;
    // status har redan role="status" aria-live="polite"; ett extra announce()-anrop skulle dubblera utropet.
    replace(status, h('span', { class: ok ? 'ok' : 'warn', text: msg }));
  };

  root.append(
    h('h3', { text: 'Analysmall och kamratgranskning' }),
    h('p', {}, 'Analysmallen ger dig rubriker och stödfrågor med dina egna siffror ifyllda från körningarna i appen. Appen skriver ingen analys åt dig. Tolkningar och slutsatser skriver du själv i ditt dokument.'),
    loaded,
    h(
      'div',
      { class: 'button-row' },
      h('button', { type: 'button', class: 'btn btn-primary', text: 'Kopiera analysmall', onclick: () => { const s = store.get(); copy(buildAnalysisTemplate({ attemptName: s.attemptName, runs: analysisRuns(s), finalTest: s.finalTest }), 'Analysmallen'); } }),
      h('button', { type: 'button', class: 'btn btn-secondary', text: 'Kopiera granskningschecklista', onclick: () => copy(peerReviewText(), 'Checklistan') }),
    ),
    status,
    details,
    h('h3', { text: 'Kamratgranskning: fråga om en kamrats analys' }),
    h('ol', { class: 'checklist' }, PEER_REVIEW_CHECKLIST.map((q) => h('li', { text: q }))),
    h('h3', { text: 'Fler uppgifter' }),
    h('ol', {}, CHALLENGES.find((c) => c.key === 'analysis').tasks.map((t) => h('li', { text: t }))),
  );

  const render = (state) => {
    const lessons = [...new Set(state.analysisRuns.map((r) => r.lesson))].sort();
    loaded.textContent = lessons.length
      ? `Inlästa lektioner som tas med i mallen: ${lessons.join(', ')}. Vill du ha med fler läser du in dem i steget Resultat.`
      : 'Inga lektioner är inlästa än. Läs in en återställningstext i steget Resultat och träna, så fylls mallen med dina siffror.';
  };
  store.subscribe(render);
  render(store.get());
}
