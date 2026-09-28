import { computeMetrics } from './metrics.js';
import { classify } from './ml/network.js';

/**
 * Tröskelexperiment: samma modell och samma sannolikheter, men olika tröskel för när ett svar räknas som spam.
 * Det ändrar aldrig modellen, bara hur sannolikheten görs om till "spam" eller "vanligt".
 * rows: [{ label, probability }] (t.ex. valideringsraderna från en körning).
 */
export function metricsAtThreshold(rows, threshold) {
  return computeMetrics(rows.map((r) => ({ ...r, predicted: classify(r.probability, threshold) })));
}

export const SWEEP_THRESHOLDS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

export const sweepThresholds = (rows) => SWEEP_THRESHOLDS.map((t) => ({ threshold: t, metrics: metricsAtThreshold(rows, t) }));

/** Sammanfattning av spridningen i validation accuracy över flera körningar. */
export function summarizeSpread(runs) {
  const acc = runs.map((r) => r.validation.metrics.accuracy).filter((v) => v !== null);
  if (acc.length === 0) return null;
  return { min: Math.min(...acc), max: Math.max(...acc), mean: acc.reduce((a, b) => a + b, 0) / acc.length, n: acc.length };
}
