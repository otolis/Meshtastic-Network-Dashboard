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

/** Ring radii (normalized 0..1) per hop count. Index 0 = base node at center. */
export const RING_RADII = [0, 0.10, 0.19, 0.27, 0.34, 0.40] as const;

export interface RadialPositionInput {
  hops: number;
  /** index of this node among all nodes at the same hop count, sorted alphabetically by shortName */
  index: number;
  /** total number of nodes at this hop count (must be > 0) */
  total: number;
  cx: number;
  cy: number;
  /** half of the viewBox width — scales horizontal spread */
  halfW: number;
  /** half of the viewBox height — scales vertical spread */
  halfH: number;
}

/**
 * Place a node on an elliptical ring. Horizontal stretch 1.6×, vertical 1.05× —
 * canvas is wider than tall, so rings match the usable area.
 *
 * Hops > RING_RADII.length-1 are clamped to the outermost ring.
 */
export function radialPosition(input: RadialPositionInput): { x: number; y: number } {
  const { hops, index, total, cx, cy, halfW, halfH } = input;
  const hopIdx = Math.min(Math.max(0, hops), RING_RADII.length - 1);
  const rNorm = RING_RADII[hopIdx] ?? 0;
  if (rNorm === 0 || total <= 0) return { x: cx, y: cy };
  const angle = (index / total) * Math.PI * 2 + hops * 0.45 - Math.PI / 2;
  return {
    x: cx + Math.cos(angle) * rNorm * halfW * 1.6,
    y: cy + Math.sin(angle) * rNorm * halfH * 1.05,
  };
}
