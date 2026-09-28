import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../src/config.js';
import { DATASETS } from '../src/data/index.js';
import { appendHistory, HISTORY_LIMIT, historyEntry } from '../src/history.js';
import { allowedDatasets, guideProgress, guideSteps, isVisibleIn, LESSON_MODES, lessonOfMode, modeForLesson } from '../src/lessons.js';
import { buildPlan } from '../src/experiments.js';
import { buildResultBlock } from '../src/report.js';
import { initialState } from '../src/state.js';
import { trainModel } from '../src/ml/trainer.js';

const quick = { ...DEFAULTS, epochs: 2 };
const train = async (mode = 'single', key = 'a') => {
  const out = [];
  for (const spec of buildPlan({ mode, datasetKey: key, settings: quick, edits: {} })) out.push(await trainModel(spec));
  return out;
};

describe('Lektioner och laborationer', () => {
  it('varje laboration hör till exakt en lektion och byte av lektion väljer rätt läge', () => {
    const seen = Object.values(LESSON_MODES).flat();
    expect(new Set(seen).size).toBe(seen.length);
    expect(lessonOfMode('compare-lr')).toBe(3);
    expect(lessonOfMode('improve')).toBe(4);
    expect(modeForLesson(2, 'single')).toBe('compare-datasets');
    expect(modeForLesson(3, 'compare-hidden')).toBe('compare-hidden'); // behåller utökat läge inom lektionen
    expect(modeForLesson(5, 'improve')).toBe('improve'); // lektion 5 har inga träningslägen
  });
  it('dataset-kort visas per lektion', () => {
    expect(allowedDatasets(1)).toEqual(['a', 'b']);
    expect(allowedDatasets(2)).toContain('mix');
    expect(allowedDatasets(2)).not.toContain('custom');
    expect(allowedDatasets(4)).toContain('custom');
    expect(allowedDatasets('all')).toHaveLength(4);
  });
  it('avsnitt visas bara i rätt lektion, och "all" visar allt', () => {
    expect(isVisibleIn('4', 4)).toBe(true);
    expect(isVisibleIn('4', 1)).toBe(false);
    expect(isVisibleIn('1 2 3 4', 3)).toBe(true);
    expect(isVisibleIn('4', 'all')).toBe(true);
  });
});

describe('Lektionsguide', () => {
  it('bockar av automatiska steg utifrån vad eleven gjort (lektion 1)', async () => {
    const s = initialState();
    expect(guideSteps(1, s).filter((x) => x.done)).toHaveLength(0);
    const runs = await train();
    const trained = { ...s, runs, runsMode: 'single' };
    const step = (st, id) => guideSteps(1, st).find((x) => x.id === id);
    expect(step(trained, 'l1-train').done).toBe(true);
    expect(step(trained, 'l1-test').done).toBe(false);
    expect(step(trained, 'l1-test').text).toContain('0 av 4');
    const log = ['a', 'b', 'c', 'd'].map((t) => ({ text: `Text ${t}`, runLabel: 'x', probability: 0.5, predicted: 'spam' }));
    expect(step({ ...trained, testLog: log.slice(0, 3) }, 'l1-test').done).toBe(false);
    expect(step({ ...trained, testLog: log }, 'l1-test').done).toBe(true);
    // samma text flera gånger räknas som en
    expect(step({ ...trained, testLog: Array(6).fill(log[0]) }, 'l1-test').done).toBe(false);
    // kopiering kräver både resultatblock och återställningstext, och att det finns körningar
    expect(step({ ...trained, copied: { result: true, recovery: false, analysis: false } }, 'l1-copy').done).toBe(false);
    expect(step({ ...trained, copied: { result: true, recovery: true, analysis: false } }, 'l1-copy').done).toBe(true);
    expect(step({ ...s, copied: { result: true, recovery: true, analysis: false } }, 'l1-copy').done).toBe(false);
  });
  it('manuella steg bockas bara av eleven', () => {
    const s = initialState();
    expect(guideSteps(1, s).find((x) => x.id === 'l1-look')).toMatchObject({ kind: 'manual', done: false });
    expect(guideSteps(1, { ...s, manualDone: { 'l1-look': true } }).find((x) => x.id === 'l1-look').done).toBe(true);
  });
  it('lektion 2–5 har steg som följer rätt laborationstyp', async () => {
    const s = initialState();
    const compare = { ...s, runs: await train('compare-datasets'), runsMode: 'compare-datasets' };
    expect(guideSteps(2, compare)[0].done).toBe(true);
    expect(guideSteps(3, compare)[0].done).toBe(false);
    const epochs = { ...s, runs: await train('compare-epochs', 'b'), runsMode: 'compare-epochs' };
    expect(guideSteps(3, epochs)[0].done).toBe(true);
    // lektion 4: data giltig först när exakt fem texter per klass bytts
    expect(guideSteps(4, s)[0].done).toBe(false);
    const B = DATASETS.b.texts;
    const edits = {};
    B.filter((r) => r.label === 'spam').slice(0, 5).forEach((r, i) => (edits[r.id] = `Ny spam ${i}: klicka nu för bonus`));
    B.filter((r) => r.label === 'vanlig').slice(0, 5).forEach((r, i) => (edits[r.id] = `Ny vanlig ${i}: vi ses vid bussen`));
    expect(guideSteps(4, { ...s, edits })[0].done).toBe(true);
    expect(guideSteps(4, { ...s, finalTestRuns: 1 }).find((x) => x.id === 'l4-final').done).toBe(true);
    expect(guideSteps(5, { ...s, copied: { result: false, recovery: false, analysis: true } })[0].done).toBe(true);
    expect(guideSteps('all', s)).toEqual([]);
  });
  it('progress räknar klara steg', () => {
    expect(guideProgress(guideSteps(1, { ...initialState(), manualDone: { 'l1-look': true } }))).toEqual({ done: 1, total: 4 });
  });
});

describe('Körningshistorik', () => {
  it('sammanfattar körningar, numrerar vidare och begränsar längden', async () => {
    const [a, b] = await train('compare-datasets');
    const h1 = appendHistory([], [a], new Date(2026, 8, 21, 9, 5));
    expect(h1[0]).toMatchObject({ nr: 1, time: '09:05', label: 'Dataset A', epochs: 2, seed: DEFAULTS.seed });
    expect(h1[0].valAccuracy).toBe(a.validation.metrics.accuracy);
    const h2 = appendHistory(h1, [b]);
    expect(h2.map((h) => h.nr)).toEqual([1, 2]);
    let many = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) many = appendHistory(many, [a]);
    expect(many).toHaveLength(HISTORY_LIMIT);
    expect(many.at(-1).nr).toBe(HISTORY_LIMIT + 5);
    expect(historyEntry(a, 9).nr).toBe(9);
  });
  it('tas med i resultatblocket först när det finns fler än en körning', async () => {
    const [a, b] = await train('compare-datasets');
    const one = buildResultBlock({ attemptName: 'x', runs: [a], history: appendHistory([], [a]) });
    expect(one).not.toContain('Körningshistorik');
    const two = buildResultBlock({ attemptName: 'x', runs: [b], history: appendHistory(appendHistory([], [a]), [b]) });
    expect(two).toContain('Körningshistorik');
    expect(two).toContain('| Dataset A |');
    expect(two).toContain('| Dataset B |');
  });
});
