// ============================================================
// NERO PARTY - shared constants (reaction vocab, lanes, bots)
// Ported from the design's nero-data.js so client + server agree.
// ============================================================

export type ReactionType = 'drop' | 'groove' | 'feels' | 'wtf' | 'chills';

export interface ReactionDef {
  id: ReactionType;
  label: string;
  glyph: string;
  color: string;
  weight: number;
  scarce?: boolean;
}

// Curated, not generic emoji. OKLCH colors carry over verbatim from the design.
export const REACTIONS: Record<ReactionType, ReactionDef> = {
  drop: { id: 'drop', label: 'DROP', glyph: '🫳', color: 'oklch(0.6 0.16 45)', weight: 1 },
  groove: { id: 'groove', label: 'GROOVE', glyph: '🎶', color: 'oklch(0.6 0.16 320)', weight: 1 },
  feels: { id: 'feels', label: 'FEELS', glyph: '🥹', color: 'oklch(0.6 0.16 10)', weight: 1 },
  wtf: { id: 'wtf', label: 'BANG', glyph: '💥', color: 'oklch(0.6 0.13 95)', weight: 1 },
  chills: {
    id: 'chills',
    label: 'CHILLS',
    glyph: '🧊',
    color: 'oklch(0.58 0.12 230)',
    weight: 3,
    scarce: true,
  },
};

export const REACTION_ORDER: ReactionType[] = ['drop', 'groove', 'feels', 'wtf', 'chills'];

export function isReactionType(x: unknown): x is ReactionType {
  return typeof x === 'string' && x in REACTIONS;
}

// Genre lanes shown on the create screen. Mapped to iTunes search terms in itunes.ts.
export const LANES = ['Anything goes', 'Electronic', 'Indie / Alt', 'Hip-hop', 'Ambient'] as const;
export type Lane = (typeof LANES)[number];

// Bot identities (names + colors from the design's FRIENDS). Max 3 used.
export const BOT_POOL = [
  { name: 'Maya', color: '#C2703E', joinAt: 2000 },
  { name: 'Theo', color: '#5F8A4E', joinAt: 4600 },
  { name: 'Priya', color: '#7E57A8', joinAt: 7400 },
];
export const MAX_BOTS = 3;

// Color for the host ("You" accent in the design).
export const HOST_COLOR = '#E8743B';

// Colors handed to additional human guests, cycled.
export const GUEST_COLORS = ['#41769E', '#A8862E', '#3E8A7A', '#B5527A', '#6E6BBd'];

// Engine tuning.
export const BUCKETS = 48; // heat resolution along a song
export const TICK_MS = 150; // authoritative loop cadence
export const SYNC_WINDOW_MS = 1600; // 3+ distinct people within this => sync
export const SYNC_DISTINCT = 3;
export const SYNC_BONUS = 3;
export const POSITION_BROADCAST_MS = 1000; // light position keepalive cadence

// Finale timing.
export const VOTE_DEADLINE_MS = 12_000; // auto-resolve a match if not everyone voted
export const DECIDE_DELAY_MS = 1600; // pause on the result before advancing
export const BOT_VOTE_STAGGER_MS = 520; // bots trickle their votes in

// Room cleanup: drop a room with no connected humans after this long.
export const ROOM_TTL_MS = 10 * 60_000;

// Join code wordlist (after-hours / analog flavor).
export const CODE_WORDS = [
  'EMBER',
  'VINYL',
  'NEON',
  'DUSK',
  'ECHO',
  'MIDNIGHT',
  'STATIC',
  'VELVET',
  'AMBER',
  'LUNAR',
  'HAZE',
  'COBALT',
];
