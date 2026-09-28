import { gaussian, gaussianFromKey, hashString, mulberry32 } from './rng.js';
import { toActiveIndices } from './vectorizer.js';
import { THRESHOLD } from '../config.js';

/**
 * Ett litet neuralt nätverk:
 *   indata (ett tal per ord i vokabulären, 0 eller 1)
 *   -> dolt lager med ReLU (hiddenUnits noder)
 *   -> utdata: en nod med sigmoid = sannolikhet för spam (0–1)
 *
 * Vikterna (W1, b1, W2, b2) är modellens "kunskap". De ändras under träningen.
 * Allt är vanliga tal i Float64Array, ingen extern maskininlärningsbiblioteket behövs.
 */

const W1_STD = 0.5;
const W2_STD = 0.5;

/**
 * Skapar ett nytt nätverk med startvikter som bara beror på slumpfrö (och ordet för W1):
 *  - W1[ord, nod] = normalfördelat tal från nyckeln "seed|ord|nod". Samma ord ger därför samma
 *    startvikter i dataset A, B och egna dataset, trots att vokabulärerna har olika storlek.
 *  - b1 = 0.
 *  - W2 och b2 dras ur en seedad generator som inte beror på vokabulären.
 * Två nätverk med samma slumpfrö och samma dataset börjar alltså alltid med exakt samma vikter.
 */
export function createNetwork({ words, hiddenUnits, seed }) {
  const V = words.length;
  const H = hiddenUnits;
  const W1 = new Float64Array(V * H);
  for (let i = 0; i < V; i++) {
    for (let j = 0; j < H; j++) {
      W1[i * H + j] = W1_STD * gaussianFromKey(`w1|${seed}|${words[i]}|${j}`);
    }
  }
  const rng = mulberry32(hashString(`w2|${seed}`));
  const W2 = new Float64Array(H);
  for (let j = 0; j < H; j++) W2[j] = W2_STD * gaussian(rng);
  return { V, H, words, W1, b1: new Float64Array(H), W2, b2: 0 };
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/** Framåtpassning för en text som redan är omvandlad till lista av aktiva ordindex. */
export function forward(net, active) {
  const { H, W1, b1, W2 } = net;
  const pre = new Float64Array(H);
  const h = new Float64Array(H);
  let z = net.b2;
  for (let j = 0; j < H; j++) {
    let s = b1[j];
    for (const i of active) s += W1[i * H + j];
    pre[j] = s;
    h[j] = s > 0 ? s : 0; // ReLU
    z += W2[j] * h[j];
  }
  return { pre, h, p: sigmoid(z) };
}

/** Sannolikhet för spam för en råtext. Ändrar aldrig nätverket. */
export function predictProbability(net, vocab, text) {
  return forward(net, toActiveIndices(text, vocab)).p;
}

export function classify(p, threshold = THRESHOLD) {
  return p >= threshold ? 'spam' : 'vanlig';
}

/** Binary cross-entropy för en enskild sannolikhet. */
export function logLoss(p, y) {
  const q = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
}

/**
 * En epok = en genomgång av all träningsdata, i små grupper (batchar).
 * För varje batch beräknas hur vikterna ska ändras (gradient) och SGD tar ett steg:
 *   vikt = vikt - inlärningstakt * gradient
 * `order` bestämmer i vilken ordning texterna används (bestäms av slumpfröet, se trainer.js).
 */
export function trainEpoch(net, samples, order, { learningRate, batchSize }) {
  const { H, W1, b1, W2 } = net;
  const gW1 = new Float64Array(W1.length);
  const gb1 = new Float64Array(H);
  const gW2 = new Float64Array(H);
  for (let start = 0; start < order.length; start += batchSize) {
    const batch = order.slice(start, start + batchSize);
    gW1.fill(0);
    gb1.fill(0);
    gW2.fill(0);
    let gb2 = 0;
    for (const k of batch) {
      const s = samples[k];
      const { pre, h, p } = forward(net, s.idx);
      const dz = p - s.y;
      gb2 += dz;
      for (let j = 0; j < H; j++) {
        gW2[j] += dz * h[j];
        if (pre[j] > 0) {
          const dpre = dz * W2[j];
          gb1[j] += dpre;
          for (const i of s.idx) gW1[i * H + j] += dpre;
        }
      }
    }
    const scale = learningRate / batch.length;
    for (let i = 0; i < W1.length; i++) W1[i] -= scale * gW1[i];
    for (let j = 0; j < H; j++) {
      b1[j] -= scale * gb1[j];
      W2[j] -= scale * gW2[j];
    }
    net.b2 -= scale * gb2;
  }
}

/** Kort "fingeravtryck" av vikterna. Samma startläge => samma id. Används för att visa/testa rättvisa jämförelser. */
export function fingerprint(net, { onlySharedPart = false } = {}) {
  const parts = [];
  if (!onlySharedPart) for (const v of net.W1) parts.push(v.toFixed(10));
  for (const v of net.b1) parts.push(v.toFixed(10));
  for (const v of net.W2) parts.push(v.toFixed(10));
  parts.push(net.b2.toFixed(10));
  return hashString(parts.join(',')).toString(16).padStart(8, '0');
}

export function countWeights(net) {
  return net.W1.length + net.b1.length + net.W2.length + 1;
}
