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

// --- diversity: keep walls + recs from repeating a cover, a song, or one
// artist. iTunes search is deterministic, so without this the same faces
// surface every time and one album's tracks crowd the page. ---

// collapse the size segment so every size of one cover maps to a single key
function artKey(url: string | null | undefined): string {
  return url ? url.replace(/\/\d+x\d+bb?\.(jpg|png)/, '/x') : '';
}

// normalize a title so "Song", "Song (Remastered)", "Song - Live", and
// "Song feat. X" all collapse to the same song
function songKey(t: Track): string {
  const title = t.title
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/\s-\s.*$/, '')
    .replace(/feat\.?.*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return `${t.artist.toLowerCase().trim()}::${title}`;
}

export interface DiversifyOpts {
  maxPerArtist?: number;
  limit?: number;
}

// one cover per album, one entry per song, optional per-artist cap; input
// order is preserved (so the most relevant survives a clash). Generic so the
// caller's richer type (e.g. Rec) is preserved.
export function diversify<T extends Track>(tracks: T[], opts: DiversifyOpts = {}): T[] {
  const maxPerArtist = opts.maxPerArtist ?? Infinity;
  const seenArt = new Set<string>();
  const seenSong = new Set<string>();
  const perArtist = new Map<string, number>();
  const out: T[] = [];
  for (const t of tracks) {
    const ak = artKey(t.artworkUrl);
    const sk = songKey(t);
    const artist = t.artist.toLowerCase().trim();
    if (ak && seenArt.has(ak)) continue;
    if (seenSong.has(sk)) continue;
    const used = perArtist.get(artist) ?? 0;
    if (used >= maxPerArtist) continue;
    if (ak) seenArt.add(ak);
    seenSong.add(sk);
    perArtist.set(artist, used + 1);
    out.push(t);
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}

// shuffle a copy and take n, so a fresh mix surfaces on each visit
function sample<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// No charts endpoint, so "trending" searches the lane term over a large pool,
// strips repeats (same cover/song, at most two per artist), then samples a
// fresh mix each call so the wall + recs never look the same twice.
const TREND_POOL = 120;
export async function trending(term: string | undefined, limit = 12): Promise<Track[]> {
  const pool = await searchTracks(term || 'top hits', TREND_POOL);
  return sample(diversify(pool, { maxPerArtist: 2 }), limit);
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
