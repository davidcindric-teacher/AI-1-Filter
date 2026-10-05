import { buildRecoveryText, parseRecoveryText } from '../recovery.js';
import { buildResultBlock } from '../report.js';
import { validateSettings } from '../ml/trainer.js';
import { clearConvenience } from '../storage.js';
import { UserError } from '../errors.js';
import { allowedDatasets, lessonOfMode } from '../lessons.js';
import { shownDataset } from '../experiments.js';
import { copyToClipboard, downloadTextFile, h, replace } from './dom.js';
import { startTraining } from './train.js';

export function resultBlockFromState(state, now = new Date()) {
  const changes = [];
  if (state.runsMode === 'improve' && state.runs.length === 2) {
    const [before, after] = state.runs;
    const beforeById = new Map(before.trainingTexts.map((t) => [t.id, t]));
    for (const t of after.trainingTexts) {
      const b = beforeById.get(t.id);
      if (b && b.text !== t.text) changes.push({ label: t.label === 'spam' ? 'spam' : 'vanliga', before: b.text, after: t.text });
    }
  }
  return buildResultBlock({ attemptName: state.attemptName, now, runs: state.runs, testLog: state.testLog, finalTest: state.finalTest, changes, history: state.history, seedExperiment: state.seedExperiment, seedImprove: state.seedImprove, thresholdExp: state.thresholdExp });
}

export function recoveryFromState(state, now = new Date()) {
  validateSettings({ ...state.settings, threshold: 0.5 });
  // I låsta laborationer sparas laborationens dataset (t.ex. B i lektion 3), inte ett dolt tidigare val.
  return buildRecoveryText({ attemptName: state.attemptName, now, mode: state.mode, datasetKey: shownDataset(state), settings: state.settings, edits: state.edits, mixIds: state.mixIds, results: state.runs });
}

/**
 * Formulär för att läsa in en återställningstext. Används i steget Spara och återställ och överst i Resultat
 * i lektion 5. keepLesson: stanna i nuvarande lektion (lektion 5 analyserar resultat från lektion 1–4).
 */
export function mountRestore(root, store, { idPrefix = '', keepLesson = false } = {}) {
  const importBox = h('textarea', { id: `${idPrefix}import-text`, rows: '8', placeholder: 'Klistra in återställningstexten här (börjar med {)' });
  const importMsg = h('div', { class: 'import-msg', role: 'alert' });

  const load = () => {
    const res = parseRecoveryText(importBox.value);
    if (!res.ok) {
      replace(importMsg, h('div', { class: 'banner banner-error' }, h('p', {}, h('strong', { text: 'Återställningen kunde inte läsas in.' })), h('ul', {}, res.errors.map((e) => h('li', { text: e })))));
      return;
    }
    const s = res.state;
    store.set({ attemptName: s.attemptName || store.get().attemptName, mode: s.mode, lesson: keepLesson ? store.get().lesson : allowedDatasets(lessonOfMode(s.mode)).includes(s.datasetKey) ? lessonOfMode(s.mode) : 'all', datasetKey: s.datasetKey, settings: s.settings, edits: s.edits, mixIds: s.mixIds, runs: [], runsMode: null, finalTest: null, seedExperiment: null, seedImprove: null, thresholdExp: null, error: null, notice: null });
    replace(
      importMsg,
      h(
        'div',
        { class: 'banner banner-ok' },
        h('p', { text: `Återställningen är inläst (app ${s.appVersion ?? 'okänd version'}, ${s.createdAt ? s.createdAt.slice(0, 10) : 'okänt datum'}). Träningsdata, inställningar och slumpfrö är tillbaka. Träna från början för att få samma resultat igen.` }),
        h('button', { type: 'button', class: 'btn btn-primary', text: 'Träna nu', onclick: () => startTraining(store) }),
      ),
    );
    // Ingen egen announce() här: importMsg har role="alert" och läses upp automatiskt när innehållet byts ut.
  };

  root.append(
    h('div', { class: 'field' }, h('label', { for: importBox.id, text: 'Återställningstext' }), importBox),
    h('div', { class: 'button-row' }, h('button', { type: 'button', class: 'btn btn-secondary', text: 'Läs in återställning', onclick: load })),
    importMsg,
  );
}

