// ============================================================
// NERO PARTY - recommendations ("you might like")
// Audius has no track-similarity API, so we approximate from what the group
// liked: more from the winners' genres + more from the artists they vibed with.
// ============================================================
import { laneToGenre, searchTracks, trending } from './services/audius.js';
import type { Room } from './room/state.js';
import type { Track } from './types.js';

export interface Rec extends Track {
  reason: string;
}

export async function buildRecs(room: Room, limit = 6): Promise<Rec[]> {
  const ranked = [...room.songs].filter((s) => s.played).sort((a, b) => b.score - a.score);
  const top = (ranked.length ? ranked : room.songs).slice(0, 3);

  const exclude = new Set(room.songs.map((s) => s.audiusId));
  const genres = [...new Set(top.map((s) => s.genre).filter((g): g is string => !!g))];
  const artists = [...new Set(top.map((s) => s.artist).filter(Boolean))];
  const laneGenre = laneToGenre(room.lane);

  const out: Rec[] = [];
  const pushUnique = (tracks: Track[], reason: string, take: number) => {
    let added = 0;
    for (const t of tracks) {
      if (added >= take) break;
      if (exclude.has(t.id) || out.find((r) => r.id === t.id)) continue;
      out.push({ ...t, reason });
      exclude.add(t.id);
      added++;
    }
  };

  // more from the winning genre(s)
  const genreToUse = genres[0] ?? laneGenre;
  if (genreToUse) {
    const g = await trending(genreToUse, 14);
    pushUnique(
      g.filter((t) => t.durationSec >= 45 && t.durationSec <= 480),
      `more ${genreToUse.toLowerCase()}`,
      3,
    );
  }

  // more from the artists they vibed with
  for (const artist of artists.slice(0, 2)) {
    if (out.length >= limit) break;
    const r = await searchTracks(artist, 8);
    pushUnique(r, `like ${artist}`, 1);
  }

  // top up with general trending if thin
  if (out.length < limit) {
    const g = await trending(laneGenre, 14);
    pushUnique(
      g.filter((t) => t.durationSec >= 45 && t.durationSec <= 480),
      'on the rise',
      limit - out.length,
    );
  }

  return out.slice(0, limit);
}
