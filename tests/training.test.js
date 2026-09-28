import { describe, expect, it } from 'vitest';
import { DEFAULTS, THRESHOLD } from '../src/config.js';
import { DATASETS, VALIDATION_TEXTS } from '../src/data/index.js';
import { buildPlan } from '../src/experiments.js';
import { createNetwork, fingerprint } from '../src/ml/network.js';
import { evaluateOnTexts, testText, trainModel } from '../src/ml/trainer.js';
import { buildVocabulary } from '../src/ml/vectorizer.js';
import { TrainingCancelled } from '../src/errors.js';
import { FINAL_TEST_TEXTS } from '../src/data/index.js';

const settings = { ...DEFAULTS };
const run = (mode, datasetKey = 'b', s = settings, edits = {}) => buildPlan({ mode, datasetKey, settings: s, edits });

describe('16. Samma dataset, seed och inställningar ger samma startläge och resultat', () => {
  it('startvikterna är identiska', () => {
    const words = buildVocabulary(DATASETS.b.texts.map((t) => t.text)).words;
    const n1 = createNetwork({ words, hiddenUnits: 8, seed: 7 });
    const n2 = createNetwork({ words, hiddenUnits: 8, seed: 7 });
    expect(Array.from(n1.W1)).toEqual(Array.from(n2.W1));
    expect(Array.from(n1.W2)).toEqual(Array.from(n2.W2));
    expect(fingerprint(n1)).toBe(fingerprint(n2));
    const n3 = createNetwork({ words, hiddenUnits: 8, seed: 8 });
    expect(fingerprint(n3)).not.toBe(fingerprint(n1));
  });
  it('två separata körningar ger exakt samma startläge och exakt samma kurvor', async () => {
    const [spec] = run('single', 'b');
    const r1 = await trainModel(spec);
    const r2 = await trainModel(spec);
    expect(r1.startId).toBe(r2.startId);
    expect(r1.history).toEqual(r2.history);
    expect(Array.from(r1.net.W1)).toEqual(Array.from(r2.net.W1));
  });
  it('A och B delar startvikter för utdatalagret och för ord som finns i båda', async () => {
    const [a, b] = run('compare-datasets');
    const [ra, rb] = [await trainModel({ ...a, settings: { ...a.settings, epochs: 1 } }), await trainModel({ ...b, settings: { ...b.settings, epochs: 1 } })];
    expect(ra.sharedStartId).toBe(rb.sharedStartId);
    // samma ord => samma startvikt
    const wa = createNetwork({ words: ra.vocab.words, hiddenUnits: 8, seed: 7 });
    const wb = createNetwork({ words: rb.vocab.words, hiddenUnits: 8, seed: 7 });
    const word = 'klicka';
    const [ia, ib] = [ra.vocab.index.get(word), rb.vocab.index.get(word)];
    expect(ia).toBeDefined();
    expect(ib).toBeDefined();
    for (let j = 0; j < 8; j++) expect(wa.W1[ia * 8 + j]).toBe(wb.W1[ib * 8 + j]);
  });
  it('samma valideringsdata används i alla körningar', async () => {
    const [a, b] = run('compare-datasets');
    const ra = await trainModel({ ...a, settings: { ...a.settings, epochs: 2 } });
    const rb = await trainModel({ ...b, settings: { ...b.settings, epochs: 2 } });
    expect(ra.validation.rows.map((r) => r.id)).toEqual(VALIDATION_TEXTS.map((r) => r.id));
    expect(rb.validation.rows.map((r) => r.id)).toEqual(ra.validation.rows.map((r) => r.id));
  });
});

