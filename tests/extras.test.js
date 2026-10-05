import { describe, expect, it } from 'vitest';
import { DEFAULTS, HIDDEN_COMPARISON, LR_COMPARISON } from '../src/config.js';
import { DATASETS } from '../src/data/index.js';
import { buildPlan, buildSeedImprovePlan, datasetPhrase, MODE_DATASETS, shownDataset, usedDatasets } from '../src/experiments.js';
import { MIX_POOL, mixCounts, mixRows, normalizeMixIds, validateMix } from '../src/mixData.js';
import { analyzeErrors, bestEpochIndex, topInfluentialWords, wordInfluence } from '../src/analysis.js';
import { trainModel } from '../src/ml/trainer.js';
import { buildResultBlock, formatDiff, summarizeImprovement } from '../src/report.js';
import { buildAnalysisTemplate, peerReviewText, PEER_REVIEW_CHECKLIST } from '../src/analysisTemplate.js';
import { buildRecoveryText, parseRecoveryText } from '../src/recovery.js';
import { UserError } from '../src/errors.js';
import { normalizeText } from '../src/ml/tokenizer.js';
import { FINAL_TEST_TEXTS, VALIDATION_TEXTS } from '../src/data/index.js';

const settings = { ...DEFAULTS, epochs: 12 };
const ids = (label, source, n) => MIX_POOL.filter((r) => r.label === label && r.source === source).slice(0, n).map((r) => r.id);
const goodMix = () => [...ids('spam', 'dataset-a', 10), ...ids('spam', 'dataset-b', 10), ...ids('vanlig', 'dataset-a', 10), ...ids('vanlig', 'dataset-b', 10)];
const mixSettings = { ...settings };

describe('Dataset C (eget mix)', () => {
  it('poolen är A + B och innehåller aldrig validering eller sluttest', () => {
    expect(MIX_POOL).toHaveLength(80);
    const held = new Set([...VALIDATION_TEXTS, ...FINAL_TEST_TEXTS].map((r) => normalizeText(r.text)));
    expect(MIX_POOL.some((r) => held.has(normalizeText(r.text)))).toBe(false);
  });
  it('godkänner exakt 20 + 20 och avvisar övrigt med svenska meddelanden', () => {
    expect(validateMix(goodMix()).ok).toBe(true);
    expect(mixCounts(goodMix())).toEqual({ spam: 20, vanlig: 20 });
    const few = validateMix(goodMix().slice(1));
    expect(few.ok).toBe(false);
    expect(few.problems.join(' ')).toMatch(/För få/);
    const many = validateMix([...goodMix(), ...ids('spam', 'dataset-a', 11)]);
    expect(many.problems.join(' ')).toMatch(/För många/);
    expect(validateMix([]).problems[0]).toMatch(/inte valt/);
    expect(validateMix(['finns-inte']).problems.join(' ')).toMatch(/Okända/);
  });
  it('ordningen på valet spelar ingen roll: raderna följer poolens ordning', () => {
    const a = goodMix();
    const b = [...a].reverse();
    expect(mixRows(b).map((r) => r.id)).toEqual(mixRows(a).map((r) => r.id));
    expect(normalizeMixIds([...a, ...a])).toHaveLength(40);
  });
  it('kan tränas, i single och i jämförelsen A/B/C, och nekas när valet är ogiltigt', async () => {
    const [c] = buildPlan({ mode: 'single', datasetKey: 'mix', settings: mixSettings, edits: {}, mixIds: goodMix() });
    expect(c.datasetName).toMatch(/Dataset C/);
    expect((await trainModel({ ...c, settings: { ...c.settings, epochs: 2 } })).counts).toEqual({ spam: 20, vanlig: 20 });
    const abc = buildPlan({ mode: 'compare-abc', datasetKey: 'a', settings: mixSettings, edits: {}, mixIds: goodMix() });
    expect(abc.map((p) => p.datasetKey)).toEqual(['a', 'b', 'mix']);
    expect(() => buildPlan({ mode: 'compare-abc', datasetKey: 'a', settings: mixSettings, edits: {}, mixIds: [] })).toThrow(UserError);
    expect(() => buildPlan({ mode: 'single', datasetKey: 'mix', settings: mixSettings, edits: {}, mixIds: goodMix().slice(2) })).toThrow(/Dataset C/);
  });
  it('sparas och läses in via återställningstexten', () => {
    const text = buildRecoveryText({ attemptName: 'mix', mode: 'single', datasetKey: 'mix', settings: mixSettings, edits: {}, mixIds: goodMix() });
    const data = JSON.parse(text);
    expect(data.dataset.key).toBe('mix');
    expect(data.trainingTexts).toHaveLength(40);
    const res = parseRecoveryText(text);
    expect(res.ok).toBe(true);
    expect(res.state.mixIds).toEqual(normalizeMixIds(goodMix()));
    // manipulerat val avvisas
    const bad = { ...data, mixIds: data.mixIds.slice(1) };
    expect(parseRecoveryText(JSON.stringify(bad)).ok).toBe(false);
    expect(parseRecoveryText(JSON.stringify({ ...data, mixIds: ['x'] })).ok).toBe(false);
  });
});

