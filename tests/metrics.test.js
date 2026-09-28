import { describe, expect, it } from 'vitest';
import { accuracy, computeMetrics, confusionMatrix, f1, formatMetric, misclassified, precision, recall } from '../src/metrics.js';

const row = (label, predicted, text = 't') => ({ label, predicted, text });
// 3 TP, 4 TN, 1 FP, 2 FN
const rows = [
  ...Array(3).fill(0).map(() => row('spam', 'spam')),
  ...Array(4).fill(0).map(() => row('vanlig', 'vanlig')),
  row('vanlig', 'spam', 'fp-text'),
  row('spam', 'vanlig', 'fn-text-1'),
  row('spam', 'vanlig', 'fn-text-2'),
];
const m = confusionMatrix(rows);

describe('7. Förväxlingsmatris', () => {
  it('räknar TP, TN, FP, FN', () => {
    expect(m).toEqual({ tp: 3, tn: 4, fp: 1, fn: 2 });
  });
});
describe('3–6. Accuracy, precision, recall, F1', () => {
  it('accuracy = (TP+TN)/alla', () => expect(accuracy(m)).toBeCloseTo(7 / 10));
  it('precision = TP/(TP+FP)', () => expect(precision(m)).toBeCloseTo(3 / 4));
  it('recall = TP/(TP+FN)', () => expect(recall(m)).toBeCloseTo(3 / 5));
  it('F1 = harmoniskt medelvärde av precision och recall', () => {
    const p = 3 / 4;
    const r = 3 / 5;
    expect(f1(m)).toBeCloseTo((2 * p * r) / (p + r));
  });
  it('visar Ej definierat när måttet inte kan beräknas', () => {
    const none = computeMetrics([row('vanlig', 'vanlig'), row('vanlig', 'vanlig')]);
    expect(none.precision).toBeNull();
    expect(none.recall).toBeNull();
    expect(none.f1).toBeNull();
    expect(formatMetric(none.precision)).toBe('Ej definierat');
    expect(computeMetrics([]).accuracy).toBeNull();
  });
  it('F1 är 0 (inte Ej definierat) när spam finns men inget hittas', () => {
    const r = computeMetrics([row('spam', 'vanlig'), row('vanlig', 'spam')]);
    expect(r.f1).toBe(0);
  });
  it('formaterar procent med decimalkomma', () => expect(formatMetric(0.875)).toBe('87,5 %'));
});
describe('8. Felklassificering', () => {
  it('returnerar bara fel, med både falskt positiva och falskt negativa', () => {
    const wrong = misclassified(rows).map((r) => r.text);
    expect(wrong).toEqual(['fp-text', 'fn-text-1', 'fn-text-2']);
  });
});