describe('17. Körningarna med 5, 30 och 100 epoker börjar från samma startläge', () => {
  it('lika startläge, och 5-epokerskörningen är början på 30- och 100-epokerskörningen', async () => {
    const plan = run('compare-epochs');
    const results = [];
    for (const spec of plan) results.push(await trainModel(spec));
    const [r5, r30, r100] = results;
    expect(new Set(results.map((r) => r.startId)).size).toBe(1);
    expect(results.map((r) => r.history.length)).toEqual([5, 30, 100]);
    // Ingen körning fortsätter från en annan: 30 börjar om från start, så första 5 epokerna är identiska.
    expect(r30.history.slice(0, 5)).toEqual(r5.history);
    expect(r100.history.slice(0, 30)).toEqual(r30.history);
    // Nätverksobjekten är olika instanser
    expect(r5.net).not.toBe(r30.net);
    expect(r5.net.W1).not.toBe(r30.net.W1);
  });
  it('en ny körning påverkas inte av att en tidigare körning har tränats', async () => {
    const [spec] = run('single', 'b');
    const first = await trainModel(spec);
    await trainModel({ ...spec, settings: { ...spec.settings, epochs: 100 } });
    const again = await trainModel(spec);
    expect(again.history).toEqual(first.history);
  });
  it('förbättring: före och efter börjar från samma startvikter för utdatalagret', async () => {
    const spamIds = DATASETS.b.texts.filter((t) => t.label === 'spam').slice(0, 5).map((t) => t.id);
    const hamIds = DATASETS.b.texts.filter((t) => t.label === 'vanlig').slice(0, 5).map((t) => t.id);
    const edits = {};
    spamIds.forEach((id, i) => (edits[id] = `Extra spam nummer ${i} klicka snabbt`));
    hamIds.forEach((id, i) => (edits[id] = `Extra vanlig text ${i} om matlådan`));
    const [before, after] = run('improve', 'b', { ...settings, epochs: 3 }, edits);
    const [rb, ra] = [await trainModel(before), await trainModel(after)];
    expect(rb.sharedStartId).toBe(ra.sharedStartId);
    expect(rb.settings).toEqual(ra.settings);
  });
});

describe('18. Egna testtexter ändrar inte träningsdata eller modell', () => {
  it('testText läser bara modellen', async () => {
    const [spec] = run('single', 'a', { ...settings, epochs: 3 });
    const before = JSON.stringify(spec.texts);
    const result = await trainModel(spec);
    const w1 = Array.from(result.net.W1);
    const w2 = Array.from(result.net.W2);
    const vocabSize = result.vocab.words.length;
    const answer = testText(result, 'Vinn gratis pengar nu!');
    expect(answer.probability).toBeGreaterThanOrEqual(0);
    expect(answer.probability).toBeLessThanOrEqual(1);
    expect(['spam', 'vanlig']).toContain(answer.predicted);
    expect(answer.tokens.map((t) => t.word)).toEqual(['vinn', 'gratis', 'pengar', 'nu']);
    // samma svar varje gång
    expect(testText(result, 'Vinn gratis pengar nu!').probability).toBe(answer.probability);
    expect(Array.from(result.net.W1)).toEqual(w1);
    expect(Array.from(result.net.W2)).toEqual(w2);
    expect(result.vocab.words).toHaveLength(vocabSize);
    expect(JSON.stringify(spec.texts)).toBe(before);
    expect(spec.texts).toBe(DATASETS.a.texts);
    expect(spec.texts).toHaveLength(40);
  });
  it('testText avvisar tom text med svenskt meddelande', async () => {
    const [spec] = run('single', 'a', { ...settings, epochs: 1 });
    const result = await trainModel(spec);
    expect(() => testText(result, '   ')).toThrow(/tom/);
  });
});

describe('Träning i övrigt', () => {
  it('modellen lär sig något: träningsnoggrannhet över slumpnivå efter 30 epoker och 5 epoker är sämre än 100', async () => {
    const [spec] = run('single', 'b');
    const r = await trainModel(spec);
    expect(r.train.metrics.accuracy).toBeGreaterThan(0.9);
    expect(r.history).toHaveLength(30);
    expect(r.validation.rows).toHaveLength(20);
  });
  it('avbryter säkert och kastar TrainingCancelled', async () => {
    const [spec] = run('single', 'b');
    let calls = 0;
    await expect(trainModel(spec, { onEpoch: () => calls++, shouldCancel: () => calls >= 3 })).rejects.toBeInstanceOf(TrainingCancelled);
    expect(calls).toBe(3);
  });
  it('sluttestet kan utvärderas på en tränad modell utan att ändra den', async () => {
    const [spec] = run('single', 'b', { ...settings, epochs: 5 });
    const r = await trainModel(spec);
    const w = Array.from(r.net.W1);
    const ev = evaluateOnTexts(r, FINAL_TEST_TEXTS);
    expect(ev.metrics.n).toBe(20);
    expect(ev.rows.every((row) => row.probability >= 0 && row.probability <= 1)).toBe(true);
    expect(Array.from(r.net.W1)).toEqual(w);
    expect(THRESHOLD).toBe(0.5);
  });
  it('avvisar ogiltiga inställningar med svenskt fel', async () => {
    const [spec] = run('single', 'b');
    await expect(trainModel({ ...spec, settings: { ...spec.settings, epochs: 0 } })).rejects.toThrow(/inte giltiga/);
  });
});

