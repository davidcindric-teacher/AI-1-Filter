import { APP_VERSION, DATASET_KEYS, DATASET_VERSION, LIMITS, MAX_TEXT_LENGTH, MODES, RECOVERY_FORMAT, RECOVERY_FORMAT_VERSION, THRESHOLD } from './config.js';
import { DATASETS } from './data/index.js';
import { applyEdits, validateCustomDataset } from './customData.js';
import { MIX_NAME, MIX_POOL, mixRows, normalizeMixIds, validateMix } from './mixData.js';

/**
 * Återställningstext = läsbar JSON som innehåller ALLT som behövs för att göra om en körning:
 * träningstexter med etiketter, dataset, inställningar, slumpfrö, epoker, appversion och datum.
 * Eftersom träningen är deterministisk (samma slumpfrö + samma data + samma inställningar)
 * ger en ny träning exakt samma resultat. Inget behöver hämtas från en server.
 */

export function buildRecoveryText({ attemptName, now = new Date(), mode, datasetKey, settings, edits, mixIds = [], results = [] }) {
  const rows = datasetKey === 'custom' ? applyEdits(edits) : datasetKey === 'mix' ? mixRows(mixIds) : DATASETS[datasetKey].texts;
  const dataset =
    datasetKey === 'custom'
      ? { key: 'custom', name: 'Dataset B (förbättrad)', version: DATASET_VERSION, baseDataset: 'b' }
      : datasetKey === 'mix'
        ? { key: 'mix', name: MIX_NAME, version: DATASET_VERSION, baseDataset: null }
        : { key: datasetKey, name: DATASETS[datasetKey].name, version: DATASET_VERSION, baseDataset: null };
  const data = {
    format: RECOVERY_FORMAT,
    formatVersion: RECOVERY_FORMAT_VERSION,
    appVersion: APP_VERSION,
    createdAt: now.toISOString(),
    attemptName: attemptName || '',
    mode,
    dataset,
    settings: {
      seed: settings.seed,
      epochs: settings.epochs,
      learningRate: settings.learningRate,
      batchSize: settings.batchSize,
      hiddenUnits: settings.hiddenUnits,
      threshold: THRESHOLD,
      optimizer: 'SGD',
    },
    // Alla träningstexter i den valda datamängden, med etiketter (spam / vanlig).
    trainingTexts: rows.map(({ id, text, label }) => ({ id, text, label })),
    // Elevens ändringar av dataset B: { id: ny text }. Kan finnas även om dataset A eller B är valt.
    edits: edits ?? {},
    // Elevens val av texter till dataset C (id från dataset A och B). Kan finnas även om ett annat dataset är valt.
    mixIds: normalizeMixIds(mixIds),
    // Endast för läsning: vad som blev resultatet vid export. Används inte vid inläsning.
    lastResults: results.map((r) => ({
      label: r.label,
      epochs: r.settings.epochs,
      validationAccuracy: r.validation.metrics.accuracy,
      trainingAccuracy: r.train.metrics.accuracy,
      precision: r.validation.metrics.precision,
      recall: r.validation.metrics.recall,
      f1: r.validation.metrics.f1,
      startId: r.startId,
    })),
  };
  return JSON.stringify(data, null, 2);
}

const fail = (...errors) => ({ ok: false, errors });

