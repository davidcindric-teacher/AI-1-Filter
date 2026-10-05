import { buildPlan, buildSeedImprovePlan, buildSeedPlan, shownDataset } from '../experiments.js';
import { trainModel } from '../ml/trainer.js';
import { TrainingCancelled, UserError } from '../errors.js';
import { appendHistory } from '../history.js';
import { EPOCH_COMPARISON, HIDDEN_COMPARISON, LR_COMPARISON } from '../config.js';
import { announce, h } from './dom.js';
import { goToSection } from './nav.js';

let runCounter = 0;
let cancelRequested = false;

/** Svensk uppräkning: "5, 30 och 100". */
const list = (values) => {
  const v = values.map((x) => String(x).replace('.', ','));
  return `${v.slice(0, -1).join(', ')} och ${v.at(-1)}`;
};

const MODE_TEXT = {
  single: (s) => `Tränar 1 ny modell (${s.epochs} epoker).`,
  'compare-datasets': (s) => `Tränar 2 nya modeller: dataset A och dataset B (${s.epochs} epoker vardera).`,
  'compare-epochs': () => `Tränar ${EPOCH_COMPARISON.length} nya modeller på dataset B: ${list(EPOCH_COMPARISON)} epoker.`,
  improve: (s) => `Tränar 2 nya modeller: dataset B före och efter din förbättring (${s.epochs} epoker vardera).`,
  'compare-abc': (s) => `Tränar 3 nya modeller: dataset A, dataset B och ditt eget mix C (${s.epochs} epoker vardera).`,
  'compare-lr': (s) => `Tränar ${LR_COMPARISON.length} nya modeller på dataset B med learning rate ${list(LR_COMPARISON)} (${s.epochs} epoker vardera).`,
  'compare-hidden': (s) => `Tränar ${HIDDEN_COMPARISON.length} nya modeller på dataset B med ${list(HIDDEN_COMPARISON)} dolda noder (${s.epochs} epoker vardera).`,
};

/** Översätter tekniska fel till begripliga svenska meddelanden. */
export function describeError(err) {
  if (err instanceof UserError) return { message: err.message, details: err.details };
  if (err instanceof RangeError || /memory|allocation/i.test(String(err?.message))) {
    return { message: 'Minnet räckte inte till för träningen. Stäng andra flikar eller appar och försök igen, eller välj färre epoker och färre dolda noder.', details: [] };
  }
  return { message: 'Något gick fel under träningen. Ladda om sidan och försök igen. Din text i arbetsdokumentet påverkas inte.', details: [String(err?.message ?? err)] };
}

/** Delad träningsloop: tränar varje spec från början i tur och ordning. onSuccess får alla färdiga resultat. */
async function executePlan(store, plan, onSuccess) {
  cancelRequested = false;
  announce('Träningen startar.');
  store.set({ error: null, notice: null, training: { runLabel: plan[0].label, runIndex: 0, runCount: plan.length, epoch: 0, epochs: plan[0].settings.epochs } });
  const results = [];
  try {
    for (let i = 0; i < plan.length; i++) {
      const spec = plan[i];
      store.set({ training: { runLabel: spec.label, runIndex: i, runCount: plan.length, epoch: 0, epochs: spec.settings.epochs } });
      const result = await trainModel(spec, {
        shouldCancel: () => cancelRequested,
        onEpoch: (entry) => store.set({ training: { runLabel: spec.label, runIndex: i, runCount: plan.length, epoch: entry.epoch, epochs: spec.settings.epochs } }),
      });
      results.push({ ...result, id: `run-${++runCounter}` });
    }
    onSuccess(results);
    announce('Träningen är klar.');
  } catch (err) {
    if (err instanceof TrainingCancelled) {
      store.set({
        training: null,
        notice: { text: 'Träningen avbröts. Den delvis tränade modellen har kastats. Dina tidigare resultat är oförändrade.' },
        error: { message: 'Träningen avbröts.', details: [] },
      });
    } else {
      store.set({ training: null, error: describeError(err) });
    }
  }
}

function canStart(store) {
  const state = store.get();
  if (state.training) return false;
  if (state.unsupported) {
    store.set({ error: { message: state.unsupported, details: [] } });
    return false;
  }
  return true;
}

export async function startTraining(store) {
  if (!canStart(store)) return;
  const state = store.get();
  let plan;
  try {
    plan = buildPlan({ mode: state.mode, datasetKey: state.datasetKey, settings: state.settings, edits: state.edits, mixIds: state.mixIds });
  } catch (err) {
    store.set({ error: describeError(err), notice: null });
    return;
  }
  await executePlan(store, plan, (results) => {
    store.set({
      training: null,
      runs: results,
      runsMode: state.mode,
      history: appendHistory(store.get().history, results),
      // Nya resultat måste kopieras på nytt (lektionsguiden bockar av det).
      copied: { ...store.get().copied, result: false, recovery: false },
      finalTest: null,
      thresholdExp: null,
      notice: { text: 'Träningen är klar. Resultaten visas i steget Resultat. Kopiera resultatblock och återställningstext till ditt arbetsdokument (steget Spara och återställ).' },
    });
    // Går vidare till steget Resultat (i steg-för-steg-visningen byts steg, annars rullar sidan dit).
    goToSection('#resultat');
  });
}