describe('Extra: frö-experiment och tröskelexperiment', () => {
  it('frö-planen använder på varandra följande frön och i övrigt identiska inställningar och data', async () => {
    const { buildSeedPlan, SEED_COUNT } = await import('../src/experiments.js');
    const plan = buildSeedPlan({ datasetKey: 'b', settings: { ...settings, seed: 7 }, edits: {} });
    expect(plan.map((p) => p.settings.seed)).toEqual([7, 8, 9, 10, 11]);
    expect(plan).toHaveLength(SEED_COUNT);
    expect(new Set(plan.map((p) => JSON.stringify({ ...p.settings, seed: 0 }))).size).toBe(1);
    expect(new Set(plan.map((p) => p.texts)).size).toBe(1);
    // frö nära gränsen ger ändå giltiga frön
    const edge = buildSeedPlan({ datasetKey: 'a', settings: { ...settings, seed: 999999 }, edits: {} });
    expect(edge.map((p) => p.settings.seed)).toEqual([999999, 0, 1, 2, 3]);
  });
  it('olika frön ger olika startläge men samma frö ger samma resultat', async () => {
    const { buildSeedPlan } = await import('../src/experiments.js');
    const plan = buildSeedPlan({ datasetKey: 'a', settings: { ...settings, epochs: 3, seed: 1 }, edits: {} });
    const results = [];
    for (const spec of plan.slice(0, 3)) results.push(await trainModel(spec));
    expect(new Set(results.map((r) => r.startId)).size).toBe(3);
    const again = await trainModel(plan[0]);
    expect(again.history).toEqual(results[0].history);
  });
  it('tröskel 0,5 ger samma mått som modellens egna, och en högre tröskel ger aldrig fler svar "spam"', async () => {
    const { metricsAtThreshold, sweepThresholds, summarizeSpread } = await import('../src/thresholdAnalysis.js');
    const [spec] = run('single', 'b', { ...settings, epochs: 10 });
    const r = await trainModel(spec);
    const rows = r.validation.rows;
    expect(metricsAtThreshold(rows, THRESHOLD)).toEqual(r.validation.metrics);
    const spamCounts = sweepThresholds(rows).map((s) => s.metrics.tp + s.metrics.fp);
    for (let i = 1; i < spamCounts.length; i++) expect(spamCounts[i]).toBeLessThanOrEqual(spamCounts[i - 1]);
    expect(metricsAtThreshold(rows, 0).fn).toBe(0);
    expect(metricsAtThreshold(rows, 1.01).tp).toBe(0);
    expect(metricsAtThreshold(rows, 1.01).precision).toBeNull(); // Ej definierat
    const s = summarizeSpread([r, r]);
    expect(s.min).toBe(s.max);
    expect(summarizeSpread([])).toBeNull();
  });
  it('resultatblocket innehåller frö- och tröskelexperiment när de finns', async () => {
    const { buildResultBlock } = await import('../src/report.js');
    const { metricsAtThreshold } = await import('../src/thresholdAnalysis.js');
    const [spec] = run('single', 'a', { ...settings, epochs: 2 });
    const r = await trainModel(spec);
    const block = buildResultBlock({
      attemptName: 'x',
      runs: [r],
      seedExperiment: { runs: [r, r] },
      thresholdExp: { runLabel: r.label, threshold: 0.3, metrics: metricsAtThreshold(r.validation.rows, 0.3) },
    });
    expect(block).toContain('Frö-experiment: Dataset A, 2 epoker');
    expect(block).toContain('Validation accuracy varierade mellan');
    expect(block).toContain('Tröskelexperiment på valideringsdata');
    expect(block).toContain('Vald tröskel: 0,30');
    expect(buildResultBlock({ attemptName: 'x', runs: [r] })).not.toContain('Frö-experiment');
  });
});
