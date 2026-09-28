import { DEFAULTS } from './config.js';

/** Minimal tillståndshantering: ett objekt, ändras med set(patch), paneler prenumererar med subscribe(). */
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const initialState = () => ({
  view: 'standard', // 'standard' | 'simple' (bara presentation, påverkar inte modell eller resultat)
  lesson: 1, // 1–5 eller 'all' (visar hela appen). Styr vilka avsnitt och laborationer som visas.
  screen: 'home', // 'home' (startskärm med lektionsval) | 'lesson' (den valda lektionen). Sparas inte.
  allUnlocked: false, // "Visa alla avsnitt" upplåst (bara denna session)
  finalTestUnlocked: false, // sluttestet upplåst för en körning (låses igen när det körts)
  mode: 'single',
  datasetKey: 'a',
  settings: { seed: DEFAULTS.seed, epochs: DEFAULTS.epochs, learningRate: DEFAULTS.learningRate, batchSize: DEFAULTS.batchSize, hiddenUnits: DEFAULTS.hiddenUnits },
  attemptName: 'Försök 1',
  edits: {}, // { id: ny text } för förbättrad dataset B
  mixIds: [], // val av texter till dataset C (id från A och B)
  runs: [], // färdiga körningar (resultat) från senaste träningen
  history: [], // kort sammanfattning av alla körningar i sessionen (bara i minnet)
  copied: { result: false, recovery: false, analysis: false }, // har eleven kopierat efter senaste körningen?
  manualDone: {}, // steg i lektionsguiden som eleven själv bockat av
  runsMode: null,
  testLog: [], // elevens egna testtexter (påverkar aldrig modellen)
  seedExperiment: null, // { runs } från frö-experimentet (extra)
  seedImprove: null, // { pairs: [{ before, after }] } från före/efter över flera frön (extra)
  thresholdExp: null, // { runLabel, threshold, metrics } från tröskelexperimentet (extra)
  finalTest: null, // { count, entries } efter att sluttestet körts
  finalTestRuns: 0, // hur många gånger sluttestet körts denna session
  training: null, // { runLabel, runIndex, runCount, epoch, epochs }
  error: null, // { message, details }
  notice: null, // { text }
  unsupported: null,
});
