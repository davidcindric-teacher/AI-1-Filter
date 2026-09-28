import { LABEL_NAMES } from '../config.js';
import { formatMetric } from '../metrics.js';
import { h, replace } from './dom.js';
import { goToSection } from './nav.js';
import { testAndLog } from './tester.js';

/**
 * Snabbtest direkt i resultatkortet: eleven slipper scrolla till "Testa egen text" för att prova en idé
 * medan hen tittar på förväxlingsmatrisen och felen. Samma testLog som huvudtestet (avsnittet Testa egen text),
 * så resultatet räknas in i lektionsguiden och resultatblocket där också.
 */
export function quickTest(run, store) {
  const id = `qt-${run.id}`;
  const input = h('textarea', { id, rows: '2', maxlength: '300', placeholder: 'Skriv en egen text, t.ex. "Hej, ses vi imorgon?"' });
  const out = h('div', { class: 'quick-test-out', role: 'status', 'aria-live': 'polite' });

  const run_ = () => {
    try {
      const answer = testAndLog(store, run, input.value);
      const spam = answer.predicted === 'spam';
      replace(
        out,
        h('p', { class: `verdict verdict-compact ${spam ? 'verdict-spam' : 'verdict-ham'}` }, h('strong', { text: LABEL_NAMES[answer.predicted] }), ` · spam-sannolikhet ${formatMetric(answer.probability)}`),
      );
    } catch (err) {
      replace(out, h('p', { class: 'banner banner-error banner-compact', text: err.message }));
      input.focus();
    }
  };

  return h(
    'div',
    { class: 'quick-test' },
    h('h4', { text: 'Snabbtest: prova en egen text direkt här' }),
    h('div', { class: 'field' }, h('label', { for: id, text: `Egen text för ${run.label}` }), input),
    h(
      'div',
      { class: 'button-row' },
      h('button', { type: 'button', class: 'btn btn-secondary', text: 'Testa', onclick: run_ }),
      h('a', { href: '#testa', class: 'btn btn-link-plain', text: 'Fler detaljer i Testa egen text', onclick: (e) => { e.preventDefault(); goToSection('#testa'); } }),
    ),
    out,
    h('p', { class: 'muted small', text: 'Din text ändrar inte modellen eller träningsdata.' }),
  );
}
