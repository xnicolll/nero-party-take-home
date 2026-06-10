// ============================================================
// NERO PARTY - in-memory room state (the authoritative live party)
// One Room per active party. Durable facts live in SQLite; the hot path
// (heat, position, sync window, bot schedules) lives here.
// ============================================================
import type { Server } from 'socket.io';
import type { ReactionType } from '../constants.js';
import type { Peak } from '../lib/waveform.js';
import type { Phase, SongLengthMode } from '../types.js';

export interface SongRuntime {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  durationSec: number;
  artworkUrl: string | null;
  streamUrl: string;
  hue: number;
  genre: string | null;
  addedById: string;
  position: number;
  peaks: Peak[];
  // hot-path aggregates (mirror the design's song object)
  heat: number;
  score: number;
  buckets: number[];
  counts: Partial<Record<ReactionType, number>>;
  syncs: number;
  pins: { frac: number; type: ReactionType; participantId: string; t: number }[];
  played: boolean;
}

export interface ParticipantState {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  isHost: boolean;
  chillsLeft: number;
  socketIds: Set<string>;
  connected: boolean;
}

export interface BotScheduleEvent {
  t: number; // frac 0..1 over the playable window
  participantId: string;
  type: ReactionType;
}

export interface MomentRuntime {
  song: SongRuntime;
  bucket: number;
  heat: number;
  frac: number;
}

export interface FinaleRuntime {
  moments: MomentRuntime[];
  bracket: [MomentRuntime, MomentRuntime][];
  stage: 'semi' | 'final' | 'done';
  round: number;
  finalists: MomentRuntime[];
  votes: Map<string, 0 | 1>; // participantId -> side for the active match
  decided: 0 | 1 | null;
  deadline: number;
  crownedMoment: MomentRuntime | null;
}

export interface Room {
  io: Server;
  partyId: string;
  joinCode: string;
  hostToken: string;

  name: string;
  lane: string;
  maxSongs: number;
  chillsBudget: number;
  songLengthMode: SongLengthMode;
  phase: Phase;

  songs: SongRuntime[];
  idx: number;
  positionMs: number;
  frac: number;
  songStartServerTime: number;
  clipStartMs: number;
  effectiveDurationMs: number;

  schedule: BotScheduleEvent[] | null;
  cursor: number;
  recent: { t: number; participantId: string; frac: number }[];
  lastOrder: string | null;
  lastPositionBroadcast: number;

  participants: Map<string, ParticipantState>;
  bots: { id: string | null; name: string; color: string; joinAt: number; spawned: boolean }[];
  botChills: Record<string, number>; // per-bot scarce-chills budget, spent across songs
  botTimers: NodeJS.Timeout[];
  partyStartTime: number;

  finale: FinaleRuntime | null;

  tick: NodeJS.Timeout | null;
  emptySince: number | null;
  awaitingMore: boolean; // queue exhausted, host deciding to add more or finish
  paused: boolean; // host paused playback for everyone
}

const byCode = new Map<string, Room>();
const byPartyId = new Map<string, Room>();

export function registerRoom(room: Room): void {
  byCode.set(room.joinCode, room);
  byPartyId.set(room.partyId, room);
}

export function getRoomByCode(code: string): Room | undefined {
  return byCode.get(code);
}

export function getRoomByPartyId(id: string): Room | undefined {
  return byPartyId.get(id);
}

export function destroyRoom(room: Room): void {
  if (room.tick) clearInterval(room.tick);
  room.botTimers.forEach(clearTimeout);
  byCode.delete(room.joinCode);
  byPartyId.delete(room.partyId);
}

export function allRooms(): Room[] {
  return [...byCode.values()];
}

export function currentSong(room: Room): SongRuntime | undefined {
  return room.songs[room.idx];
}

export function humanCount(room: Room): number {
  let n = 0;
  for (const p of room.participants.values()) if (!p.isBot) n++;
  return n;
}

export function connectedHumanCount(room: Room): number {
  let n = 0;
  for (const p of room.participants.values()) if (!p.isBot && p.connected) n++;
  return n;
}
