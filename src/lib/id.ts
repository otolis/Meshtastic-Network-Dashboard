import type { Rng } from './rng';

const HEX_CHARS = '0123456789abcdef';

/** Generates a Meshtastic-style hex node id: `!a3b2c1d0` (8 hex chars after `!`). */
export function meshId(rng: Rng): string {
  let out = '!';
  for (let i = 0; i < 8; i++) {
    const idx = Math.floor(rng() * 16);
    out += HEX_CHARS.charAt(idx);
  }
  return out;
}

/** Short opaque id for messages / edges. Not a Meshtastic convention, just a UI-side uniqueness. */
export function shortId(rng: Rng): string {
  let out = '';
  for (let i = 0; i < 10; i++) {
    const idx = Math.floor(rng() * 16);
    out += HEX_CHARS.charAt(idx);
  }
  return out;
}
