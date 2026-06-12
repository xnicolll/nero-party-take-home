// ============================================================
// NERO PARTY - heat / sync / results algorithm
// runs server-side so every client + bot agrees. heat is normalized
// per-minute so long songs don't auto-win; 3+ distinct people within
// 1.6s = a "sync" bonus.
// ============================================================
import { BUCKETS, REACTIONS, SYNC_BONUS, SYNC_DISTINCT, SYNC_WINDOW_MS } from './constants.js';
import type { ReactionType } from './constants.js';
import type { MomentRuntime, Room, SongRuntime } from './room/state.js';

export interface AddResult {
  bucket: number;
  sync: boolean;
}

// Mutates song + room.recent. Returns whether this reaction triggered a sync so
// the caller can emit a burst. Identical math for humans and bots.
export function addReaction(
  room: Room,
  song: SongRuntime,
  participantId: string,
  type: ReactionType,
  frac: number,
  now: number,
): AddResult {
  const w = REACTIONS[type].weight;
  song.pins.push({ frac, type, participantId, t: now });
  song.counts[type] = (song.counts[type] || 0) + 1;
  song.heat += w;
  const b = Math.min(BUCKETS - 1, Math.floor(frac * BUCKETS));
  song.buckets[b] += w;
  song.bucketsByType[type][b] += w;

  room.recent = room.recent.filter((r) => now - r.t < SYNC_WINDOW_MS);
  room.recent.push({ t: now, participantId, frac });
  const distinct = new Set(room.recent.map((r) => r.participantId));

  let sync = false;
  if (distinct.size >= SYNC_DISTINCT) {
    song.heat += SYNC_BONUS;
    song.buckets[b] += SYNC_BONUS;
    song.syncs += 1;
    room.recent = [];
    sync = true;
  }
  // score = likes + sync bonuses + hype weight. Every song gets the same ~30s
  // preview, so raw heat is already a fair comparison (no per-minute scaling).
  song.score = song.heat;
  return { bucket: b, sync };
}

// Songs that are played or currently live, ranked by score. Returns ids.
export function rankedOrder(room: Room): string[] {
  return [...room.songs]
    .filter((s) => s.played || s.position === room.idx)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.id);
}

function slowBurn(s: SongRuntime): number {
  const mean = s.heat / BUCKETS || 1;
  return -(Math.max(...s.buckets) / mean); // less peaky => slower burn
}

export interface RawSuperlative {
  key: string;
  desc: string;
  song: SongRuntime | undefined;
  stat: string;
}

export interface RawResults {
  ranked: SongRuntime[];
  moments: MomentRuntime[];
  superlatives: RawSuperlative[];
}

export function computeResults(room: Room): RawResults {
  const played = room.songs.filter((s) => s.played);
  const ranked = [...played].sort((a, b) => b.score - a.score);

  // Moment of the Night candidates: the hottest single seconds across ALL songs
  // (best 2 buckets per song, top 4 overall). This is independent of total heat,
  // so the best MOMENT can crown a different song than Song of the Night.
  const cand: MomentRuntime[] = [];
  played.forEach((s) => {
    s.buckets
      .map((v, i) => ({ v, i }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 2)
      .forEach(({ v, i }) => {
        if (v > 0) cand.push({ song: s, bucket: i, heat: v, frac: (i + 0.5) / BUCKETS });
      });
  });
  cand.sort((a, b) => b.heat - a.heat);
  // diversity first: the best moment of each song, then second-bests fill
  // the gaps, so the playoff never has to pit a song against itself
  const moments: MomentRuntime[] = [];
  const perSong: Record<string, number> = {};
  for (const pass of [1, 2]) {
    for (const c of cand) {
      if (moments.length === 4) break;
      if (moments.includes(c)) continue;
      if ((perSong[c.song.id] || 0) >= pass) continue;
      perSong[c.song.id] = (perSong[c.song.id] || 0) + 1;
      moments.push(c);
    }
  }

  const by = (fn: (s: SongRuntime) => number): SongRuntime | undefined =>
    [...played].sort((a, b) => fn(b) - fn(a))[0];

  const peakOf = (s: SongRuntime): number => Math.max(0, ...s.buckets);
  const superlatives: RawSuperlative[] = [
    {
      key: 'CROWD FAVOURITE',
      desc: 'the most likes of the night',
      song: by((s) => s.counts.like || 0),
      stat: '',
    },
    { key: 'BIGGEST PEAK', desc: 'the loudest single moment', song: by(peakOf), stat: '' },
    { key: 'MOST SYNCED', desc: 'the room hit it together most', song: by((s) => s.syncs), stat: '' },
    { key: 'SLOW BURNER', desc: 'loved end to end', song: by(slowBurn), stat: '' },
  ];
  // Fill stat strings (need the chosen song).
  if (superlatives[0].song) superlatives[0].stat = `${superlatives[0].song.counts.like || 0} likes`;
  if (superlatives[1].song)
    superlatives[1].stat = `peak of ${peakOf(superlatives[1].song).toFixed(0)}`;
  if (superlatives[2].song) superlatives[2].stat = `${superlatives[2].song.syncs} synced moments`;
  if (superlatives[3].song) superlatives[3].stat = `${superlatives[3].song.heat.toFixed(0)} total`;

  return { ranked, moments, superlatives };
}

// dominant reaction type near a moment (for the moment glyph).
export function topGlyph(moment: MomentRuntime): ReactionType {
  const near = moment.song.pins.filter((p) => Math.abs(p.frac - moment.frac) < 0.06);
  const counts: Partial<Record<ReactionType, number>> = {};
  near.forEach((p) => (counts[p.type] = (counts[p.type] || 0) + 1));
  const best = (Object.keys(counts) as ReactionType[]).sort(
    (a, b) => (counts[b] || 0) - (counts[a] || 0),
  )[0];
  return best || 'like';
}