export function mountSave(root, store) {
  const status = h('p', { class: 'save-status', role: 'status', 'aria-live': 'polite' });
  const resultPreview = h('textarea', { id: 'preview-result', readonly: true, rows: '10', 'aria-label': 'Resultatblock att kopiera manuellt' });
  const recoveryPreview = h('textarea', { id: 'preview-recovery', readonly: true, rows: '10', 'aria-label': 'Återställningstext att kopiera manuellt' });

  // status har redan role="status" aria-live="polite", så det räcker att byta ut innehållet: ett extra
  // announce()-anrop skulle läsa upp samma text två gånger för en skärmläsare.
  const say = (text, ok = true) => {
    replace(status, h('span', { class: ok ? 'ok' : 'warn', text }));
  };

  const guarded = (fn) => {
    try {
      return fn();
    } catch (err) {
      const msg = err instanceof UserError ? [err.message, ...err.details].join(' ') : 'Kunde inte skapa texten.';
      say(msg, false);
      return null;
    }
  };

  const copy = async (kind) => {
    const state = store.get();
    const text = guarded(() => (kind === 'result' ? resultBlockFromState(state) : recoveryFromState(state)));
    if (text === null) return;
    const preview = kind === 'result' ? resultPreview : recoveryPreview;
    preview.value = text;
    preview.closest('details').open = true;
    const ok = await copyToClipboard(text);
    // Visas texten för manuell kopiering räknas det som gjort (appen kan inte se vad eleven kopierar).
    store.set({ copied: { ...store.get().copied, [kind]: true } });
    const what = kind === 'result' ? 'Resultatblocket' : 'Återställningstexten';
    const done = kind === 'result' ? 'kopierat' : 'kopierad';
    say(ok ? `${what} är ${done}. Klistra in det i ditt arbetsdokument nu.` : `${what} kunde inte kopieras automatiskt. Markera texten i rutan nedan och kopiera den manuellt.`, ok);
  };



  const download = () => {
    const state = store.get();
    const text = guarded(() => recoveryFromState(state));
    if (text === null) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(`spamfilter-aterstallning-${date}.json`, text);
    say('Filen laddas ner. Kopiera ändå återställningstexten till ditt arbetsdokument: filen kan vara svår att hitta igen.');
  };

  const restoreRoot = h('div');
  mountRestore(restoreRoot, store);

  const nameInput = h('input', { id: 'attempt-name', type: 'text', maxlength: '80', value: store.get().attemptName, autocomplete: 'off', oninput: (e) => store.set({ attemptName: e.target.value }) });

  root.append(
    h('p', { class: 'callout callout-strong' }, h('strong', { text: 'Arbetsdokumentet är den riktiga sparplatsen. ' }), 'Appen sparar inte ditt arbete: sidan kan laddas om och webbläsaren kan rensa sin lagring. Kopiera resultatblocket och återställningstexten till ditt Google- eller Word-dokument efter varje körning.'),
    h('div', { class: 'field field-narrow' }, h('label', { for: 'attempt-name', text: 'Försöksnamn (visas i resultatblocket)' }), nameInput),
    h('h3', { text: 'Spara' }),
    h(
      'div',
      { class: 'button-row' },
      h('button', { type: 'button', class: 'btn btn-primary', text: 'Kopiera resultatblock', onclick: () => copy('result') }),
      h('button', { type: 'button', class: 'btn btn-primary', text: 'Kopiera återställningstext', onclick: () => copy('recovery') }),
      h('button', { type: 'button', class: 'btn btn-secondary', text: 'Ladda ner återställning (.json)', onclick: download }),
    ),
    status,
    h('p', { class: 'muted only-standard', text: 'Resultatblocket är vanlig text som du kan klistra in i ett dokument. Återställningstexten innehåller dina träningstexter, inställningar, slumpfrö och appversion. Med den kan du återskapa körningen senare. Filen du kan ladda ner ersätter inte att kopiera texten till arbetsdokumentet.' }),
    h('details', {}, h('summary', { text: 'Visa resultatblocket (kopiera manuellt om knappen inte fungerar)' }), resultPreview),
    h('details', {}, h('summary', { text: 'Visa återställningstexten (kopiera manuellt om knappen inte fungerar)' }), recoveryPreview),
    // Det viktiga i steget är att kopiera. Återställning och webbläsarens lagring behövs sällan och är hopfällda.
    h(
      'details',
      { class: 'advanced save-more' },
      h('summary', { text: 'Återställ från en tidigare återställningstext' }),
      h('p', { class: 'only-standard' }, 'Klistra in en tidigare återställningstext och läs in den. Appen kontrollerar texten först. Nuvarande resultat rensas och du tränar om från början. Med samma slumpfrö, data och inställningar får du samma resultat igen.'),
      restoreRoot,
    ),
    h('details', { class: 'advanced save-more only-standard' }, h('summary', { text: 'Det här sparas i webbläsaren' }), h('p', { class: 'muted' }, 'Inställningar och dina ändringar av datan kan sparas i den här webbläsaren som en extra bekvämlighet. Det kan försvinna när som helst, till exempel om webbläsaren rensar data eller om du byter enhet. Förlita dig inte på det. ', h('button', { type: 'button', class: 'btn btn-small btn-secondary', text: 'Rensa sparat i webbläsaren', onclick: () => { clearConvenience(); say('Det som sparats i webbläsaren är rensat.'); } }))),
  );
  return { copy };
}
