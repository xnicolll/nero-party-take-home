// Mirror of the backend's wire DTOs (backend/src/types.ts).
export type Phase = 'landing' | 'create' | 'lobby' | 'party' | 'finale' | 'coronation';
export type ServerPhase = 'lobby' | 'party' | 'finale' | 'coronation';
export type ReactionType = 'drop' | 'groove' | 'feels' | 'wtf' | 'chills';

export interface Peak {
  c: number;
  w: number;
}

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

export interface PinDTO {
  frac: number;
  type: ReactionType;
  participantId: string;
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
  heat: number;
  score: number;
  buckets: number[];
  bucketsByType: Record<ReactionType, number[]>;
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
  phase: ServerPhase;
}

export interface CurrentDTO {
  idx: number;
  total: number;
  serverTime: number;
  positionMs: number;
  effectiveDurationMs: number;
  clipStartMs: number;
  song: SongDTO;
}

export interface LeaderRow {
  songId: string;
  score: number;
  played: boolean;
  live: boolean;
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
  ts: string;
  heat: number;
  buckets: number[];
  bucketsByType: Record<ReactionType, number[]>;
  glyph: ReactionType;
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
  you: {
    participantId: string;
    name: string;
    color: string;
    isHost: boolean;
    chillsLeft: number;
    rejoinToken: string;
  };
  participants: ParticipantDTO[];
  songs: SongDTO[];
  current: CurrentDTO | null;
  leaderboard: LeaderRow[];
  finale: FinaleState | null;
  results: ResultsDTO | null;
  awaitingMore: boolean;
  paused: boolean;
}

export interface Rec extends Track {
  reason: string;
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

export interface SyncBurst {
  songId: string;
  frac: number;
  serverTime: number;
}

export interface TickPayload {
  positionMs: number;
  frac: number;
  serverTime: number;
}
