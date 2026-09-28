// Egen seedad slumpgenerator. Vi använder INTE Math.random(), eftersom den inte går att seeda.
// Samma slumpfrö ger därför exakt samma slumptal, samma startvikter och samma ordning på träningsdata.

/** FNV-1a: gör en text (t.ex. ett ord + slumpfrö) till ett 32-bitars heltal. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: liten och snabb generator. Returnerar en funktion som ger tal i [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normalfördelat tal (Box–Muller) från en uniform generator. */
export function gaussian(rng) {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Normalfördelat tal som bara beror på en nyckeltext, t.ex. "2024|ord|3". */
export function gaussianFromKey(key) {
  return gaussian(mulberry32(hashString(key)));
}

/** Deterministisk blandning (Fisher–Yates). Ändrar inte indata. */
export function shuffled(items, rng) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
