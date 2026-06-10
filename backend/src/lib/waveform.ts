import { mulberry32, seedFromId } from './prng.js';

export interface Peak {
  c: number; // center fraction 0..1
  w: number; // width fraction
}

// tracks ship no peak metadata, so we synthesize "peak zones" deterministically
// from (id, duration). load-bearing: bots cluster reactions near peaks + the
// client places pins against the same waveform.
export function synthPeaks(trackId: string, durationSec: number): Peak[] {
  const rnd = mulberry32(seedFromId(trackId) + durationSec);
  const n = 1 + Math.floor(rnd() * 2); // 1-2 peak zones
  const peaks: Peak[] = [];
  for (let i = 0; i < n; i++) {
    peaks.push({ c: 0.25 + rnd() * 0.6, w: 0.04 + rnd() * 0.05 });
  }
  return peaks.sort((a, b) => a.c - b.c);
}

// seeded waveform bars, taller inside the peak zones. the client regenerates
// these for render; the server uses peaks (not bars) for logic.
export function waveform(trackId: string, peaks: Peak[], n = 110): number[] {
  const rnd = mulberry32(seedFromId(trackId) + 7919);
  const bars: number[] = [];
  let prev = 0.4;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    let peakBoost = 0;
    for (const p of peaks) {
      const d = Math.abs(f - p.c) / p.w;
      peakBoost = Math.max(peakBoost, Math.exp(-d * d) * 0.55);
    }
    const target = 0.22 + rnd() * 0.38 + peakBoost;
    prev = prev * 0.55 + target * 0.45;
    bars.push(Math.min(1, prev * (0.85 + rnd() * 0.3)));
  }
  return bars;
}
