// ============================================================
// NERO PARTY - iTunes Search API music service
// Huge catalog, no auth. Tradeoff: 30s preview clips only (no full tracks).
// We proxy search through the backend and normalize fields; the client plays
// the preview URL directly in an <audio> element.
// ============================================================
import { hueFromId } from '../lib/prng.js';
import type { Track } from '../types.js';

const BASE = 'https://itunes.apple.com';
export const PREVIEW_SEC = 30; // iTunes previews are ~30s

async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`itunes ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// iTunes has no charts in the Search API, so a genre "lane" is just a search
// term. "Anything goes" leans on broad popular hits.
export function laneToGenre(lane: string): string {
  switch (lane) {
    case 'Electronic':
      return 'electronic';
    case 'Indie / Alt':
      return 'indie';
    case 'Hip-hop':
      return 'hip hop';
    default:
      return 'top hits'; // Anything goes
  }
}

// artworkUrl100 -> a crisper 600x600
function upscaleArt(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb?\.(jpg|png)/, '/600x600bb.$1');
}

function normalize(r: any): Track | null {
  if (!r || !r.previewUrl || !r.trackId) return null;
  const id = String(r.trackId);
  const fullSec = Math.round((r.trackTimeMillis ?? 0) / 1000);
  return {
    id,
    title: String(r.trackName ?? 'Untitled'),
    artist: String(r.artistName ?? 'Unknown'),
    // we only ever play the ~30s preview, so that is the song's length here
    durationSec: fullSec > 0 ? Math.min(PREVIEW_SEC, fullSec) : PREVIEW_SEC,
    artworkUrl: upscaleArt(r.artworkUrl100 ?? r.artworkUrl60),
    genre: r.primaryGenreName ?? null,
    streamUrl: String(r.previewUrl),
    hue: hueFromId(id),
  };
}

// short cache so repeated genre/artist lookups (seed + recs) don't burn the
// iTunes Search rate limit (~20 req/min/IP). Size-capped so it can't grow forever.
const cache = new Map<string, { tracks: Track[]; at: number }>();
const CACHE_TTL = 60_000;
const CACHE_MAX = 200;

export async function searchTracks(query: string, limit = 12): Promise<Track[]> {
  const q = query.trim();
  if (!q) return [];
  const key = `${q.toLowerCase()}:${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.tracks;
  const url = `${BASE}/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=${limit}`;
  try {
    const json = await fetchJson(url);
    const tracks = (json?.results ?? [])
      .map(normalize)
      .filter((t: Track | null): t is Track => t !== null);
    if (tracks.length) {
      if (cache.size >= CACHE_MAX) {
        const oldest = cache.keys().next().value; // Map keeps insertion order
        if (oldest) cache.delete(oldest);
      }
      cache.set(key, { tracks, at: Date.now() });
    }
    return tracks;
  } catch {
    return [];
  }
}

// No charts endpoint, so "trending" is a search for the lane's term.
export async function trending(term: string | undefined, limit = 12): Promise<Track[]> {
  return searchTracks(term || 'top hits', limit);
}

export async function getTrack(id: string): Promise<Track | null> {
  const url = `${BASE}/lookup?id=${encodeURIComponent(id)}&entity=song`;
  try {
    const json = await fetchJson(url);
    return normalize((json?.results ?? [])[0]);
  } catch {
    return null;
  }
}
