import { LABEL_SPAM } from './config.js';

// Spam är den "positiva" klassen.
//  Sant positiv (TP): spam som klassificeras som spam.
//  Sant negativ (TN): vanligt meddelande som klassificeras som vanligt.
//  Falskt positiv (FP): vanligt meddelande som klassificeras som spam.
//  Falskt negativ (FN): spam som klassificeras som vanligt meddelande.

/** rows: [{ label, predicted }] */
export function confusionMatrix(rows) {
  const m = { tp: 0, tn: 0, fp: 0, fn: 0 };
  for (const r of rows) {
    const actualSpam = r.label === LABEL_SPAM;
    const predSpam = r.predicted === LABEL_SPAM;
    if (actualSpam && predSpam) m.tp++;
    else if (!actualSpam && !predSpam) m.tn++;
    else if (!actualSpam && predSpam) m.fp++;
    else m.fn++;
  }
  return m;
}

const ratio = (num, den) => (den === 0 ? null : num / den);

// null betyder "Ej definierat" (division med noll).
export const accuracy = ({ tp, tn, fp, fn }) => ratio(tp + tn, tp + tn + fp + fn);
export const precision = ({ tp, fp }) => ratio(tp, tp + fp);
export const recall = ({ tp, fn }) => ratio(tp, tp + fn);
// F1 = 2·P·R / (P + R) = 2·TP / (2·TP + FP + FN)
export const f1 = ({ tp, fp, fn }) => ratio(2 * tp, 2 * tp + fp + fn);

export function computeMetrics(rows) {
  const m = confusionMatrix(rows);
  return {
    ...m,
    n: rows.length,
    accuracy: accuracy(m),
    precision: precision(m),
    recall: recall(m),
    f1: f1(m),
  };
}

export function misclassified(rows) {
  return rows.filter((r) => r.label !== r.predicted);
}

export const UNDEFINED_TEXT = 'Ej definierat';

/** Visar ett mått som procent med decimalkomma, eller "Ej definierat". */
export function formatMetric(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return UNDEFINED_TEXT;
  return `${(value * 100).toFixed(decimals).replace('.', ',')} %`;
}

export function formatNumber(value, decimals = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) return UNDEFINED_TEXT;
  return value.toFixed(decimals).replace('.', ',');
}
