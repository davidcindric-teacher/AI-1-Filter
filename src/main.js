import './styles.css';
import { APP_VERSION, DATASET_KEYS, LIMITS, MODES } from './config.js';
import { normalizeMixIds } from './mixData.js';
import { BASE_ROWS } from './customData.js';
import { allowedDatasets, isValidLesson } from './lessons.js';
import { initialState, createStore } from './state.js';
import { loadConvenience, saveConvenience } from './storage.js';
import { h, replace, $ } from './ui/dom.js';
import { mountDatasetPicker } from './ui/datasetPicker.js';
import { mountSettings } from './ui/settings.js';
import { mountTrain } from './ui/train.js';
import { mountResults } from './ui/results.js';
import { mountTester } from './ui/tester.js';
import { mountEditor } from './ui/editor.js';
import { mountFinalTest } from './ui/finalTest.js';
import { mountSave } from './ui/save.js';
import { mountExtra } from './ui/extra.js';
import { mountLessons } from './ui/lessonPicker.js';
import { goToSection } from './ui/nav.js';

/** Kontrollerar att webbläsaren har det som behövs. Returnerar ett felmeddelande eller null. */
function checkSupport() {
  try {
    new RegExp('\\p{L}', 'u');
    if (typeof Float64Array === 'undefined' || typeof Promise === 'undefined' || typeof Map === 'undefined' || typeof Symbol === 'undefined') throw new Error('saknas');
    document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    return null;
  } catch {
    return 'Webbläsaren saknar stöd för det som appen behöver (moderna JavaScript-funktioner). Uppdatera webbläsaren eller använd en nyare version av Safari, Chrome, Edge eller Firefox.';
  }
}

/** Läser tillbaka inställningar från localStorage om de ser giltiga ut. Endast en bekvämlighet. */
function restoreConvenience(state) {
  const saved = loadConvenience();
  if (!saved || typeof saved !== 'object') return state;
  const next = { ...state };
  const s = saved.settings;
  if (s && Object.keys(LIMITS).every((k) => typeof s[k] === 'number' && s[k] >= LIMITS[k][0] && s[k] <= LIMITS[k][1])) {
    next.settings = { seed: s.seed, epochs: s.epochs, learningRate: s.learningRate, batchSize: s.batchSize, hiddenUnits: s.hiddenUnits };
  }
  if (Object.prototype.hasOwnProperty.call(MODES, saved.mode)) next.mode = saved.mode;
  if (isValidLesson(saved.lesson)) next.lesson = saved.lesson;
  if (saved.view === 'simple' || saved.view === 'standard') next.view = saved.view;
  if (DATASET_KEYS.includes(saved.datasetKey)) next.datasetKey = saved.datasetKey;
  if (Array.isArray(saved.mixIds)) next.mixIds = normalizeMixIds(saved.mixIds.filter((x) => typeof x === 'string'));
  if (typeof saved.attemptName === 'string') next.attemptName = saved.attemptName.slice(0, 80);
  if (saved.edits && typeof saved.edits === 'object') {
    const known = new Set(BASE_ROWS.map((r) => r.id));
    next.edits = Object.fromEntries(Object.entries(saved.edits).filter(([id, t]) => known.has(id) && typeof t === 'string'));
  }
  if (!allowedDatasets(next.lesson).includes(next.datasetKey)) next.datasetKey = 'a';
  return next;
}

function mountErrors(store) {
  const region = $('#error-region');
  let last = null;
  store.subscribe((state) => {
    if (state.error === last) return;
    last = state.error;
    if (!state.error) {
      replace(region);
      return;
    }
    replace(
      region,
      h(
        'div',
        { class: 'banner banner-error' },
        h('p', {}, h('strong', { text: state.error.message })),
        state.error.details?.length ? h('ul', {}, state.error.details.map((d) => h('li', { text: d }))) : null,
        h('button', { type: 'button', class: 'btn btn-small btn-secondary', text: 'Stäng meddelandet', onclick: () => store.set({ error: null }) }),
      ),
    );
  });
}