describe('Utökade laborationer (learning rate och dolda noder)', () => {
  it('lr-jämförelsen ändrar bara learning rate och delar startläge', async () => {
    const plan = buildPlan({ mode: 'compare-lr', datasetKey: 'b', settings, edits: {} });
    expect(plan.map((p) => p.settings.learningRate)).toEqual([...LR_COMPARISON]);
    expect(new Set(plan.map((p) => JSON.stringify({ ...p.settings, learningRate: 0 }))).size).toBe(1);
    const r = [];
    for (const spec of plan) r.push(await trainModel({ ...spec, settings: { ...spec.settings, epochs: 2 } }));
    expect(new Set(r.map((x) => x.startId)).size).toBe(1);
  });
  it('hidden-jämförelsen ändrar bara antal dolda noder', async () => {
    const plan = buildPlan({ mode: 'compare-hidden', datasetKey: 'b', settings, edits: {} });
    expect(plan.map((p) => p.settings.hiddenUnits)).toEqual([...HIDDEN_COMPARISON]);
    expect(new Set(plan.map((p) => JSON.stringify({ ...p.settings, hiddenUnits: 0 }))).size).toBe(1);
    expect((await trainModel({ ...plan[0], settings: { ...plan[0].settings, epochs: 1 } })).settings.hiddenUnits).toBe(2);
  });
});

describe('Ordvikter', () => {
  it('ger en effekt per ord, sorterade listor och rätt tecken', async () => {
    const [spec] = buildPlan({ mode: 'single', datasetKey: 'a', settings: { ...settings, epochs: 30 }, edits: {} });
    const run = await trainModel(spec);
    const all = wordInfluence(run);
    expect(all).toHaveLength(run.vocab.words.length);
    const top = topInfluentialWords(run, 5);
    expect(top.spam).toHaveLength(5);
    expect(top.spam.every((w) => w.effect > 0)).toBe(true);
    expect(top.ham.every((w) => w.effect < 0)).toBe(true);
    for (let i = 1; i < top.spam.length; i++) expect(top.spam[i - 1].effect).toBeGreaterThanOrEqual(top.spam[i].effect);
    for (let i = 1; i < top.ham.length; i++) expect(top.ham[i - 1].effect).toBeLessThanOrEqual(top.ham[i].effect);
    // "klicka" finns bara i spam i dataset A
    const klicka = all.find((w) => w.word === 'klicka');
    expect(klicka.effect).toBeGreaterThan(0);
    expect(klicka.hamCount).toBe(0);
    expect(klicka.spamCount).toBeGreaterThan(5);
    // beräkningen ändrar inte modellen
    const w1 = Array.from(run.net.W1);
    wordInfluence(run);
    expect(Array.from(run.net.W1)).toEqual(w1);
  });
});

describe('Felanalys och bästa epok', () => {
  it('felanalysen listar bara felklassificerade texter och markerar okända ord', async () => {
    const [spec] = buildPlan({ mode: 'single', datasetKey: 'a', settings: { ...settings, epochs: 30 }, edits: {} });
    const run = await trainModel(spec);
    const res = analyzeErrors(run);
    expect(res.items).toHaveLength(run.validation.metrics.fp + run.validation.metrics.fn);
    for (const it of res.items) {
      expect(it.row.label).not.toBe(it.row.predicted);
      for (const w of it.words) expect(w.known).toBe(run.vocab.index.has(w.word));
    }
    for (const w of res.unknownWords) expect(run.vocab.index.has(w)).toBe(false);
  });
  it('bestEpochIndex väljer första epoken med högst validation accuracy', () => {
    expect(bestEpochIndex([{ valAccuracy: 0.5 }, { valAccuracy: 0.8 }, { valAccuracy: 0.8 }, { valAccuracy: 0.7 }])).toBe(1);
    expect(bestEpochIndex([{ valAccuracy: null }, { valAccuracy: 0.1 }])).toBe(1);
  });
});

