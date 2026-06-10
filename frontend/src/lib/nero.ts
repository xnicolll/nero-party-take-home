// ============================================================
// NERO PARTY - shared client constants + helpers
// The non-simulation parts of the design's nero-data.js. The simulation
// (friends, schedules, results) now lives on the server.
// ============================================================
import type { Peak, ReactionType } from './types';

export interface ReactionDef {
  id: ReactionType;
  label: string;
  glyph: string;
  color: string;
  weight: number;
  scarce?: boolean;
}

export const REACTIONS: Record<ReactionType, ReactionDef> = {
  drop: { id: 'drop', label: 'DROP', glyph: '▲', color: 'oklch(0.6 0.16 45)', weight: 1 },
  groove: { id: 'groove', label: 'GROOVE', glyph: '◆', color: 'oklch(0.6 0.16 320)', weight: 1 },
  feels: { id: 'feels', label: 'FEELS', glyph: '●', color: 'oklch(0.6 0.16 10)', weight: 1 },
  wtf: { id: 'wtf', label: 'WTF', glyph: '✶', color: 'oklch(0.6 0.13 95)', weight: 1 },
  chills: {
    id: 'chills',
    label: 'CHILLS',
    glyph: '◎',
    color: 'oklch(0.58 0.12 230)',
    weight: 3,
    scarce: true,
  },
};

export const REACTION_ORDER: ReactionType[] = ['drop', 'groove', 'feels', 'wtf', 'chills'];

export const LANES = ['Anything goes', 'Electronic', 'Indie / Alt', 'Hip-hop'];

// Hero word cycle (design).
export const CYCLE_WORDS = [
  'party',
  'listen',
  'dance',
  'chill',
  'vibe',
  'groove',
  'sync',
  'react',
  'queue',
  'crown',
];

// Seeded PRNG - verbatim from the design (and the backend), so the client
// regenerates the same waveform the server reasoned about.
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

export function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Regenerate the waveform bars from (trackId, peaks) - must match the server.
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

export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

export const API_BASE = 'http://localhost:3000';
