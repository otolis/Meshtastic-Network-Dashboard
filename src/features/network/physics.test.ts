import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radialPosition, RING_RADII } from './physics';

test('RING_RADII has 6 entries indexed 0..5', () => {
  assert.equal(RING_RADII.length, 6);
  assert.equal(RING_RADII[0], 0);
  assert.ok(RING_RADII[5]! < 0.5);
});

test('radialPosition(hops=0, ...) returns center', () => {
  const pos = radialPosition({ hops: 0, index: 0, total: 1, cx: 600, cy: 360, halfW: 600, halfH: 360 });
  assert.equal(pos.x, 600);
  assert.equal(pos.y, 360);
});

test('radialPosition applies 1.6× horizontal & 1.05× vertical stretch', () => {
  // hops=1, index=0, total=4 → angle = 0 + 1*0.45 − π/2 = 0.45 − 1.5708 ≈ −1.12
  const p = radialPosition({ hops: 1, index: 0, total: 4, cx: 0, cy: 0, halfW: 100, halfH: 100 });
  // r = 0.10 * halfW (x) and 0.10 * halfH (y), then stretched 1.6 / 1.05
  const angle = 0 / 4 * 2 * Math.PI + 1 * 0.45 - Math.PI / 2;
  const rx = 0.10 * 100 * 1.6;
  const ry = 0.10 * 100 * 1.05;
  assert.ok(Math.abs(p.x - Math.cos(angle) * rx) < 1e-6);
  assert.ok(Math.abs(p.y - Math.sin(angle) * ry) < 1e-6);
});

test('nodes at same hops distribute around full circle', () => {
  const n = 8;
  const positions = Array.from({ length: n }, (_, i) =>
    radialPosition({ hops: 2, index: i, total: n, cx: 0, cy: 0, halfW: 100, halfH: 100 }),
  );
  // Distinct angular positions → distinct (x,y)
  const uniq = new Set(positions.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`));
  assert.equal(uniq.size, n);
});
