/**
 * Force-simulation parameters. Tuned for ~20-node mesh on a 1600×900-ish canvas.
 *
 * Defaults in d3-force produce a "stringy hairball" at this size — these values
 * settle into a stable, readable layout after ~300 pre-ticks.
 */

export const PHYSICS = {
  link: {
    distance: 130,
    strength: 0.55,
  },
  charge: {
    strength: -420,
    distanceMax: 540,
  },
  center: {
    strength: 0.06,
  },
  collide: {
    /** extra radius padding to guarantee no label overlap */
    padding: 8,
  },
  sim: {
    alphaDecay: 0.05,
    velocityDecay: 0.55,
    alphaMin: 0.002,
    /** Iterations to run before first paint so the graph doesn't jump on mount. */
    preTicks: 300,
  },
  zoom: {
    min: 0.3,
    max: 4,
  },
} as const;

/** Node radius in px as a function of throughput hint (0..10 scale). */
export function nodeRadius(throughput: number): number {
  return 10 + Math.max(0, Math.min(10, throughput)) * 1.3;
}

/** Edge stroke width as a function of link quality (0..1). */
export function edgeWidth(quality: number): number {
  const q = Math.max(0, Math.min(1, quality));
  return 0.7 + q * 2.4;
}