/** Läser och kontrollerar en återställningstext. Returnerar { ok: true, state } eller { ok: false, errors: [svenska meddelanden] }. */
export function parseRecoveryText(text) {
  if (typeof text !== 'string' || text.trim() === '') return fail('Textrutan är tom. Klistra in återställningstexten först.');

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return fail('Texten kunde inte läsas. Kontrollera att du har kopierat hela återställningstexten, från första { till sista }.');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return fail('Texten är inte en återställningstext från den här appen.');
  if (data.format !== RECOVERY_FORMAT) return fail('Texten är inte en återställningstext från den här appen (fel "format").');
  if (!Number.isInteger(data.formatVersion) || data.formatVersion < 1) return fail('Formatversionen saknas eller är ogiltig.');
  if (data.formatVersion > RECOVERY_FORMAT_VERSION) {
    return fail(`Återställningen har formatversion ${data.formatVersion}, men den här appen förstår bara version ${RECOVERY_FORMAT_VERSION}.`);
  }

  const errors = [];
  const s = data.settings;
  const settings = {};
  if (s === null || typeof s !== 'object') {
    errors.push('Modellinställningarna ("settings") saknas.');
  } else {
    const fields = [
      ['seed', 'Slumpfrö', true],
      ['epochs', 'Antal epoker', true],
      ['learningRate', 'Learning rate', false],
      ['batchSize', 'Batchstorlek', true],
      ['hiddenUnits', 'Antal noder i dolda lagret', true],
    ];
    for (const [key, label, integer] of fields) {
      const v = s[key];
      const [lo, hi] = LIMITS[key];
      if (typeof v !== 'number' || !Number.isFinite(v) || (integer && !Number.isInteger(v)) || v < lo || v > hi) {
        errors.push(`${label} saknas eller är ogiltigt (ska vara ${integer ? 'ett heltal' : 'ett tal'} mellan ${lo} och ${hi}).`);
      } else {
        settings[key] = v;
      }
    }
    if (s.threshold !== undefined && s.threshold !== THRESHOLD) errors.push(`Tröskeln ska vara ${THRESHOLD} i den här versionen.`);
  }

  const mode = data.mode ?? 'single';
  if (!Object.prototype.hasOwnProperty.call(MODES, mode)) errors.push('Laborationstypen ("mode") är okänd.');

  const ds = data.dataset;
  const datasetKey = ds?.key;
  if (!DATASET_KEYS.includes(datasetKey)) errors.push('Datasetets nyckel saknas eller är okänd (ska vara a, b, custom eller mix).');
  if (ds && String(ds.version) !== DATASET_VERSION) errors.push(`Datasetversionen (${ds.version}) stämmer inte med appens (${DATASET_VERSION}).`);

  const edits = {};
  const rawEdits = data.edits ?? {};
  if (typeof rawEdits !== 'object' || Array.isArray(rawEdits) || rawEdits === null) {
    errors.push('"edits" måste vara ett objekt med id och text.');
  } else {
    const known = new Set(DATASETS.b.texts.map((r) => r.id));
    for (const [id, value] of Object.entries(rawEdits)) {
      if (!known.has(id)) errors.push(`Ändringen "${id}" hör inte till någon text i dataset B.`);
      else if (typeof value !== 'string') errors.push(`Ändringen "${id}" har ingen text.`);
      else if (value.length > MAX_TEXT_LENGTH) errors.push(`Ändringen "${id}" är längre än ${MAX_TEXT_LENGTH} tecken.`);
      else edits[id] = value;
    }
  }

  const mixIds = [];
  const rawMix = data.mixIds ?? [];
  if (!Array.isArray(rawMix)) {
    errors.push('"mixIds" måste vara en lista med text-id.');
  } else {
    const known = new Set(MIX_POOL.map((r) => r.id));
    for (const id of rawMix) {
      if (typeof id !== 'string' || !known.has(id)) errors.push(`Valet "${String(id).slice(0, 30)}" till dataset C hör inte till dataset A eller B.`);
      else mixIds.push(id);
    }
  }

  if (!Array.isArray(data.trainingTexts)) {
    errors.push('Träningstexterna ("trainingTexts") saknas.');
  } else if (DATASET_KEYS.includes(datasetKey)) {
    for (const t of data.trainingTexts) {
      if (t === null || typeof t !== 'object' || typeof t.text !== 'string' || t.text.trim() === '') {
        errors.push('En träningstext är tom eller felaktig.');
        break;
      }
      if (t.label !== 'spam' && t.label !== 'vanlig') {
        errors.push(`Texten "${String(t.text).slice(0, 40)}" saknar giltig klass (spam eller vanlig).`);
        break;
      }
    }
    if (errors.length === 0) {
      const expected = datasetKey === 'custom' ? applyEdits(edits) : datasetKey === 'mix' ? mixRows(mixIds) : DATASETS[datasetKey].texts;
      const same =
        data.trainingTexts.length === expected.length &&
        expected.every((e, i) => data.trainingTexts[i].id === e.id && data.trainingTexts[i].text === e.text && data.trainingTexts[i].label === e.label);
      if (!same) errors.push('Träningstexterna stämmer inte med datasetet och ändringarna i återställningen. Har texten ändrats för hand?');
    }
  }

  if (errors.length === 0 && datasetKey === 'custom') {
    const check = validateCustomDataset(edits);
    if (!check.ok) errors.push(...check.problems);
  }
  if (errors.length === 0 && (datasetKey === 'mix' || mode === 'compare-abc')) {
    const check = validateMix(mixIds);
    if (!check.ok) errors.push(...check.problems);
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    state: {
      attemptName: typeof data.attemptName === 'string' ? data.attemptName : '',
      mode,
      datasetKey,
      settings,
      edits,
      mixIds: normalizeMixIds(mixIds),
      appVersion: data.appVersion,
      createdAt: data.createdAt,
    },
  };
}
