import { classify, createNetwork, fingerprint, forward, logLoss, trainEpoch } from './network.js';
import { tokenize } from './tokenizer.js';
import { mulberry32, hashString, shuffled } from './rng.js';
import { buildVocabulary, toActiveIndices } from './vectorizer.js';
import { computeMetrics } from '../metrics.js';
import { THRESHOLD, LABEL_SPAM, LIMITS } from '../config.js';
import { VALIDATION_TEXTS } from '../data/index.js';
import { assertValidTrainingData } from '../dataChecks.js';
import { TrainingCancelled, UserError } from '../errors.js';

const prepare = (rows, vocab) =>
  rows.map((r) => ({ id: r.id, text: r.text, label: r.label, y: r.label === LABEL_SPAM ? 1 : 0, idx: toActiveIndices(r.text, vocab) }));

/** Kör modellen på färdiga prov och ger förlust, prediktioner och mätvärden. */
export function evaluate(net, samples, threshold = THRESHOLD) {
  let loss = 0;
  const rows = samples.map((s) => {
    const { p } = forward(net, s.idx);
    loss += logLoss(p, s.y);
    return { id: s.id, text: s.text, label: s.label, probability: p, predicted: classify(p, threshold) };
  });
  return { loss: rows.length ? loss / rows.length : null, rows, metrics: computeMetrics(rows) };
}

/** Utvärderar en tränad modell på en lista råtexter (t.ex. sluttestet). Ändrar inte modellen. */
export function evaluateOnTexts(result, textRows) {
  return evaluate(result.net, prepare(textRows, result.vocab), result.settings.threshold);
}

export function validateSettings(s) {
  const errors = [];
  const check = (key, label, integer) => {
    const [lo, hi] = LIMITS[key];
    const v = s[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || (integer && !Number.isInteger(v)) || v < lo || v > hi) {
      errors.push(`${label} måste vara ${integer ? 'ett heltal' : 'ett tal'} mellan ${String(lo).replace('.', ',')} och ${String(hi).replace('.', ',')}.`);
    }
  };
  check('seed', 'Slumpfröet', true);
  check('epochs', 'Antal epoker', true);
  check('learningRate', 'Learning rate', false);
  check('batchSize', 'Batchstorleken', true);
  check('hiddenUnits', 'Antal noder i dolda lagret', true);
  if (errors.length) throw new UserError('Inställningarna är inte giltiga.', errors);
}

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Tränar en HELT NY modell från startläget. Ingen modell återanvänds mellan körningar.
 *
 * spec = { label, datasetKey, datasetName, datasetVersion, texts, settings }
 * options = { onEpoch(epochResult, total), shouldCancel() }
 *
 * Determinism:
 *  - Startvikterna bestäms av slumpfröet (se createNetwork).
 *  - Ordningen på träningsdata bestäms av en seedad blandning, en ny blandning varje epok,
 *    men alltid samma serie för samma slumpfrö. Därför är de första 5 epokerna i en 30-epokers
 *    körning identiska med en 5-epokers körning.
 *  - Valideringsdata är alltid samma fasta 20 texter och påverkar aldrig vikterna.
 */
export async function trainModel(spec, { onEpoch, shouldCancel } = {}) {
  const { settings } = spec;
  validateSettings(settings);
  assertValidTrainingData(spec.texts);

  const vocab = buildVocabulary(spec.texts.map((t) => t.text));
  const net = createNetwork({ words: vocab.words, hiddenUnits: settings.hiddenUnits, seed: settings.seed });
  const startId = fingerprint(net);
  const sharedStartId = fingerprint(net, { onlySharedPart: true });

  const train = prepare(spec.texts, vocab);
  const validation = prepare(VALIDATION_TEXTS, vocab);
  const orderRng = mulberry32(hashString(`order|${settings.seed}`));
  const indices = train.map((_, i) => i);

  const history = [];
  for (let epoch = 1; epoch <= settings.epochs; epoch++) {
    if (shouldCancel?.()) throw new TrainingCancelled();
    trainEpoch(net, train, shuffled(indices, orderRng), settings);
    const tr = evaluate(net, train, settings.threshold);
    const va = evaluate(net, validation, settings.threshold);
    const entry = {
      epoch,
      trainLoss: tr.loss,
      trainAccuracy: tr.metrics.accuracy,
      valLoss: va.loss,
      valAccuracy: va.metrics.accuracy,
      valPrecision: va.metrics.precision,
      valRecall: va.metrics.recall,
      valF1: va.metrics.f1,
    };
    history.push(entry);
    onEpoch?.(entry, settings.epochs);
    await nextTick(); // ger webbläsaren tid att rita och lyssna på "Avbryt"
  }
  if (shouldCancel?.()) throw new TrainingCancelled();

  const finalTrain = evaluate(net, train, settings.threshold);
  const finalValidation = evaluate(net, validation, settings.threshold);
  return {
    label: spec.label,
    datasetKey: spec.datasetKey,
    datasetName: spec.datasetName,
    datasetVersion: spec.datasetVersion,
    settings: { ...settings },
    counts: { spam: spec.texts.filter((t) => t.label === 'spam').length, vanlig: spec.texts.filter((t) => t.label === 'vanlig').length },
    trainingTexts: spec.texts,
    vocabSize: vocab.words.length,
    startId,
    sharedStartId,
    history,
    train: finalTrain,
    validation: finalValidation,
    finishedAt: new Date().toISOString(),
    // Modellen och vokabulären behålls i minnet så att egna testtexter och sluttestet kan köras.
    net,
    vocab,
  };
}

/**
 * Testar en egen text på en tränad modell. Läser bara modellen: vikter, vokabulär och träningsdata
 * ändras aldrig av att eleven testar en text.
 */
export function testText(result, text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new UserError('Skriv en text att testa först. Textrutan är tom.');
  const idx = toActiveIndices(trimmed, result.vocab);
  const { p } = forward(result.net, idx);
  const tokens = tokenize(trimmed).map((word) => ({ word, known: result.vocab.index.has(word) }));
  return { text: trimmed, probability: p, predicted: classify(p, result.settings.threshold), tokens, knownCount: idx.length };
}
