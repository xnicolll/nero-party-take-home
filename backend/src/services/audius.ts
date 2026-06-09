// ============================================================
// NERO PARTY — Audius music service
// No API key required; every call carries app_name. We proxy search/trending
// (keeps app_name server-side, normalizes fields). The client plays the direct
// stream URL — Audius 302-redirects it to a CORS-`*` audio file.
// ============================================================
import { env } from '../env.js';
import { hueFromId } from '../lib/prng.js';
import type { Track } from '../types.js';

const SELECTOR = 'https://api.audius.co';
const APP = env.AUDIUS_APP_NAME;

let cachedHost: { host: string; at: number } | null = null;
const HOST_TTL = 5 * 60_000;

// Resolve a healthy discovery node (selector returns data[0]); cache 5min.
async function resolveHost(): Promise<string> {
  if (cachedHost && Date.now() - cachedHost.at < HOST_TTL) return cachedHost.host;
  try {
    const res = await fetchJson(`${SELECTOR}`, 4000);
    const host = res?.data?.[0];
    if (typeof host === 'string') {
      cachedHost = { host, at: Date.now() };
      return host;
    }
  } catch {
    /* fall through */
  }
  cachedHost = { host: SELECTOR, at: Date.now() };
  return SELECTOR;
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`audius ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Genre lane -> Audius genre filter. "Anything goes" omits the filter.
export function laneToGenre(lane: string): string | undefined {
  switch (lane) {
    case 'Electronic':
      return 'Electronic';
    case 'Indie / Alt':
      return 'Alternative';
    case 'Hip-hop':
      return 'Hip-Hop/Rap';
    case 'Ambient':
      return 'Ambient';
    default:
      return undefined; // Anything goes
  }
}

export function streamUrl(audiusId: string): string {
  return `${SELECTOR}/v1/tracks/${audiusId}/stream?app_name=${encodeURIComponent(APP)}`;
}

function normalize(t: any): Track | null {
  if (!t || !t.id || t.is_delete || t.is_stream_gated) return null;
  const art = t.artwork || {};
  return {
    id: String(t.id),
    title: String(t.title ?? 'Untitled'),
    artist: String(t.user?.name ?? t.user?.handle ?? 'Unknown'),
    durationSec: Math.max(1, Math.round(t.duration ?? 0)),
    artworkUrl: art['480x480'] || art['150x150'] || art['1000x1000'] || null,
    genre: t.genre ?? null,
    streamUrl: streamUrl(String(t.id)),
    hue: hueFromId(String(t.id)),
  };
}

export async function searchTracks(query: string, limit = 12): Promise<Track[]> {
  if (!query.trim()) return [];
  const host = await resolveHost();
  const url = `${host}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=${encodeURIComponent(
    APP,
  )}&limit=${limit}`;
  try {
    const json = await fetchJson(url);
    return (json?.data ?? [])
      .map(normalize)
      .filter((t: Track | null): t is Track => t !== null)
      .filter((t: Track) => t.durationSec >= 30); // skip tiny clips/sfx
  } catch {
    return [];
  }
}

export async function trending(genre: string | undefined, limit = 12): Promise<Track[]> {
  const host = await resolveHost();
  const g = genre ? `&genre=${encodeURIComponent(genre)}` : '';
  const url = `${host}/v1/tracks/trending?app_name=${encodeURIComponent(APP)}${g}&limit=${limit}`;
  try {
    const json = await fetchJson(url);
    return (json?.data ?? [])
      .map(normalize)
      .filter((t: Track | null): t is Track => t !== null)
      .filter((t: Track) => t.durationSec >= 30);
  } catch {
    return [];
  }
}

// Fetch one track by id (for addSong by id).
export async function getTrack(audiusId: string): Promise<Track | null> {
  const host = await resolveHost();
  const url = `${host}/v1/tracks/${audiusId}?app_name=${encodeURIComponent(APP)}`;
  try {
    const json = await fetchJson(url);
    return normalize(json?.data);
  } catch {
    return null;
  }
}
