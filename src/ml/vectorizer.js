import { tokenize } from './tokenizer.js';

/**
 * Vokabulär = alla unika ord i TRÄNINGSDATA, sorterade i bokstavsordning.
 * Sorteringen gör att vokabulären inte beror på texternas ordning.
 * Valideringsdata och sluttest bidrar aldrig till vokabulären.
 */
export function buildVocabulary(texts) {
  const set = new Set();
  for (const t of texts) for (const w of tokenize(t)) set.add(w);
  const words = [...set].sort((a, b) => a.localeCompare(b, 'sv'));
  const index = new Map(words.map((w, i) => [w, i]));
  return { words, index };
}

/**
 * Bag-of-words: en vektor med en position per ord i vokabulären.
 * 1 om ordet finns i texten, annars 0. Ordföljd spelar ingen roll. Okända ord ignoreras.
 */
export function toVector(text, vocab) {
  const v = new Array(vocab.words.length).fill(0);
  for (const w of tokenize(text)) {
    const i = vocab.index.get(w);
    if (i !== undefined) v[i] = 1;
  }
  return v;
}

/** Samma information som toVector men som lista över index där vektorn är 1 (snabbare i träningen). */
export function toActiveIndices(text, vocab) {
  const seen = new Set();
  for (const w of tokenize(text)) {
    const i = vocab.index.get(w);
    if (i !== undefined) seen.add(i);
  }
  return [...seen].sort((a, b) => a - b);
}
