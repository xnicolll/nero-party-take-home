// Seeded PRNG - verbatim from the design's nero-data.js so the server and the
// browser generate identical waveforms/peaks from the same seed.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable integer seed from an Audius track id (replaces the design's
// `song.id.charCodeAt(1) * ...` now that ids are arbitrary strings).
export function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic 0..359 hue for vinyl-art tint.
export function hueFromId(id: string): number {
  return seedFromId(id) % 360;
}
