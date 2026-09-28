import { describe, expect, it } from 'vitest';
import { DATASETS, FINAL_TEST_TEXTS, VALIDATION_TEXTS } from '../src/data/index.js';
import { assertValidTrainingData, countPerClass, findTrainingProblems } from '../src/dataChecks.js';
import { applyEdits, validateCustomDataset } from '../src/customData.js';
import { buildPlan } from '../src/experiments.js';
import { normalizeText } from '../src/ml/tokenizer.js';
import { DEFAULTS } from '../src/config.js';
import { UserError } from '../src/errors.js';

const settings = { ...DEFAULTS };
const B = DATASETS.b.texts;
const spamIds = B.filter((r) => r.label === 'spam').map((r) => r.id);
const hamIds = B.filter((r) => r.label === 'vanlig').map((r) => r.id);
const validEdits = () => {
  const e = {};
  spamIds.slice(0, 5).forEach((id, i) => (e[id] = `Ny påhittad spamtext nummer ${i} med extra erbjudande`));
  hamIds.slice(0, 5).forEach((id, i) => (e[id] = `Ny påhittad vanlig text nummer ${i} om skolan`));
  return e;
};

describe('Datamängdernas struktur', () => {
  it('har rätt storlekar, fält och källor', () => {
    for (const [rows, source, spam, ham] of [
      [DATASETS.a.texts, 'dataset-a', 20, 20],
      [DATASETS.b.texts, 'dataset-b', 20, 20],
      [VALIDATION_TEXTS, 'validation', 10, 10],
      [FINAL_TEST_TEXTS, 'final-test', 10, 10],
    ]) {
      const c = countPerClass(rows);
      expect([c.spam, c.vanlig, c.other]).toEqual([spam, ham, 0]);
      for (const r of rows) {
        expect(r.id && r.text && r.label).toBeTruthy();
        expect(r.source).toBe(source);
      }
    }
  });
  it('validering, sluttest och träningsdata är helt separata och saknar dubbletter', () => {
    const all = [...DATASETS.a.texts, ...DATASETS.b.texts, ...VALIDATION_TEXTS, ...FINAL_TEST_TEXTS];
    expect(new Set(all.map((r) => normalizeText(r.text))).size).toBe(all.length);
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
  });
  it('datamängderna är skrivskyddade', () => {
    expect(Object.isFrozen(FINAL_TEST_TEXTS)).toBe(true);
    expect(Object.isFrozen(FINAL_TEST_TEXTS[0])).toBe(true);
    expect(Object.isFrozen(VALIDATION_TEXTS)).toBe(true);
    expect(() => {
      'use strict';
      FINAL_TEST_TEXTS[0].text = 'ändrad';
    }).toThrow();
  });
});

describe('13. Exakt 20 texter per klass', () => {
  it('godkänner dataset A och B', () => {
    expect(findTrainingProblems(DATASETS.a.texts)).toEqual([]);
    expect(findTrainingProblems(DATASETS.b.texts)).toEqual([]);
  });
  it('avvisar för få och för många', () => {
    expect(findTrainingProblems(B.slice(1)).map((p) => p.code)).toContain('too-few');
    const extra = { id: 'x', text: 'En helt ny extra text om bussen', label: 'vanlig', source: 'custom' };
    expect(findTrainingProblems([...B, extra]).map((p) => p.code)).toContain('too-many');
  });
  it('avvisar tomma texter, dubbletter och texter utan klass', () => {
    const rows = B.map((r) => ({ ...r }));
    rows[0] = { ...rows[0], text: '   ' };
    rows[1] = { ...rows[1], text: rows[2].text.toUpperCase() + '!!' };
    rows[3] = { ...rows[3], label: undefined };
    const codes = findTrainingProblems(rows).map((p) => p.code);
    expect(codes).toEqual(expect.arrayContaining(['empty', 'duplicate', 'no-label']));
  });
  it('kräver exakt fem utbytta texter per klass i förbättrad data', () => {
    expect(validateCustomDataset(validEdits()).ok).toBe(true);
    expect(validateCustomDataset({}).ok).toBe(false);
    const six = validEdits();
    six[spamIds[5]] = 'Ännu en ny spamtext om lyxväskor';
    const res = validateCustomDataset(six);
    expect(res.ok).toBe(false);
    expect(res.problems.join(' ')).toMatch(/exakt 5 texter i spamklassen/);
    // fortfarande exakt 20 per klass
    expect(countPerClass(applyEdits(validEdits()))).toMatchObject({ spam: 20, vanlig: 20 });
  });
  it('avvisar tom ersättningstext och dubbletter i förbättrad data', () => {
    const e = validEdits();
    e[spamIds[0]] = '';
    expect(validateCustomDataset(e).problems.join(' ')).toMatch(/tom/);
    const d = validEdits();
    d[spamIds[1]] = d[spamIds[0]];
    expect(validateCustomDataset(d).problems.join(' ')).toMatch(/Dubblett/);
  });
});