/** Extra: samma träning med 5 olika slumpfrön. Ersätter inte de vanliga resultaten. */
export async function startSeedExperiment(store) {
  if (!canStart(store)) return;
  const state = store.get();
  let plan;
  try {
    plan = buildSeedPlan({ datasetKey: shownDataset(state), settings: state.settings, edits: state.edits, mixIds: state.mixIds });
  } catch (err) {
    store.set({ error: describeError(err), notice: null });
    return;
  }
  await executePlan(store, plan, (results) => {
    store.set({
      training: null,
      seedExperiment: { runs: results },
      notice: { text: 'Frö-experimentet är klart. Se resultaten i steget Fördjupning. Dina vanliga resultat i steget Resultat är oförändrade.' },
    });
    document.getElementById('extra')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/** Extra (lektion 4): dataset B före och efter förbättringen med 5 olika frön. */
export async function startSeedImprove(store) {
  if (!canStart(store)) return;
  const state = store.get();
  let plan;
  try {
    plan = buildSeedImprovePlan({ settings: state.settings, edits: state.edits });
  } catch (err) {
    store.set({ error: describeError(err), notice: null });
    return;
  }
  await executePlan(store, plan, (results) => {
    const pairs = [];
    for (let i = 0; i < results.length; i += 2) pairs.push({ before: results[i], after: results[i + 1] });
    store.set({
      training: null,
      seedImprove: { pairs },
      notice: { text: 'Före/efter över flera frön är klart. Se resultaten i steget Fördjupning. Dina vanliga resultat i steget Resultat är oförändrade.' },
    });
    document.getElementById('extra')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

export function mountTrain(root, store) {
  const startBtn = h('button', { type: 'button', class: 'btn btn-primary btn-large', id: 'btn-train', text: 'Träna från början', onclick: () => startTraining(store) });
  const cancelBtn = h('button', {
    type: 'button',
    class: 'btn btn-secondary',
    id: 'btn-cancel',
    text: 'Avbryt träningen',
    hidden: true,
    onclick: () => {
      cancelRequested = true;
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Avbryter …';
    },
  });
  const plan = h('p', { class: 'muted', id: 'train-plan' });
  const progress = h('progress', { id: 'train-progress', max: '100', value: '0', 'aria-labelledby': 'train-status', hidden: true });
  const status = h('p', { id: 'train-status', class: 'train-status' });
  const notice = h('p', { class: 'banner banner-ok', hidden: true });

  // Lektion 1: eleven skriver en hypotes innan träningen, så att resultatet kan jämföras med förväntan.
  const hypothesis = h('p', { class: 'callout' }, h('strong', { text: 'Innan du tränar: ' }), 'skriv i ditt dokument vad du tror att validation accuracy blir. Jämför sedan med resultatet och försök förklara skillnaden.');
  hypothesis.dataset.lessons = '1';

  root.append(
    hypothesis,
    h('p', {}, 'Varje träning börjar ', h('strong', { text: 'från början' }), ' med nya startvikter som bestäms av slumpfröet. Modellen fortsätter aldrig från en tidigare träning, så samma inställningar ger alltid samma resultat.'),
    h('div', { class: 'button-row' }, startBtn, cancelBtn),
    plan,
    progress,
    status,
    notice,
  );

  const render = (state) => {
    const t = state.training;
    plan.textContent = MODE_TEXT[state.mode](state.settings);
    startBtn.disabled = Boolean(t);
    cancelBtn.hidden = !t;
    if (t) {
      cancelBtn.disabled = cancelRequested;
      if (!cancelRequested) cancelBtn.textContent = 'Avbryt träningen';
      progress.hidden = false;
      progress.value = Math.round((t.epoch / t.epochs) * 100);
      // Statusraden visas för alla; skärmläsare får bara besked vid start och slut (inte varje epok).
      status.textContent = `Tränar ${t.runLabel} (modell ${t.runIndex + 1} av ${t.runCount}): epok ${t.epoch} av ${t.epochs}`;
    } else {
      progress.hidden = true;
      if (state.runs.length && !state.error) status.textContent = '';
    }
    notice.hidden = !state.notice || Boolean(t);
    if (state.notice) notice.textContent = state.notice.text;
  };
  store.subscribe(render);
  render(store.get());
}
