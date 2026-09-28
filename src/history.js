/**
 * Körningshistorik: en kort sammanfattning av varje körning i den här sessionen, så att eleven kan jämföra
 * körningar även efter att ha ändrat en inställning och tränat om. Sparas bara i minnet (försvinner om sidan laddas om).
 */
export const HISTORY_LIMIT = 30;

const pad = (n) => String(n).padStart(2, '0');

export function historyEntry(run, nr, now = new Date()) {
  const m = run.validation.metrics;
  return {
    nr,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    label: run.label,
    dataset: run.datasetName,
    epochs: run.settings.epochs,
    seed: run.settings.seed,
    learningRate: run.settings.learningRate,
    hiddenUnits: run.settings.hiddenUnits,
    trainAccuracy: run.train.metrics.accuracy,
    valAccuracy: m.accuracy,
    precision: m.precision,
    recall: m.recall,
    f1: m.f1,
    fp: m.fp,
    fn: m.fn,
  };
}

/** Lägger till nya körningar sist och numrerar vidare. Behåller bara de senaste HISTORY_LIMIT. */
export function appendHistory(history, runs, now = new Date()) {
  let nr = history.length ? history[history.length - 1].nr : 0;
  const added = runs.map((r) => historyEntry(r, ++nr, now));
  return [...history, ...added].slice(-HISTORY_LIMIT);
}
