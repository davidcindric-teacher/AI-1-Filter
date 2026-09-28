import { CLASS_SIZE, LABEL_HAM, LABEL_SPAM, SWAP_COUNT } from './config.js';
import { DATASETS } from './data/index.js';
import { findTrainingProblems } from './dataChecks.js';
import { normalizeText } from './ml/tokenizer.js';

/**
 * "Förbättrad dataset B" = dataset B där eleven har bytt ut exakt fem texter per klass.
 * Eleven ändrar bara texten; klassen och id:t för en plats ligger fast. Ändringarna sparas som
 * { [id]: nyText } så att det är lätt att se, jämföra och återställa vad som ändrats.
 */
export const BASE_ROWS = DATASETS.b.texts;

const baseById = new Map(BASE_ROWS.map((r) => [r.id, r]));

const isChanged = (base, text) => typeof text === 'string' && normalizeText(text) !== normalizeText(base.text);

/** Bygger träningsraderna: dataset B med ändringarna ifyllda. Tomma fält behålls som tomma (och fångas av valideringen). */
export function applyEdits(edits = {}) {
  return BASE_ROWS.map((r) => {
    const text = edits[r.id];
    if (typeof text === 'string' && (text.trim() === '' || isChanged(r, text))) {
      return { id: r.id, text: text.trim(), label: r.label, source: 'custom' };
    }
    return r;
  });
}

/** Ändringar som faktiskt skiljer sig från dataset B (identiska "ändringar" räknas inte). Tomma fält räknas som ändrade. */
export function effectiveEdits(edits = {}) {
  const out = {};
  for (const [id, text] of Object.entries(edits)) {
    const base = baseById.get(id);
    if (base && typeof text === 'string' && (text.trim() === '' || isChanged(base, text))) out[id] = text;
  }
  return out;
}

export const changedIds = (edits) => Object.keys(effectiveEdits(edits));

export function countChanges(edits) {
  const counts = { [LABEL_SPAM]: 0, [LABEL_HAM]: 0 };
  for (const id of changedIds(edits)) counts[baseById.get(id).label]++;
  return counts;
}

/**
 * Full kontroll av en förbättrad datamängd. Returnerar { ok, problems, rows, changes }.
 * Regler: inga tomma texter, inga dubbletter, ingen text med okänd klass, exakt 20 per klass,
 * inga texter som är identiska med validerings- eller sluttestdata och exakt fem ändringar per klass.
 */
export function validateCustomDataset(edits = {}) {
  const rows = applyEdits(edits);
  const problems = findTrainingProblems(rows).map((p) => p.message);
  const changes = countChanges(edits);
  for (const [label, name] of [[LABEL_SPAM, 'spamklassen'], [LABEL_HAM, 'klassen vanliga']]) {
    if (changes[label] !== SWAP_COUNT) {
      problems.push(`Byt ut exakt ${SWAP_COUNT} texter i ${name}. Just nu: ${changes[label]}.`);
    }
  }
  return { ok: problems.length === 0, problems, rows, changes, expectedPerClass: CLASS_SIZE };
}
