import { isVisibleIn } from '../lessons.js';
import { h, replace } from './dom.js';
import { goToSection, setRevealer } from './nav.js';

/**
 * Stegen i sidans ordning. "Förbered och träna" och "Förbättra data och kör sluttest" delas upp i tre steg var
 * så att varje sida blir kort. Stegnamnet ska vara samma som rubriken i sidan.
 */
const PAGES = [
  ['intro', 'Introduktion'],
  ['data', 'Välj dataset'],
  ['installningar', 'Välj inställningar'],
  ['trana', 'Träna modellen'],
  ['resultat', 'Resultat'],
  ['testa', 'Testa egen text'],
  ['byt-texter', 'Byt ut texter'],
  ['fore-efter', 'Träna före och efter'],
  ['sluttest', 'Sluttest'],
  ['extra', 'Fördjupning'],
  ['spara', 'Spara och återställ'],
];

/**
 * Lektioner som behöver en annan ordning än sidans. I lektion 4 tränar "Träna modellen" före och efter, vilket
 * kräver att texterna redan är utbytta. Därför kommer Byt ut texter och Träna före och efter före Resultat,
 * och Välj dataset (låst till B) och Träna modellen hoppas över.
 */
const LESSON_ORDER = {
  4: ['intro', 'installningar', 'byt-texter', 'fore-efter', 'resultat', 'testa', 'sluttest', 'extra', 'spara'],
};

/**
 * Steg-för-steg-visning: när en lektion är vald visas ett steg i taget med knapparna Föregående och Nästa.
 * I läget "Alla" visas hela sidan som vanligt. Stegen döljs med en klass (inte hidden) så att
 * lektionsväljarens hidden-styrning av avsnitten fortsätter att fungera oberoende av detta.
 */
export function mountStepper(store) {
  const main = document.getElementById('main');
  const all = PAGES.map(([id, title]) => {
    const el = document.getElementById(id);
    return { id, title, el, section: el.closest('section') };
  });
  const sections = [...new Set(all.map((p) => p.section))];

  const count = h('p', { class: 'stepper-count' });
  const list = h('ol', { class: 'stepper-list' });
  const top = h('nav', { class: 'stepper', 'aria-label': 'Steg i lektionen' }, count, list);
  const prevBtn = h('button', { type: 'button', class: 'btn btn-secondary', text: '← Föregående', onclick: () => show(index - 1) });
  const nextBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => show(index + 1) });
  const bottom = h('div', { class: 'stepper-nav' }, prevBtn, nextBtn);
  main.prepend(top);
  main.append(bottom);

  let on = false;
  let pages = [];
  let index = 0;
  let stepButtons = [];
  let sig = '';
  let lastLesson = null;
  let lastScreen = null;

  const apply = () => {
    document.documentElement.classList.toggle('stepper-on', on);
    top.hidden = !on;
    bottom.hidden = !on;
    const cur = pages[index];
    for (const p of all) if (p.el !== p.section) p.el.classList.toggle('step-hidden', on && p !== cur);
    for (const s of sections) s.classList.toggle('step-hidden', on && s !== cur?.section);
    if (!on || !cur) return;
    count.textContent = `Steg ${index + 1} av ${pages.length}: ${cur.title}`;
    stepButtons.forEach((b, i) => (i === index ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    // På smal skärm är stegraden en rad som kan svepas: rulla fram aktuellt steg (utan att rulla hela sidan).
    const curLi = stepButtons[index]?.parentElement;
    if (curLi && list.scrollWidth > list.clientWidth) list.scrollLeft = curLi.offsetLeft - (list.clientWidth - curLi.offsetWidth) / 2;
    prevBtn.disabled = index === 0;
    const next = pages[index + 1];
    nextBtn.hidden = !next;
    if (next) nextBtn.textContent = `Nästa: ${next.title} →`;
  };

  // Byter steg och flyttar fokus till stegets rubrik, så att tangentbord och skärmläsare följer med.
  const show = (i) => {
    if (i < 0 || i >= pages.length) return;
    index = i;
    apply();
    const cur = pages[index];
    top.scrollIntoView();
    const heading = cur.el.matches('h2, h3') ? cur.el : cur.el.querySelector('h2, h3');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    history.replaceState(null, '', `#${cur.id}`);
  };

  // Stegindex för ett mål (t.ex. "#trana" från guiden eller "#forbered" från menyn), eller -1.
  const pageIndexOf = (target) => pages.findIndex((p) => p.el === target || p.el.contains(target) || target.contains(p.el));

  // Länkar i guiden och menyn (goToSection) byter först till rätt steg.
  setRevealer((target) => {
    if (!on) return;
    const i = pageIndexOf(target);
    if (i >= 0 && i !== index) {
      index = i;
      apply();
    }
  });

  // Vanliga länkar i texten (t.ex. <a href="#installningar">) går via goToSection så att rätt steg visas.
  // Länkar som redan hanterar klicket själva (guiden, knapparna i resultaten) har anropat preventDefault.
  document.addEventListener('click', (e) => {
    const link = e.target.closest?.('a[href^="#"]');
    if (!link || e.defaultPrevented || link.classList.contains('skip-link')) return;
    if (goToSection(link.getAttribute('href'))) e.preventDefault();
  });

  const render = (state) => {
    on = state.screen === 'lesson' && state.lesson !== 'all';
    // Fördjupning är dold i Förenklad visning, utom i lektion 5 där analysmallen är lektionens huvuduppgift.
    const standardOnly = (p) => p.section.classList.contains('only-standard') && state.lesson !== 5;
    const shown = (p) => isVisibleIn(p.section.dataset.lessons, state.lesson) && !(state.view === 'simple' && standardOnly(p));
    const order = LESSON_ORDER[state.lesson];
    const visible = order ? order.map((id) => all.find((p) => p.id === id)).filter(shown) : all.filter(shown);
    const nextSig = `${state.screen}|${state.lesson}|${state.view}|${visible.map((p) => p.id).join(',')}`;
    if (nextSig === sig) return;
    sig = nextSig;
    const cur = pages[index];
    pages = visible;
    if (lastLesson === null) {
      // Första visningen: börja på steget i adressen (#resultat osv.) om det finns, annars på steg 1.
      const target = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
      index = Math.max(0, target ? pageIndexOf(target) : 0);
    } else if (state.lesson !== lastLesson || state.screen !== lastScreen) {
      // Ny lektion, eller lektionen öppnas från startskärmen: börja på introduktionen.
      index = 0;
    } else {
      index = Math.max(0, pages.indexOf(cur));
    }
    lastLesson = state.lesson;
    lastScreen = state.screen;
    // Namnet läses upp som "Steg 1 Introduktion" och innehåller den synliga texten ("1 Introduktion", på mobil "1"),
    // så att röststyrning ("klicka 1") fungerar. Ingen aria-label, eftersom den skulle ersätta den synliga texten.
    stepButtons = pages.map((p, i) =>
      h(
        'button',
        { type: 'button', class: 'btn btn-small stepper-step', onclick: () => show(i) },
        h('span', { class: 'offscreen', text: 'Steg ' }),
        h('span', { class: 'stepper-num', text: String(i + 1) }),
        h('span', { class: 'stepper-name', text: ` ${p.title}` }),
      ),
    );
    replace(list, stepButtons.map((b) => h('li', {}, b)));
    apply();
  };
  store.subscribe(render);
  render(store.get());
}
