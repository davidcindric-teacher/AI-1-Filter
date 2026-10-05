import { DATASETS } from './data/index.js';
import { EPOCH_COMPARISON, HIDDEN_COMPARISON, LR_COMPARISON, THRESHOLD } from './config.js';
import { mixDataset, mixRows, validateMix } from './mixData.js';
import { applyEdits, validateCustomDataset } from './customData.js';
import { UserError } from './errors.js';
import { validateSettings } from './ml/trainer.js';

export const SEED_COUNT = 5;

/** Dataset som de låsta laborationerna faktiskt tränar på (måste stämma med buildPlan nedan). */
export const MODE_DATASETS = Object.freeze({
  'compare-datasets': ['a', 'b'],
  'compare-abc': ['a', 'b', 'mix'],
  'compare-epochs': ['b'],
  'compare-lr': ['b'],
  'compare-hidden': ['b'],
  improve: ['b', 'custom'],
});

/** Dataset som laborationen använder. I låsta lägen laborationens dataset, annars elevens eget val. */
export const usedDatasets = (state) => MODE_DATASETS[state.mode] ?? [state.datasetKey];

/**
 * Det dataset som visas när bara ett får plats (vokabulär, modellinformation, frö-experiment):
 * elevens val om laborationen använder det, annars laborationens första dataset.
 */
export const shownDataset = (state) => {
  const used = usedDatasets(state);
  return used.includes(state.datasetKey) ? state.datasetKey : used[0];
};

/** Träningsraderna för ett dataset. Förbättrad B visas även när den inte är giltig än. */
export const datasetRows = (key, { edits, mixIds }) => (key === 'custom' ? validateCustomDataset(edits).rows : key === 'mix' ? mixRows(mixIds) : DATASETS[key].texts);

/** Datasetets namn i löptext, t.ex. "Med Dataset B är vokabulären ...". */
export const datasetPhrase = (key) => (key === 'custom' ? 'din förbättrade version av B' : key === 'mix' ? 'ditt eget mix C' : DATASETS[key].name);

/**
 * Före/efter över flera frön (lektion 4): för varje frö tränas dataset B före och efter förbättringen.
 * Returnerar en platt lista [före(frö1), efter(frö1), före(frö2), ...].
 */
export function buildSeedImprovePlan({ settings, edits, count = SEED_COUNT }) {
  const plan = [];
  for (let i = 0; i < count; i++) {
    const seed = (settings.seed + i) % 1000000;
    const [before, after] = buildPlan({ mode: 'improve', datasetKey: 'b', settings: { ...settings, seed }, edits });
    plan.push({ ...before, label: `Före, frö ${seed}` }, { ...after, label: `Efter, frö ${seed}` });
  }
  return plan;
}

/**
 * Frö-experiment: samma dataset och samma inställningar tränas med SEED_COUNT olika slumpfrön i följd
 * (elevens frö, frö+1, ...). Det enda som skiljer är slumpfröet, så spridningen i resultat visar hur mycket
 * slumpen (startvikter och ordning på träningsdata) betyder.
 */
export function buildSeedPlan({ datasetKey, settings, edits, mixIds = [], count = SEED_COUNT }) {
  return Array.from({ length: count }, (_, i) => {
    const seed = (settings.seed + i) % 1000000;
    const [spec] = buildPlan({ mode: 'single', datasetKey, settings: { ...settings, seed }, edits, mixIds });
    return { ...spec, label: `Frö ${seed}` };
  });
}

/**
 * Bygger listan med träningar för en laboration. Alla träningar i samma laboration får
 * samma slumpfrö, samma modellarkitektur, samma inlärningstakt, samma batchstorlek och samma
 * (fasta) valideringsdata. Det enda som skiljer är det som ska jämföras.
 * Varje träning startar från ett eget nytt nätverk (se trainModel), aldrig från en tidigare körning.
 */
export function buildPlan({ mode, datasetKey, settings, edits, mixIds = [] }) {
  const base = { seed: settings.seed, learningRate: settings.learningRate, batchSize: settings.batchSize, hiddenUnits: settings.hiddenUnits, threshold: THRESHOLD };
  validateSettings({ ...base, epochs: settings.epochs });
  const spec = (label, ds, epochs, overrides = {}) => ({
    label,
    datasetKey: ds.key,
    datasetName: ds.name,
    datasetVersion: ds.version,
    texts: ds.texts,
    settings: { ...base, epochs, ...overrides },
  });
  const custom = () => {
    const check = validateCustomDataset(edits);
    if (!check.ok) {
      throw new UserError('Den förbättrade datamängden är inte giltig. Åtgärda felen i steget Byt ut texter först.', check.problems);
    }
    return { key: 'custom', name: 'Dataset B (förbättrad)', version: DATASETS.b.version, texts: applyEdits(edits) };
  };

  const mix = () => {
    const check = validateMix(mixIds);
    if (!check.ok) throw new UserError('Dataset C är inte giltigt. Välj exakt 20 spamtexter och 20 vanliga texter i steget Fördjupning (lektion 2).', check.problems);
    return mixDataset(mixIds);
  };
  const fmt = (v) => String(v).replace('.', ',');

  switch (mode) {
    case 'compare-abc':
      return [spec('Dataset A', DATASETS.a, settings.epochs), spec('Dataset B', DATASETS.b, settings.epochs), spec('Dataset C (mix)', mix(), settings.epochs)];
    case 'compare-lr':
      return LR_COMPARISON.map((lr) => spec(`Dataset B, learning rate ${fmt(lr)}`, DATASETS.b, settings.epochs, { learningRate: lr }));
    case 'compare-hidden':
      return HIDDEN_COMPARISON.map((n) => spec(`Dataset B, ${n} dolda noder`, DATASETS.b, settings.epochs, { hiddenUnits: n }));
    case 'compare-datasets':
      return [spec('Dataset A', DATASETS.a, settings.epochs), spec('Dataset B', DATASETS.b, settings.epochs)];
    case 'compare-epochs':
      return EPOCH_COMPARISON.map((e) => spec(`Dataset B, ${e} epoker`, DATASETS.b, e));
    case 'improve':
      return [spec('Dataset B före', DATASETS.b, settings.epochs), spec('Dataset B efter', custom(), settings.epochs)];
    case 'single': {
      const ds = datasetKey === 'custom' ? custom() : datasetKey === 'mix' ? mix() : DATASETS[datasetKey];
      if (!ds) throw new UserError('Välj ett dataset först.');
      return [spec(ds.name, ds, settings.epochs)];
    }
    default:
      throw new UserError('Okänd laboration.');
  }
}
