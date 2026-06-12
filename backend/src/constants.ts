// ============================================================
// NERO PARTY - shared constants (reaction vocab, lanes, bots)
// kept in sync with the frontend so client + server agree.
// ============================================================

// v3: a single binary "like" plus the scarce "hype" (the greatest signal a guest
// can give, capped per party). Intensity comes from many likes landing together
// (a sync), not from distinct emotion types. The client draws the marks
// (ink heart / thumbs-down), so the defs carry no glyph or colour anymore.
export type ReactionType = 'like' | 'hype';

export interface ReactionDef {
  id: ReactionType;
  label: string;
  weight: number;
  scarce?: boolean;
}

export const REACTIONS: Record<ReactionType, ReactionDef> = {
  like: { id: 'like', label: 'like', weight: 1 },
  hype: { id: 'hype', label: 'hype', weight: 5, scarce: true },
};

export const REACTION_ORDER: ReactionType[] = ['like', 'hype'];

export function isReactionType(x: unknown): x is ReactionType {
  return typeof x === 'string' && x in REACTIONS;
}

// Genre lanes shown on the create screen. Mapped to iTunes search terms in itunes.ts.
export const LANES = ['Anything goes', 'Electronic', 'Indie / Alt', 'Hip-hop', 'Ambient'] as const;
export type Lane = (typeof LANES)[number];

// fake guests that auto-join (staggered) so the app works solo. max 3 used.
export const BOT_POOL = [
  { name: 'Maya', color: '#C2703E', joinAt: 2000 },
  { name: 'Theo', color: '#5F8A4E', joinAt: 4600 },
  { name: 'Priya', color: '#7E57A8', joinAt: 7400 },
];
export const MAX_BOTS = 3;

// the host's accent color.
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
