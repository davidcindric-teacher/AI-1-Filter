import { allowedDatasets, guideProgress, guideSteps, isUnlocked, isVisibleIn, LESSON_KEYS, LESSONS, modeForLesson } from '../lessons.js';
import { h, replace } from './dom.js';
import { goToSection } from './nav.js';
import { codeGate } from './teacherCode.js';

export function setLesson(store, lesson) {
  const state = store.get();
  if (state.lesson === lesson) {
    if (state.screen !== 'lesson') store.set({ screen: 'lesson' });
    return;
  }
  // Ett dataset som inte hör till lektionen (t.ex. eget mix i lektion 1) byts till dataset A så att inget dolt val styr träningen.
  const datasetKey = allowedDatasets(lesson).includes(state.datasetKey) ? state.datasetKey : 'a';
  store.set({ lesson, screen: 'lesson', mode: modeForLesson(lesson, state.mode), datasetKey });
}

/** Öppnar en lektion från startskärmen eller menyn: byter vy, går till sidans topp och flyttar fokus till lektionsrubriken. */
function enterLesson(store, lesson) {
  const before = store.get();
  setLesson(store, lesson);
  if (before.screen !== 'home' && before.lesson === lesson) return;
  window.scrollTo(0, 0);
  document.getElementById('lesson-heading')?.focus({ preventScroll: true });
}

/** Startskärmen: ett stort kort per lektion (och en mindre knapp för att visa allt, som kräver lärarkoden). */
function mountCards(root, store) {
  const gateSlot = h('div', { class: 'lesson-gate' });
  const cards = LESSON_KEYS.map((key) =>
    h(
      'li',
      {},
      h(
        'button',
        { type: 'button', class: 'lesson-card', onclick: () => enterLesson(store, key) },
        h('span', { class: 'lesson-card-num', text: `Lektion ${key}` }),
        h('span', { class: 'lesson-card-title', text: LESSONS[key].title }),
        h('span', { class: 'lesson-card-goal', text: LESSONS[key].goal }),
      ),
    ),
  );
  const openAll = () => {
    if (isUnlocked(store.get(), 'all')) {
      enterLesson(store, 'all');
      return;
    }
    const gate = codeGate({
      id: 'code-home',
      title: 'Visa alla avsnitt är låst.',
      hint: 'Be läraren skriva in lärarkoden.',
      onUnlock: () => {
        store.set({ allUnlocked: true });
        replace(gateSlot);
        enterLesson(store, 'all');
      },
    });
    replace(gateSlot, gate.el);
    gate.focus();
  };
  const allBtn = h('button', { type: 'button', class: 'btn btn-small btn-secondary', text: 'Visa alla avsnitt (för lärare)', onclick: openAll });
  replace(root, h('ul', { class: 'lesson-cards' }, cards), h('p', { class: 'lesson-all' }, allBtn), gateSlot);
}

/** Rad med knappar för att välja lektion (1–5 eller "Alla"). Byggs en gång och uppdateras på plats. */
function mountPicker(root, store, { compact, onPick }) {
  const buttons = [...LESSON_KEYS, 'all'].map((key) =>
    h('button', {
      type: 'button',
      class: 'btn lesson-btn',
      'aria-label': key === 'all' ? 'Visa alla avsnitt' : `Lektion ${key}: ${LESSONS[key].title}`,
      text: key === 'all' ? 'Alla' : compact ? String(key) : `Lektion ${key}`,
      onclick: () => {
        onPick?.();
        enterLesson(store, key);
      },
    }),
  );
  replace(root, buttons);
  // "Alla" går inte att välja i menyn förrän den låsts upp med lärarkoden på startskärmen.
  return (state) =>
    buttons.forEach((b, i) => {
      const key = [...LESSON_KEYS, 'all'][i];
      b.setAttribute('aria-pressed', String(key === state.lesson));
      b.disabled = !isUnlocked(state, key);
      b.title = b.disabled ? 'Låst. Lås upp med lärarkoden på startskärmen.' : '';
    });
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
  mountCards($('lesson-cards'), store);
  $('btn-home').addEventListener('click', () => {
    store.set({ screen: 'home' });
    history.replaceState(null, '', location.pathname + location.search);
    window.scrollTo(0, 0);
    $('home-heading').focus({ preventScroll: true });
  });
  const updates = [
    // Menyn stängs vid val eftersom bakgrunden är inert medan den är öppen (fokus kan annars inte flyttas till lektionen).
    mountPicker($('lesson-picker-drawer'), store, { compact: true, onPick: closeMenu }),
    mountGuide($('guide-page'), $('guide-page-block'), store, {}),
    mountGuide($('guide-drawer'), $('guide-drawer-block'), store, { onNavigate: closeMenu }),
  ];
  const heading = $('lesson-heading');
  const goal = $('lesson-goal');
  let lastLesson = null;
  const render = (state) => {
    document.documentElement.dataset.screen = state.screen;
    updates.forEach((u) => u(state));
    if (state.lesson === lastLesson) return;
    lastLesson = state.lesson;
    heading.textContent = state.lesson === 'all' ? 'Alla avsnitt' : `Lektion ${state.lesson}: ${LESSONS[state.lesson].title}`;
    goal.textContent = state.lesson === 'all' ? 'Hela appen visas på en sida.' : LESSONS[state.lesson].goal;
    document.documentElement.dataset.lesson = String(state.lesson);
    // Begreppen är öppna i lektion 1 (där de introduceras) och hopfällda som repetition i lektion 2–4.
    // I läget Alla är de öppna på bred skärm men hopfällda på mobil, där de annars tar nästan en hel skärm.
    const narrow = window.matchMedia('(max-width: 40rem)').matches;
    $('intro-details').open = state.lesson === 1 || (state.lesson === 'all' && !narrow);
    for (const el of document.querySelectorAll('[data-lessons]')) el.hidden = !isVisibleIn(el.dataset.lessons, state.lesson);
  };
  store.subscribe(render);
  render(store.get());
}
