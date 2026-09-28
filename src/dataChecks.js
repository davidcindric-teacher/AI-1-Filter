import { CLASS_SIZE, LABEL_HAM, LABEL_SPAM, MAX_TEXT_LENGTH } from './config.js';
import { FINAL_TEST_TEXTS, VALIDATION_TEXTS } from './data/index.js';
import { normalizeText } from './ml/tokenizer.js';
import { UserError } from './errors.js';

const HELD_OUT_SOURCES = new Set(['validation', 'final-test']);

// Normaliserade texter som aldrig får användas som träningsdata.
const heldOutTexts = new Set([...VALIDATION_TEXTS, ...FINAL_TEST_TEXTS].map((r) => normalizeText(r.text)));

export const isHeldOutText = (text) => heldOutTexts.has(normalizeText(text));

export function countPerClass(rows) {
  const counts = { [LABEL_SPAM]: 0, [LABEL_HAM]: 0, other: 0 };
  for (const r of rows) {
    if (r.label === LABEL_SPAM || r.label === LABEL_HAM) counts[r.label]++;
    else counts.other++;
  }
  return counts;
}

/**
 * Kontrollerar en lista träningstexter och returnerar en lista med problem (tom lista = giltig).
 * Varje problem har { code, message, id? }. Används av både redigeraren och träningen.
 */
export function findTrainingProblems(rows) {
  const problems = [];
  const counts = countPerClass(rows);
  const seen = new Map();

  for (const r of rows) {
    const label = r.id ? ` (${r.id})` : '';
    if (r.label !== LABEL_SPAM && r.label !== LABEL_HAM) {
      problems.push({ code: 'no-label', id: r.id, message: `En text saknar klass${label}.` });
    }
    const text = String(r.text ?? '').trim();
    if (!text) {
      problems.push({ code: 'empty', id: r.id, message: `En text är tom${label}.` });
      continue;
    }
    if (text.length > MAX_TEXT_LENGTH) {
      problems.push({ code: 'too-long', id: r.id, message: `Texten${label} är längre än ${MAX_TEXT_LENGTH} tecken.` });
    }
    if (HELD_OUT_SOURCES.has(r.source) || isHeldOutText(text)) {
      problems.push({
        code: 'held-out',
        id: r.id,
        message: `Texten "${shorten(text)}" finns i valideringsdata eller sluttestet. Dessa hålls separata och får inte användas som träning.`,
      });
    }
    const key = normalizeText(text);
    if (seen.has(key)) {
      problems.push({ code: 'duplicate', id: r.id, message: `Dubblett: "${shorten(text)}" förekommer mer än en gång.` });
    } else {
      seen.set(key, r.id);
    }
  }

  for (const [label, name] of [[LABEL_SPAM, 'spamtexter'], [LABEL_HAM, 'vanliga texter']]) {
    const n = counts[label];
    if (n < CLASS_SIZE) {
      problems.push({ code: 'too-few', message: `För få ${name}: ${n} av ${CLASS_SIZE}. Det måste vara exakt ${CLASS_SIZE}.` });
    } else if (n > CLASS_SIZE) {
      problems.push({ code: 'too-many', message: `För många ${name}: ${n} av ${CLASS_SIZE}. Det måste vara exakt ${CLASS_SIZE}.` });
    }
  }
  return problems;
}

/** Kastar UserError om träningsdatan inte är giltig. Sista skyddet innan en modell tränas. */
export function assertValidTrainingData(rows) {
  const problems = findTrainingProblems(rows);
  if (problems.length === 0) return;
  const heldOut = problems.some((p) => p.code === 'held-out');
  const head = heldOut
    ? 'Validerings- och sluttestdata får inte användas som träning.'
    : 'Träningsdatan är inte giltig.';
  throw new UserError(head, problems.map((p) => p.message));
}

function shorten(text, n = 50) {
  return text.length > n ? `${text.slice(0, n)}…` : text;
}