/** Växlare mellan Standard och Förenklad visning. Påverkar bara vad som visas, aldrig modell eller resultat. */
function mountViewToggle(store) {
  const root = $('#view-toggle');
  const options = [['standard', 'Standard'], ['simple', 'Förenklad']];
  const buttons = options.map(([key, label]) => h('button', { type: 'button', class: 'btn btn-small', text: label, onclick: () => store.set({ view: key }) }));
  replace(root, buttons);
  const render = (state) => {
    document.documentElement.dataset.view = state.view;
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i][0] === state.view)));
  };
  store.subscribe(render);
  render(store.get());
}

/** Hamburgarmeny till vänster med genvägar till alla avsnitt. Fungerar med tangentbord (Esc stänger, Tab hålls inne i menyn). */
function mountMenu() {
  // returnerar close så att guiden i menyn kan stänga den vid navigering
  const btn = $('#menu-btn');
  const drawer = $('#menu-drawer');
  const backdrop = $('#menu-backdrop');
  const closeBtn = $('#menu-close');
  const focusables = () => [closeBtn, ...drawer.querySelectorAll('a')].filter((el) => el.offsetParent !== null);
  // Allt utom menyn och bakgrunden döljs för assistivteknik medan menyn är öppen (den täcker dem ändå visuellt).
  // Utan detta fångar Tab-fällan nedan bara tangentbordet: en skärmläsares pilnavigering (virtuell markör)
  // hade fortfarande kunnat nå knappar bakom bakgrunden.
  const backgroundEls = ['.skip-link', '.topbar', '.site-header', '#main', '.site-footer'].map((sel) => $(sel)).filter(Boolean);

  const open = () => {
    drawer.hidden = false;
    backdrop.hidden = false;
    for (const el of backgroundEls) el.inert = true;
    btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
    drawer.querySelector('a')?.focus();
  };
  const close = ({ restoreFocus = true } = {}) => {
    if (drawer.hidden) return;
    drawer.hidden = true;
    backdrop.hidden = true;
    for (const el of backgroundEls) el.inert = false;
    btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    if (restoreFocus) btn.focus();
  };

  btn.addEventListener('click', () => (drawer.hidden ? open() : close()));
  closeBtn.addEventListener('click', () => close());
  backdrop.addEventListener('click', () => close());
  document.addEventListener('keydown', (e) => {
    if (drawer.hidden) return;
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Tab') {
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  for (const link of drawer.querySelectorAll('a')) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      close({ restoreFocus: false });
      goToSection(link.getAttribute('href'));
    });
  }
  return { close: () => close({ restoreFocus: false }) };
}

function start() {
  $('#app-version').textContent = APP_VERSION;
  const unsupported = checkSupport();
  const restored = restoreConvenience(initialState());
  const store = createStore({ ...restored, unsupported });
  mountErrors(store);
  mountViewToggle(store);
  const menu = mountMenu();
  if (unsupported) store.set({ error: { message: unsupported, details: [] } });

  mountDatasetPicker($('#mount-data'), store);
  mountSettings($('#mount-settings'), store);
  mountTrain($('#mount-train'), store);
  const saveApi = mountSave($('#mount-save'), store);
  mountResults($('#mount-results'), store, { onCopy: (kind) => saveApi.copy(kind) });
  mountTester($('#mount-tester'), store);
  mountEditor($('#mount-editor'), store);
  mountFinalTest($('#mount-final'), store);
  mountExtra($('#mount-extra'), store);
  mountLessons(store, { closeMenu: menu.close });

  // Extra bekvämlighet: spara inställningar och egna ändringar (aldrig resultat). Kan misslyckas utan att appen påverkas.
  let timer = null;
  store.subscribe((s) => {
    clearTimeout(timer);
    timer = setTimeout(() => saveConvenience({ view: s.view, lesson: s.lesson, settings: s.settings, mode: s.mode, datasetKey: s.datasetKey, attemptName: s.attemptName, edits: s.edits, mixIds: s.mixIds }), 400);
  });
  // Synka försöksnamnet i fältet efter en återställning
  store.subscribe((s) => {
    const input = document.getElementById('attempt-name');
    if (input && document.activeElement !== input && input.value !== s.attemptName) input.value = s.attemptName;
  });
}

start();
