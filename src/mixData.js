import { CLASS_SIZE, DATASET_VERSION, LABEL_HAM, LABEL_SPAM } from './config.js';
import { DATASETS } from './data/index.js';
import { findTrainingProblems } from './dataChecks.js';

/**
 * Dataset C ("eget mix"): eleven väljer själv exakt 20 spamtexter och 20 vanliga texter ur poolen
 * av alla texter i dataset A och B (40 spam + 40 vanliga). Valideringsdata och sluttest finns aldrig i poolen.
 * Raderna hålls alltid i poolens ordning, oberoende av i vilken ordning eleven valde, så att samma val
 * ger samma träningsdata (och därmed samma resultat).
 */
export const MIX_POOL = Object.freeze([...DATASETS.a.texts, ...DATASETS.b.texts]);
const poolById = new Map(MIX_POOL.map((r) => [r.id, r]));

export const MIX_NAME = 'Dataset C (eget mix av A och B)';

/** Rensar bort okända och dubbla id:n och sorterar i poolens ordning. */
export function normalizeMixIds(ids = []) {
  const wanted = new Set(ids);
  return MIX_POOL.filter((r) => wanted.has(r.id)).map((r) => r.id);
}

export const mixRows = (ids) => normalizeMixIds(ids).map((id) => poolById.get(id));

export function mixCounts(ids) {
  const rows = mixRows(ids);
  return { spam: rows.filter((r) => r.label === LABEL_SPAM).length, vanlig: rows.filter((r) => r.label === LABEL_HAM).length };
}

/** Returnerar { ok, problems, rows }. Kräver exakt 20 + 20 texter och ger svenska felmeddelanden. */
export function validateMix(ids = []) {
  const problems = [];
  const unknown = ids.filter((id) => !poolById.has(id));
  if (unknown.length) problems.push(`Okända texter i valet: ${unknown.slice(0, 3).join(', ')}.`);
  const rows = mixRows(ids);
  if (rows.length === 0) {
    problems.push('Du har inte valt några texter till dataset C än.');
  } else {
    problems.push(...findTrainingProblems(rows).map((p) => p.message));
  }
  return { ok: problems.length === 0, problems: [...new Set(problems)], rows, expectedPerClass: CLASS_SIZE };
}

export const mixDataset = (ids) => ({ key: 'mix', name: MIX_NAME, version: DATASET_VERSION, texts: mixRows(ids) });