describe('14–15. Validerings- och sluttestdata används inte i träning', () => {
  it('avvisar en ersättningstext som är identisk med valideringsdata (även med annan versal/punkt)', () => {
    const e = validEdits();
    e[spamIds[0]] = VALIDATION_TEXTS[0].text.toUpperCase();
    const res = validateCustomDataset(e);
    expect(res.ok).toBe(false);
    expect(res.problems.join(' ')).toMatch(/valideringsdata eller sluttestet/);
  });
  it('avvisar en ersättningstext som är identisk med sluttestet', () => {
    const e = validEdits();
    e[hamIds[0]] = FINAL_TEST_TEXTS[15].text;
    expect(validateCustomDataset(e).ok).toBe(false);
  });
  it('assertValidTrainingData kastar UserError när valideringsrader ligger bland träningsdata', () => {
    const rows = [...B.slice(0, 19), VALIDATION_TEXTS[0], ...B.slice(20)];
    expect(() => assertValidTrainingData(rows)).toThrow(UserError);
    const rows2 = [...B.slice(0, 39), FINAL_TEST_TEXTS[19]];
    expect(() => assertValidTrainingData(rows2)).toThrow(/Validerings- och sluttestdata/);
  });
  it('inget träningsupplägg innehåller validerings- eller sluttestdata', () => {
    const held = new Set([...VALIDATION_TEXTS, ...FINAL_TEST_TEXTS].map((r) => normalizeText(r.text)));
    for (const mode of ['single', 'compare-datasets', 'compare-epochs', 'improve']) {
      const plan = buildPlan({ mode, datasetKey: 'a', settings, edits: validEdits() });
      for (const spec of plan) {
        for (const t of spec.texts) {
          expect(held.has(normalizeText(t.text))).toBe(false);
          expect(['validation', 'final-test']).not.toContain(t.source);
        }
      }
    }
  });
});

describe('Laborationsupplägg', () => {
  it('lektion 2: A och B med samma inställningar', () => {
    const [a, b] = buildPlan({ mode: 'compare-datasets', datasetKey: 'a', settings, edits: {} });
    expect(a.settings).toEqual(b.settings);
    expect([a.datasetKey, b.datasetKey]).toEqual(['a', 'b']);
  });
  it('lektion 3: dataset B med 5, 30 och 100 epoker och i övrigt lika inställningar', () => {
    const plan = buildPlan({ mode: 'compare-epochs', datasetKey: 'a', settings, edits: {} });
    expect(plan.map((p) => p.settings.epochs)).toEqual([5, 30, 100]);
    expect(new Set(plan.map((p) => p.datasetKey))).toEqual(new Set(['b']));
    expect(new Set(plan.map((p) => JSON.stringify({ ...p.settings, epochs: 0 }))).size).toBe(1);
  });
  it('lektion 4: nekas med ogiltig förbättrad data men fungerar med giltig', () => {
    expect(() => buildPlan({ mode: 'improve', datasetKey: 'b', settings, edits: {} })).toThrow(UserError);
    const [before, after] = buildPlan({ mode: 'improve', datasetKey: 'b', settings, edits: validEdits() });
    expect(before.texts).toBe(DATASETS.b.texts);
    expect(after.texts.filter((t) => t.source === 'custom')).toHaveLength(10);
    expect(before.settings).toEqual(after.settings);
  });
});
