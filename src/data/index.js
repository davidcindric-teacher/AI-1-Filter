import { DATASET_VERSION } from '../config.js';
import { DATASET_A_TEXTS } from './datasetA.js';
import { DATASET_B_TEXTS } from './datasetB.js';
import { VALIDATION_TEXTS } from './validation.js';
import { FINAL_TEST_TEXTS } from './finalTest.js';

// Varje text har: id, text, label ('spam' | 'vanlig') och source
// ('dataset-a' | 'dataset-b' | 'validation' | 'final-test' | 'custom').
export { DATASET_A_TEXTS, DATASET_B_TEXTS, VALIDATION_TEXTS, FINAL_TEST_TEXTS };

export const DATASETS = Object.freeze({
  a: Object.freeze({
    key: 'a',
    name: 'Dataset A',
    version: DATASET_VERSION,
    description: 'Mer repetitiva formuleringar: samma ord och fraser återkommer ofta.',
    texts: DATASET_A_TEXTS,
  }),
  b: Object.freeze({
    key: 'b',
    name: 'Dataset B',
    version: DATASET_VERSION,
    description: 'Större språklig variation i ordval, meningslängd och formulering.',
    texts: DATASET_B_TEXTS,
  }),
});
