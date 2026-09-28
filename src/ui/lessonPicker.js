import { allowedDatasets, guideProgress, guideSteps, isVisibleIn, LESSON_KEYS, LESSONS, modeForLesson } from '../lessons.js';
import { h, replace } from './dom.js';
import { goToSection } from './nav.js';

export function setLesson(store, lesson) {
  const state = store.get();
  if (state.lesson === lesson) return;
  // Ett dataset som inte hör till lektionen (t.ex. eget mix i lektion 1) byts till dataset A så att inget dolt val styr träningen.
  const datasetKey = allowedDatasets(lesson).includes(state.datasetKey) ? state.datasetKey : 'a';
  store.set({ lesson, mode: modeForLesson(lesson, state.mode), datasetKey });
}

/** Rad med knappar för att välja lektion (1–5 eller "Alla"). Byggs en gång och uppdateras på plats. */
function mountPicker(root, store, { compact }) {
  const buttons = [...LESSON_KEYS, 'all'].map((key) =>
    h('button', {
      type: 'button',
      class: 'btn lesson-btn',
      'aria-label': key === 'all' ? 'Visa alla avsnitt' : `Lektion ${key}: ${LESSONS[key].title}`,
      text: key === 'all' ? 'Alla' : compact ? String(key) : `Lektion ${key}`,
      onclick: () => setLesson(store, key),
    }),
  );
  replace(root, buttons);
  return (state) => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String([...LESSON_KEYS, 'all'][i] === state.lesson)));
}

/** Lektionsguide: steg som bockas av automatiskt (eller av eleven själv för steg som handlar om det egna dokumentet). */
function mountGuide(root, block, store, { onNavigate, summary = null }) {
  const progress = h('p', { class: 'guide-progress', 'aria-live': 'polite' });
  const list = h('ol', { class: 'guide-list' });
  root.append(progress, list);
  let sig = '';
  let items = [];

  const go = (target) => (e) => {
    e.preventDefault();
    onNavigate?.();
    goToSection(target);
  };

  return (state) => {
    block.hidden = state.lesson === 'all';
    if (state.lesson === 'all') return;
    const steps = guideSteps(state.lesson, state);
    const nextSig = `${state.lesson}|${steps.map((s) => s.id).join(',')}`;
    if (nextSig !== sig) {
      sig = nextSig;
      items = steps.map((s) => {
        const mark = h('span', { class: 'guide-mark', 'aria-hidden': 'true' });
        const status = h('span', { class: 'offscreen' });
        const text = h('span', { class: 'guide-text' });
        let extra;
        let content;
        if (s.kind === 'manual') {
          const box = h('input', { type: 'checkbox', id: `guide-${root.id}-${s.id}`, onchange: (e) => store.set({ manualDone: { ...store.get().manualDone, [s.id]: e.target.checked } }) });
          content = h('label', { for: box.id, class: 'guide-check' }, box, text);
          extra = { box };
        } else {
          content = h('a', { href: s.target, class: 'guide-link', onclick: go(s.target) }, text);
        }
        const goto = s.kind === 'manual' ? h('a', { href: s.target, class: 'guide-goto', text: 'Gå dit', onclick: go(s.target) }) : null;
        const li = h('li', { class: 'guide-item' }, mark, content, status, goto);
        return { id: s.id, li, mark, status, text, ...extra };
      });
      replace(list, items.map((i) => i.li));
    }
    steps.forEach((s, i) => {
      const it = items[i];
      it.li.classList.toggle('is-done', s.done);
      it.mark.textContent = s.kind === 'manual' ? '' : s.done ? '✔' : '○';
      it.mark.hidden = s.kind === 'manual';
      it.status.textContent = s.done ? ' (klart)' : ' (inte klart)';
      if (it.text.textContent !== s.text) it.text.textContent = s.text;
      if (it.box && it.box.checked !== s.done) it.box.checked = s.done;
    });
    const p = guideProgress(steps);
    if (summary) {
      const next = steps.find((s) => !s.done);
      summary.textContent = next ? `Steg ${p.done + 1} av ${p.total}: ${next.text}` : `Alla ${p.total} steg är klara`;
    }
    progress.textContent = p.done === p.total ? `Alla ${p.total} steg är klara. Bra jobbat!` : `${p.done} av ${p.total} steg klara`;
  };
}

/** Lektionsväljare (sidhuvud + meny), lektionsguide (sidhuvud + meny) och visning av rätt avsnitt för vald lektion. */
export function mountLessons(store, { closeMenu }) {
  const $ = (id) => document.getElementById(id);
  const updates = [
    mountPicker($('lesson-picker'), store, { compact: false }),
    mountPicker($('lesson-picker-drawer'), store, { compact: true }),
    mountGuide($('guide-page'), $('guide-page-block'), store, { summary: $('guide-summary-text') }),
    mountGuide($('guide-drawer'), $('guide-drawer-block'), store, { onNavigate: closeMenu }),
  ];
  const goal = $('lesson-goal');
  let lastLesson = null;
  const render = (state) => {
    updates.forEach((u) => u(state));
    if (state.lesson === lastLesson) return;
    lastLesson = state.lesson;
    goal.textContent = state.lesson === 'all' ? 'Alla avsnitt visas.' : `Lektion ${state.lesson}: ${LESSONS[state.lesson].title}. ${LESSONS[state.lesson].goal}`;
    document.documentElement.dataset.lesson = String(state.lesson);
    // Introduktionen är öppen i lektion 1 (och Alla) på bred skärm. På smal skärm (mobil) är den hopfälld från början
    // i alla lägen, eftersom den annars tar nästan en hel skärm och skjuter undan träningsknappen.
    const narrow = window.matchMedia('(max-width: 40rem)').matches;
    $('intro-details').open = !narrow && (state.lesson === 1 || state.lesson === 'all');
    for (const el of document.querySelectorAll('[data-lessons]')) el.hidden = !isVisibleIn(el.dataset.lessons, state.lesson);
  };
  store.subscribe(render);
  render(store.get());
}