describe('Före/efter över flera frön', () => {
  const B = DATASETS.b.texts;
  const edits = {};
  B.filter((r) => r.label === 'spam').slice(0, 5).forEach((r, i) => (edits[r.id] = `Extra spam nummer ${i}: klicka nu och vinn bonus`));
  B.filter((r) => r.label === 'vanlig').slice(0, 5).forEach((r, i) => (edits[r.id] = `Vanlig text ${i}: vi ses vid bussen imorgon`));
  it('planen har före och efter för varje frö, med lika inställningar inom varje par', () => {
    const plan = buildSeedImprovePlan({ settings, edits });
    expect(plan).toHaveLength(10);
    for (let i = 0; i < 10; i += 2) {
      expect(plan[i].settings).toEqual(plan[i + 1].settings);
      expect(plan[i].datasetKey).toBe('b');
      expect(plan[i + 1].datasetKey).toBe('custom');
    }
    expect(plan.filter((_, i) => i % 2 === 0).map((p) => p.settings.seed)).toEqual([7, 8, 9, 10, 11]);
    expect(() => buildSeedImprovePlan({ settings, edits: {} })).toThrow(UserError);
  });
  it('sammanfattar och skriver ut i resultatblocket', async () => {
    const [b, a] = buildPlan({ mode: 'improve', datasetKey: 'b', settings: { ...settings, epochs: 3 }, edits });
    const [rb, ra] = [await trainModel(b), await trainModel(a)];
    const pairs = [{ before: rb, after: ra }, { before: ra, after: rb }];
    const s = summarizeImprovement(pairs);
    expect(s.better + s.same + s.worse).toBe(2);
    expect(formatDiff(0.8, 0.75)).toBe('+5,0');
    expect(formatDiff(0.5, 0.75)).toBe('-25,0');
    expect(formatDiff(null, 0.5)).toBe('Ej definierat');
    const block = buildResultBlock({ attemptName: 'x', runs: [], seedImprove: { pairs } });
    expect(block).toContain('Före/efter över flera frön');
    expect(block).toMatch(/Efter var bättre i \d av 2 frön/);
  });
});

describe('Analysmall och granskningschecklista', () => {
  it('fyller i elevens siffror och lämnar tolkningarna tomma', async () => {
    const [spec] = buildPlan({ mode: 'single', datasetKey: 'a', settings: { ...settings, epochs: 3 }, edits: {} });
    const run = await trainModel(spec);
    const t = buildAnalysisTemplate({ attemptName: 'Analys 1', now: new Date('2026-09-20T10:00:00Z'), runs: [run] });
    for (const h of ['1. Frågeställning och hypotes', '2. Metod', '3. Resultat', '4. Förklaring', '5. Osäkerhet och begränsningar', '6. Slutsats', '7. Förbättringsförslag', 'Försöksnamn: Analys 1']) expect(t).toContain(h);
    expect(t).toContain(`slumpfrö ${run.settings.seed}`);
    expect(t).toContain(`${run.validation.metrics.fp} | ${run.validation.metrics.fn}`);
    expect(t).not.toMatch(/undefined|NaN/);
  });
  it('fungerar utan körningar', () => {
    expect(buildAnalysisTemplate({ attemptName: '', runs: [] })).toContain('Inga körningar finns');
  });
  it('checklistan har numrerade frågor', () => {
    const t = peerReviewText();
    expect(t).toContain(`${PEER_REVIEW_CHECKLIST.length}. `);
    expect(t).toContain('Svar/kommentar:');
  });
});

describe('Dataset som visas i låsta laborationer', () => {
  const B = DATASETS.b.texts;
  const edits = {};
  B.filter((r) => r.label === 'spam').slice(0, 5).forEach((r, i) => (edits[r.id] = `Extra spam nummer ${i}: klicka nu och vinn bonus`));
  B.filter((r) => r.label === 'vanlig').slice(0, 5).forEach((r, i) => (edits[r.id] = `Vanlig text ${i}: vi ses vid bussen imorgon`));
  it('MODE_DATASETS stämmer med de dataset buildPlan faktiskt tränar på', () => {
    for (const [mode, keys] of Object.entries(MODE_DATASETS)) {
      const plan = buildPlan({ mode, datasetKey: 'a', settings, edits, mixIds: goodMix() });
      expect([...new Set(plan.map((p) => p.datasetKey))].sort(), mode).toEqual([...keys].sort());
    }
  });
  it('visar elevens val i En träning och laborationens dataset annars', () => {
    expect(usedDatasets({ mode: 'single', datasetKey: 'mix' })).toEqual(['mix']);
    expect(shownDataset({ mode: 'compare-epochs', datasetKey: 'a' })).toBe('b');
    expect(shownDataset({ mode: 'compare-datasets', datasetKey: 'a' })).toBe('a');
    expect(shownDataset({ mode: 'improve', datasetKey: 'a' })).toBe('b');
    expect(datasetPhrase('mix')).toBe('ditt eget mix C');
  });
});
