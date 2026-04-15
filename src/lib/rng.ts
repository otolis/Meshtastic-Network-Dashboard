/**
 * Seeded PRNG + distribution helpers for reproducible mock data.
 * Mulberry32 has ~2^32 period — plenty for a ~20-node dashboard scenario.
 */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randomFloat(rng: Rng, min: number, max: number): number {
  return rng() * (max - min) + min;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pick: cannot select from an empty array');
  }
  const index = Math.floor(rng() * items.length);
  const value = items[index];
  if (value === undefined) {
    // Defensive — noUncheckedIndexedAccess makes TS think this could happen
    throw new Error('pick: index out of bounds');
  }
  return value;
}

export function weightedPick<T>(rng: Rng, items: readonly [T, number][]): T {
  const total = items.reduce((acc, [, w]) => acc + w, 0);
  let r = rng() * total;
  for (const [item, weight] of items) {
    r -= weight;
    if (r <= 0) return item;
  }
  const fallback = items[items.length - 1];
  if (!fallback) throw new Error('weightedPick: empty list');
  return fallback[0];
}

/** Box-Muller — returns a normally-distributed value with given mean and stddev. */
export function gaussian(rng: Rng, mean = 0, stddev = 1): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stddev + mean;
}

/**
 * Log-normal distribution clamped to [min, max]. Good for battery, SNR, RSSI —
 * real telemetry is asymmetric with a tail, not uniform.
 */
export function logNormal(rng: Rng, mu: number, sigma: number, min: number, max: number): number {
  const raw = Math.exp(gaussian(rng, mu, sigma));
  return Math.max(min, Math.min(max, raw));
}

export function shuffle<T>(rng: Rng, items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const ai = arr[i];
    const aj = arr[j];
    if (ai === undefined || aj === undefined) continue;
    arr[i] = aj;
    arr[j] = ai;
  }
  return arr;
}
