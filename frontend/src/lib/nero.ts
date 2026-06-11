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

export const REACTIONS: Record<ReactionType, ReactionDef> = {
  drop: { id: 'drop', label: 'DROP', hue: 45, color: '#e2581c', weight: 1 },
  groove: { id: 'groove', label: 'GROOVE', hue: 320, color: '#c03296', weight: 1 },
  feels: { id: 'feels', label: 'FEELS', hue: 10, color: '#d62f3c', weight: 1 },
  wtf: { id: 'wtf', label: 'BANG', hue: 95, color: '#dd9c08', weight: 1 },
  chills: {
    id: 'chills',
    label: 'CHILLS',
    hue: 230,
    color: '#2b72c8',
    weight: 3,
    scarce: true,
  },
};

export const REACTION_ORDER: ReactionType[] = ['drop', 'groove', 'feels', 'wtf', 'chills'];

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
