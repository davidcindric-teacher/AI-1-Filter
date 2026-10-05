import { describe, expect, it } from 'vitest';
import { APP_VERSION, DEFAULTS, RECOVERY_FORMAT, RECOVERY_FORMAT_VERSION } from '../src/config.js';
import { DATASETS } from '../src/data/index.js';
import { applyEdits } from '../src/customData.js';
import { buildPlan } from '../src/experiments.js';
import { trainModel } from '../src/ml/trainer.js';
import { buildResultBlock, sampleEpochs } from '../src/report.js';
import { buildRecoveryText, parseRecoveryText } from '../src/recovery.js';
import { recoveryFromState } from '../src/ui/save.js';
import { initialState } from '../src/state.js';

const settings = { ...DEFAULTS, epochs: 6 };
const NOW = new Date('2026-09-20T10:15:30Z');

async function sampleRun() {
  const [spec] = buildPlan({ mode: 'single', datasetKey: 'a', settings, edits: {} });
  return trainModel(spec);
}
const B = DATASETS.b.texts;
const goodEdits = () => {
  const e = {};
  B.filter((r) => r.label === 'spam').slice(0, 5).forEach((r, i) => (e[r.id] = `Påhittad ny spamtext ${i} med snabb vinst`));
  B.filter((r) => r.label === 'vanlig').slice(0, 5).forEach((r, i) => (e[r.id] = `Påhittad ny vanlig text ${i} om fritids`));
  return e;
};

