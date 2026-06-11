// ============================================================
// NERO PARTY - recommendations ("you might like")
// iTunes has no track-similarity API, so we approximate from what the group
// liked: more from the winners' genres + more from the artists they vibed with.
// ============================================================
import { diversify, laneToGenre, searchTracks, trending } from './services/itunes.js';
import type { Room } from './room/state.js';
import type { Track } from './types.js';

export interface Rec extends Track {
  reason: string;
}

export async function buildRecs(room: Room, limit = 6): Promise<Rec[]> {
  const ranked = [...room.songs].filter((s) => s.played).sort((a, b) => b.score - a.score);
  const top = (ranked.length ? ranked : room.songs).slice(0, 3);

  const played = new Set(room.songs.map((s) => s.trackId));
  const genres = [...new Set(top.map((s) => s.genre).filter((g): g is string => !!g))];
  const artists = [...new Set(top.map((s) => s.artist).filter(Boolean))];
  const laneGenre = laneToGenre(room.lane);

  // gather generously from every angle, then let diversify pick the final set
  const cand: Rec[] = [];
  const add = (tracks: Track[], reason: string, take: number) => {
    let n = 0;
    for (const t of tracks) {
      if (n >= take) break;
      if (played.has(t.id)) continue;
      cand.push({ ...t, reason });
      n++;
    }
  };

  const genreToUse = genres[0] ?? laneGenre;
  if (genreToUse) add(await trending(genreToUse, 18), `more ${genreToUse.toLowerCase()}`, 8);
  for (const artist of artists.slice(0, 3)) add(await searchTracks(artist, 8), `like ${artist}`, 2);
  add(await trending(laneGenre, 18), 'on the rise', 18);

  // one cover, one song, one per artist - and never something already played
  return diversify(cand, { maxPerArtist: 1, limit });
}
