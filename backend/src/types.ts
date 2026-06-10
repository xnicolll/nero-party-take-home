// ============================================================
// NERO PARTY - shared DTOs + socket event payloads
// Mirrored on the frontend (frontend/src/lib/types.ts).
// ============================================================
import type { ReactionType } from './constants.js';
import type { Peak } from './lib/waveform.js';

export type Phase = 'lobby' | 'party' | 'finale' | 'coronation';
export type SongLengthMode = 'full' | 'clip';

// A normalized track (search/trending results).
export interface Track {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  artworkUrl: string | null;
  genre: string | null;
  streamUrl: string;
  hue: number;
}

export interface ParticipantDTO {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
}

export interface SongDTO {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  durationSec: number;
  artworkUrl: string | null;
  streamUrl: string;
  hue: number;
  peaks: Peak[];
  addedById: string;
  addedByName: string;
  position: number;
  played: boolean;
  // live aggregates (for played + current songs)
  heat: number;
  score: number;
  buckets: number[];
  counts: Partial<Record<ReactionType, number>>;
  syncs: number;
  pins: PinDTO[];
}

export interface PartyDTO {
  joinCode: string;
  name: string;
  lane: string;
  maxSongs: number;
  chillsBudget: number;
  songLengthMode: SongLengthMode;
  phase: Phase;
}

export interface CurrentDTO {
  idx: number;
  total: number;
  serverTime: number;
  positionMs: number;
  effectiveDurationMs: number;
  clipStartMs: number;
  mode: SongLengthMode;
  song: SongDTO;
}

export interface LeaderRow {
  songId: string;
  score: number;
  played: boolean;
  live: boolean;
}

export interface PinDTO {
  frac: number;
  type: ReactionType;
  participantId: string;
}

export interface MomentDTO {
  songId: string;
  title: string;
  artist: string;
  hue: number;
  trackId: string;
  artworkUrl: string | null;
  streamUrl: string;
  durationSec: number;
  frac: number;
  ts: string; // formatted timestamp
  heat: number;
  buckets: number[];
  glyph: ReactionType; // dominant reaction near the moment
}

export interface FinaleState {
  stage: 'semi' | 'final' | 'done';
  round: number;
  matchCount: number;
  pair: [MomentDTO, MomentDTO] | null;
  votes: [number, number];
  decided: 0 | 1 | null;
}

export interface Superlative {
  key: string;
  desc: string;
  songTitle: string;
  stat: string;
}

export interface ResultsDTO {
  songOfNight: SongDTO | null;
  momentOfNight: MomentDTO | null;
  ranked: SongDTO[];
  superlatives: Superlative[];
}

export interface Snapshot {
  party: PartyDTO;
  you: { participantId: string; name: string; color: string; isHost: boolean; chillsLeft: number };
  participants: ParticipantDTO[];
  songs: SongDTO[];
  current: CurrentDTO | null;
  leaderboard: LeaderRow[];
  finale: FinaleState | null;
  results: ResultsDTO | null;
  awaitingMore: boolean;
  paused: boolean;
}

export interface ReactionAdded {
  songId: string;
  participantId: string;
  participantName: string;
  type: ReactionType;
  frac: number;
  weight: number;
  color: string;
  glyph: string;
  isBot: boolean;
}
