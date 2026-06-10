// ============================================================
// NERO PARTY - DTO mappers + emit helpers
// Maps in-memory runtime objects to the wire DTOs in types.ts.
// ============================================================
import { computeResults, topGlyph } from '../ranking.js';
import { activePair, tally } from '../finale.js';
import type { MomentRuntime, Room, SongRuntime } from '../room/state.js';
import { currentSong } from '../room/state.js';
import type {
  CurrentDTO,
  FinaleState,
  LeaderRow,
  MomentDTO,
  ParticipantDTO,
  PartyDTO,
  ResultsDTO,
  Snapshot,
  SongDTO,
} from '../types.js';

export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

function nameOf(room: Room, participantId: string): string {
  return room.participants.get(participantId)?.name ?? 'someone';
}

export function toSongDTO(room: Room, s: SongRuntime): SongDTO {
  return {
    id: s.id,
    audiusId: s.audiusId,
    title: s.title,
    artist: s.artist,
    durationSec: s.durationSec,
    artworkUrl: s.artworkUrl,
    streamUrl: s.streamUrl,
    hue: s.hue,
    peaks: s.peaks,
    addedById: s.addedById,
    addedByName: nameOf(room, s.addedById),
    position: s.position,
    played: s.played,
    heat: s.heat,
    score: s.score,
    buckets: s.buckets,
    counts: s.counts,
    syncs: s.syncs,
    pins: s.pins.map((p) => ({ frac: p.frac, type: p.type, participantId: p.participantId })),
  };
}

export function toPartyDTO(room: Room): PartyDTO {
  return {
    joinCode: room.joinCode,
    name: room.name,
    lane: room.lane,
    maxSongs: room.maxSongs,
    chillsBudget: room.chillsBudget,
    songLengthMode: room.songLengthMode,
    phase: room.phase,
  };
}

export function toParticipantDTO(p: {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
}): ParticipantDTO {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    isBot: p.isBot,
    isHost: p.isHost,
    connected: p.connected,
  };
}

export function toLeaderboard(room: Room): LeaderRow[] {
  return room.songs.map((s) => ({
    songId: s.id,
    score: s.score,
    played: s.played,
    live: s.position === room.idx && room.phase === 'party',
  }));
}

export function toCurrentDTO(room: Room): CurrentDTO | null {
  if (room.phase !== 'party') return null;
  const s = currentSong(room);
  if (!s) return null;
  return {
    idx: room.idx,
    total: room.songs.length,
    serverTime: Date.now(),
    positionMs: room.positionMs,
    effectiveDurationMs: room.effectiveDurationMs,
    clipStartMs: room.clipStartMs,
    mode: room.songLengthMode,
    song: toSongDTO(room, s),
  };
}

export function toMomentDTO(m: MomentRuntime): MomentDTO {
  return {
    songId: m.song.id,
    title: m.song.title,
    artist: m.song.artist,
    hue: m.song.hue,
    audiusId: m.song.audiusId,
    artworkUrl: m.song.artworkUrl,
    streamUrl: m.song.streamUrl,
    durationSec: m.song.durationSec,
    frac: m.frac,
    ts: fmtTime(m.frac * m.song.durationSec),
    heat: m.heat,
    buckets: m.song.buckets,
    glyph: topGlyph(m),
  };
}

export function toFinaleState(room: Room): FinaleState | null {
  const f = room.finale;
  if (!f) return null;
  const pair = activePair(f);
  return {
    stage: f.stage,
    round: f.round,
    matchCount: f.bracket.length,
    pair: pair ? [toMomentDTO(pair[0]), toMomentDTO(pair[1])] : null,
    votes: tally(f),
    decided: f.decided,
  };
}

export function buildResultsDTO(room: Room): ResultsDTO {
  const raw = computeResults(room);
  const moment = room.finale?.crownedMoment ?? raw.moments[0] ?? null;
  return {
    songOfNight: raw.ranked[0] ? toSongDTO(room, raw.ranked[0]) : null,
    momentOfNight: moment ? toMomentDTO(moment) : null,
    ranked: raw.ranked.map((s) => toSongDTO(room, s)),
    superlatives: raw.superlatives
      .filter((sl) => sl.song)
      .map((sl) => ({
        key: sl.key,
        desc: sl.desc,
        songTitle: sl.song!.title,
        stat: sl.stat,
      })),
  };
}

export function toSnapshot(room: Room, participantId: string): Snapshot {
  const me = room.participants.get(participantId);
  return {
    party: toPartyDTO(room),
    you: {
      participantId,
      name: me?.name ?? '',
      color: me?.color ?? '#E8743B',
      isHost: me?.isHost ?? false,
      chillsLeft: me?.chillsLeft ?? 0,
    },
    participants: [...room.participants.values()].map(toParticipantDTO),
    songs: room.songs.map((s) => toSongDTO(room, s)),
    current: toCurrentDTO(room),
    leaderboard: toLeaderboard(room),
    finale: toFinaleState(room),
    results: room.phase === 'coronation' ? buildResultsDTO(room) : null,
    awaitingMore: room.awaitingMore,
    paused: room.paused,
  };
}
