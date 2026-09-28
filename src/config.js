// Gemensamma konstanter. Appversionen visas i gränssnittet, resultatblock och återställningstext.
export const APP_VERSION = '1.0.0';
export const DATASET_VERSION = '1';

export const RECOVERY_FORMAT = 'spamfilter-lab-aterstallning';
export const RECOVERY_FORMAT_VERSION = 1;

export const LABEL_SPAM = 'spam';
export const LABEL_HAM = 'vanlig';
export const LABEL_NAMES = { [LABEL_SPAM]: 'Spam', [LABEL_HAM]: 'Vanligt meddelande' };

export const CLASS_SIZE = 20; // exakt antal träningstexter per klass
export const SWAP_COUNT = 5; // exakt antal texter som ska bytas ut per klass i lektion 4
export const MAX_TEXT_LENGTH = 300;

// Lärarkod som låser upp "Visa alla avsnitt" och sluttestet. Ingen säkerhet (koden syns i källkoden),
// bara en tröskel så att eleverna inte hoppar före. Byt här.
export const TEACHER_CODE = '6767';

export const THRESHOLD = 0.5; // sannolikhet för spam >= tröskeln => "spam"
// Valt som ett representativt frö (nära medelvärdet över 40 testade frön), inte för att ge bäst resultat.
export const DEFAULT_SEED = 7;

// Förvalda inställningar (lektion 1).
export const DEFAULTS = Object.freeze({
  seed: DEFAULT_SEED,
  epochs: 30,
  learningRate: 0.1,
  batchSize: 4,
  hiddenUnits: 8,
});

export const LIMITS = Object.freeze({
  seed: [0, 999999],
  epochs: [1, 300],
  learningRate: [0.001, 2],
  batchSize: [1, 40],
  hiddenUnits: [2, 32],
});

export const EPOCH_COMPARISON = Object.freeze([5, 30, 100]);

export const MODES = Object.freeze({
  single: 'Lektion 1: En träning',
  'compare-datasets': 'Lektion 2: Jämför dataset A och B',
  'compare-epochs': 'Lektion 3: Jämför 5, 30 och 100 epoker',
  improve: 'Lektion 4: Före och efter förbättring',
  // Utökade laborationer (för elever som blir klara tidigt)
  'compare-abc': 'Lektion 2 (utökad): Jämför A, B och eget mix C',
  'compare-lr': 'Lektion 3 (utökad): Jämför learning rate',
  'compare-hidden': 'Lektion 3 (utökad): Jämför antal dolda noder',
});
export const CORE_MODES = Object.freeze(['single', 'compare-datasets', 'compare-epochs', 'improve']);
export const EXTENDED_MODES = Object.freeze(['compare-abc', 'compare-lr', 'compare-hidden']);
export const LR_COMPARISON = Object.freeze([0.01, 0.1, 0.5]);
export const HIDDEN_COMPARISON = Object.freeze([2, 8, 32]);
export const DATASET_KEYS = Object.freeze(['a', 'b', 'custom', 'mix']);