describe('9. Export av resultatblock', () => {
  it('innehåller alla obligatoriska uppgifter som vanlig text', async () => {
    const run = await sampleRun();
    const block = buildResultBlock({
      attemptName: 'Försök 1',
      now: NOW,
      runs: [run],
      testLog: [{ runLabel: run.label, text: 'Hej på dig', probability: 0.12, predicted: 'vanlig' }],
    });
    for (const needle of [
      'Försöksnamn: Försök 1',
      'Datum och tid:',
      `Appversion: ${APP_VERSION}`,
      'Dataset A (datasetversion 1)',
      '20 spam och 20 vanliga',
      'Valideringsdata: 20 fasta texter',
      `Slumpfrö: ${settings.seed}`,
      'Antal epoker: 6',
      'Modellarkitektur:',
      'Learning rate: 0,100',
      'Batchstorlek: 4',
      'Accuracy:',
      'Precision (spam):',
      'Recall (spam):',
      'F1 (spam):',
      'Förväxlingsmatris',
      'sant positiva',
      'falskt positiva',
      'Antal fel: falskt positiva =',
      'Felklassificerade texter i valideringsdata',
      'Kurvvärden',
      'Egna testtexter',
      '"Hej på dig"',
    ]) {
      expect(block).toContain(needle);
    }
    expect(block).not.toMatch(/undefined|NaN|\[object/);
  });
  it('siffrorna kommer från körningen (inga hårdkodade resultat)', async () => {
    const run = await sampleRun();
    const block = buildResultBlock({ attemptName: 'x', now: NOW, runs: [run] });
    const m = run.validation.metrics;
    expect(block).toContain(`sant positiva) | modellen sa vanligt: ${m.fn}`);
    expect(block).toContain(`falskt positiva = ${m.fp}, falskt negativa = ${m.fn}`);
  });
  it('visar Ej definierat när mått saknas', async () => {
    const run = await sampleRun();
    const fake = { ...run, validation: { ...run.validation, metrics: { ...run.validation.metrics, precision: null, tp: 0, fp: 0 } } };
    expect(buildResultBlock({ attemptName: 'x', now: NOW, runs: [fake] })).toContain('Precision (spam): Ej definierat');
  });
  it('sampleEpochs ger ett begripligt urval som alltid innehåller sista epoken', () => {
    expect(sampleEpochs(5)).toEqual([1, 2, 3, 5]);
    expect(sampleEpochs(30).at(-1)).toBe(30);
    expect(sampleEpochs(7)).toEqual([1, 2, 3, 5, 7]);
  });
});

describe('10. Export av återställningstext', () => {
  it('är läsbar JSON med träningstexter, inställningar, version och datum', async () => {
    const run = await sampleRun();
    const text = buildRecoveryText({ attemptName: 'Försök 1', now: NOW, mode: 'single', datasetKey: 'a', settings, edits: {}, results: [run] });
    const data = JSON.parse(text);
    expect(data.format).toBe(RECOVERY_FORMAT);
    expect(data.formatVersion).toBe(RECOVERY_FORMAT_VERSION);
    expect(data.appVersion).toBe(APP_VERSION);
    expect(data.createdAt).toBe('2026-09-20T10:15:30.000Z');
    expect(data.dataset.name).toBe('Dataset A');
    expect(data.settings).toMatchObject({ seed: settings.seed, epochs: 6, learningRate: 0.1, batchSize: 4, hiddenUnits: 8 });
    expect(data.trainingTexts).toHaveLength(40);
    expect(data.trainingTexts[0]).toEqual({ id: 'a-spam-01', text: DATASETS.a.texts[0].text, label: 'spam' });
    expect(text).toContain('\n'); // radbruten, läsbar
  });
});

describe('11. Import av återställningstext', () => {
  it('rundresa för dataset A och B', () => {
    for (const key of ['a', 'b']) {
      const text = buildRecoveryText({ attemptName: 'Ett namn', now: NOW, mode: 'compare-epochs', datasetKey: key, settings: { ...settings, seed: 42, epochs: 100 }, edits: {} });
      const res = parseRecoveryText(text);
      expect(res.ok).toBe(true);
      expect(res.state).toMatchObject({ datasetKey: key, mode: 'compare-epochs', attemptName: 'Ett namn', settings: { seed: 42, epochs: 100 } });
    }
  });
  it('rundresa för förbättrad data med egna texter', () => {
    const edits = goodEdits();
    const text = buildRecoveryText({ attemptName: 'Bättre', now: NOW, mode: 'improve', datasetKey: 'custom', settings, edits });
    const res = parseRecoveryText(text);
    expect(res.ok).toBe(true);
    expect(res.state.edits).toEqual(edits);
    expect(JSON.parse(text).trainingTexts.map((t) => t.text)).toEqual(applyEdits(edits).map((t) => t.text));
  });
  it('sparar laborationens dataset i låsta lägen, inte ett dolt tidigare val', () => {
    const saved = (patch) => JSON.parse(recoveryFromState({ ...initialState(), datasetKey: 'a', ...patch }, NOW)).dataset.key;
    expect(saved({ mode: 'single' })).toBe('a');
    expect(saved({ mode: 'compare-epochs' })).toBe('b');
    expect(saved({ mode: 'improve' })).toBe('b');
    expect(saved({ mode: 'compare-datasets' })).toBe('a');
    const res = parseRecoveryText(recoveryFromState({ ...initialState(), mode: 'compare-epochs', datasetKey: 'a' }, NOW));
    expect(res.ok).toBe(true);
    expect(res.state.datasetKey).toBe('b');
  });
  it('återställd data ger exakt samma träningsresultat', async () => {
    const edits = goodEdits();
    const before = buildPlan({ mode: 'single', datasetKey: 'custom', settings, edits })[0];
    const r1 = await trainModel(before);
    const res = parseRecoveryText(buildRecoveryText({ attemptName: '', now: NOW, mode: 'single', datasetKey: 'custom', settings, edits }));
    const after = buildPlan({ mode: 'single', datasetKey: res.state.datasetKey, settings: res.state.settings, edits: res.state.edits })[0];
    const r2 = await trainModel(after);
    expect(r2.history).toEqual(r1.history);
  });
});

describe('12. Avvisning av ogiltig återställningstext', () => {
  const valid = () => JSON.parse(buildRecoveryText({ attemptName: '', now: NOW, mode: 'single', datasetKey: 'b', settings, edits: {} }));
  const errs = (obj) => parseRecoveryText(typeof obj === 'string' ? obj : JSON.stringify(obj));

  it('avvisar tom text och text som inte är JSON', () => {
    expect(errs('').ok).toBe(false);
    expect(errs('   ').errors[0]).toMatch(/tom/);
    expect(errs('hej hopp').errors[0]).toMatch(/kunde inte läsas/);
    expect(errs('{"a":').ok).toBe(false);
  });
  it('avvisar JSON som inte är en återställning', () => {
    expect(errs('[]').ok).toBe(false);
    expect(errs('{"foo": 1}').errors[0]).toMatch(/inte en återställningstext/);
  });
  it('avvisar för ny formatversion', () => {
    expect(errs({ ...valid(), formatVersion: 99 }).errors[0]).toMatch(/formatversion 99/);
  });
  it('avvisar ogiltiga inställningar', () => {
    const d = valid();
    d.settings.epochs = -3;
    d.settings.seed = 1.5;
    delete d.settings.batchSize;
    const r = errs(d);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
  it('avvisar okänt dataset, okänd laboration och okända ändringar', () => {
    const d = valid();
    d.dataset.key = 'z';
    d.mode = 'nope';
    d.edits = { 'okant-id': 'text' };
    expect(errs(d).errors.length).toBeGreaterThanOrEqual(3);
  });
  it('avvisar text där träningstexter är manipulerade eller saknar klass', () => {
    const d = valid();
    d.trainingTexts[0].text = 'Något annat';
    expect(errs(d).errors.join(' ')).toMatch(/stämmer inte/);
    const d2 = valid();
    d2.trainingTexts[3].label = 'okänd';
    expect(errs(d2).errors.join(' ')).toMatch(/saknar giltig klass/);
    const d3 = valid();
    d3.trainingTexts[4].text = '  ';
    expect(errs(d3).ok).toBe(false);
    const d4 = valid();
    delete d4.trainingTexts;
    expect(errs(d4).ok).toBe(false);
  });
  it('avvisar förbättrad data som bryter mot reglerna (t.ex. sluttestets text eller fel antal ändringar)', () => {
    const edits = goodEdits();
    const txt = buildRecoveryText({ attemptName: '', now: NOW, mode: 'improve', datasetKey: 'custom', settings, edits });
    const d = JSON.parse(txt);
    // en ändring för lite → exakt fem-kravet bryts, texterna hålls konsekventa
    const firstId = Object.keys(d.edits)[0];
    delete d.edits[firstId];
    d.trainingTexts = applyEdits(d.edits).map(({ id, text, label }) => ({ id, text, label }));
    expect(errs(d).errors.join(' ')).toMatch(/exakt 5 texter/);
  });
});
