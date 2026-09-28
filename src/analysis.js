import { forward } from './ml/network.js';
import { tokenize } from './ml/tokenizer.js';
import { misclassified } from './metrics.js';

const clamp = (p) => Math.min(Math.max(p, 1e-9), 1 - 1e-9);
const logit = (p) => Math.log(p / (1 - p));

/** Antal träningstexter (per klass) där varje ord förekommer. */
export function wordClassCounts(trainingTexts) {
  const counts = new Map();
  for (const t of trainingTexts) {
    for (const w of new Set(tokenize(t.text))) {
      const c = counts.get(w) ?? { spam: 0, vanlig: 0 };
      c[t.label === 'spam' ? 'spam' : 'vanlig']++;
      counts.set(w, c);
    }
  }
  return counts;
}

/**
 * Ordvikter (approximation): hur mycket flyttar ett enskilt ord modellens svar?
 * Vi ger modellen en text med bara det ordet och jämför (i log-odds) med en helt tom text.
 * Positivt tal = ordet drar mot spam, negativt = mot vanligt meddelande. Det är en förenkling: i verkligheten
 * samverkar orden med varandra i det dolda lagret.
 */
export function wordInfluence(run) {
  const base = logit(clamp(forward(run.net, []).p));
  const counts = wordClassCounts(run.trainingTexts);
  return run.vocab.words.map((word, i) => {
    const c = counts.get(word) ?? { spam: 0, vanlig: 0 };
    return { word, effect: logit(clamp(forward(run.net, [i]).p)) - base, spamCount: c.spam, hamCount: c.vanlig };
  });
}

export function topInfluentialWords(run, n = 10) {
  const all = wordInfluence(run);
  const byEffect = (a, b) => b.effect - a.effect || a.word.localeCompare(b.word, 'sv');
  return {
    spam: all.filter((w) => w.effect > 0).sort(byEffect).slice(0, n),
    ham: all.filter((w) => w.effect < 0).sort((a, b) => -byEffect(a, b)).slice(0, n),
    total: all.length,
  };
}

/**
 * Felanalys: för varje felklassificerad text, vilka ord fanns, vilka kände modellen igen,
 * och hur vanliga var de i träningsdatans spam respektive vanliga texter?
 */
export function analyzeErrors(run, rows = run.validation.rows) {
  const counts = wordClassCounts(run.trainingTexts);
  const unknown = new Set();
  const items = misclassified(rows).map((row) => {
    const words = [...new Set(tokenize(row.text))].map((word) => {
      const known = run.vocab.index.has(word);
      if (!known) unknown.add(word);
      const c = counts.get(word) ?? { spam: 0, vanlig: 0 };
      return { word, known, spamCount: c.spam, hamCount: c.vanlig };
    });
    return { row, words, unknownCount: words.filter((w) => !w.known).length };
  });
  return { items, unknownWords: [...unknown].sort((a, b) => a.localeCompare(b, 'sv')) };
}

/** Första epoken (index) med högst validation accuracy. Att välja epok så är osäkert med 20 valideringstexter. */
export function bestEpochIndex(history) {
  let best = 0;
  history.forEach((e, i) => {
    if ((e.valAccuracy ?? -1) > (history[best].valAccuracy ?? -1)) best = i;
  });
  return best;
}
