// ============================================================
// NERO PARTY - shared client constants + helpers
// just the static bits (reactions, lanes, helpers); the live simulation
// (bots, schedules, results) lives on the server.
// ============================================================
import type { ReactionType } from './types';

export interface ReactionDef {
  id: ReactionType;
  label: string;
  hue: number; // the reaction's place on the spectrum (field + ribbons)
  color: string; // bright enough to read as light on the dark room
  weight: number;
  scarce?: boolean;
}

// v3: a binary like + the scarce hype. Colours are the ink marks' fills on the
// neon party (a warm heart, a gold hype); dislike is the cool teal, handled
// separately as a skip vote. Tuned against the orange bg in the layout pass.
export const REACTIONS: Record<ReactionType, ReactionDef> = {
  like: { id: 'like', label: 'like', hue: 345, color: '#ff3d7f', weight: 1 },
  hype: { id: 'hype', label: 'hype', hue: 45, color: '#ffd23f', weight: 5, scarce: true },
};

export const REACTION_ORDER: ReactionType[] = ['like', 'hype'];

export const LANES = ['Anything goes', 'Electronic', 'Indie / Alt', 'Hip-hop'];

// the wordmark suffix cycle: nero.party, nero.listen, nero.dance…
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

export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

export const API_BASE = 'http://localhost:3000';
