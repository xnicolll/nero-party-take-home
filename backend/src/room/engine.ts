// ============================================================
// NERO PARTY — authoritative engine
// The server is the clock. One tick loop per room advances playback, fires bot
// reactions, races the leaderboard, and drives finale -> coronation.
// ============================================================
import type { Server } from 'socket.io';
import { prisma } from '../db.js';
import {
  BOT_POOL,
  BUCKETS,
  BOT_VOTE_STAGGER_MS,
  CLIP_LEAD_MS,
  CLIP_MS,
  DECIDE_DELAY_MS,
  MAX_BOTS,
  POSITION_BROADCAST_MS,
  REACTIONS,
  TICK_MS,
  VOTE_DEADLINE_MS,
} from '../constants.js';
import type { ReactionType } from '../constants.js';
import { addReaction, computeResults, rankedOrder } from '../ranking.js';
import {
  advance,
  activePair,
  buildBracket,
  decideSide,
  expectedVoters,
  recordVote,
  tally,
} from '../finale.js';
import { buildSchedule, botVoteSide, windowPeaks } from './bots.js';
import { synthPeaks } from '../lib/waveform.js';
import { mulberry32 } from '../lib/prng.js';
import { getTrack, laneToGenre, trending } from '../services/audius.js';
import {
  buildResultsDTO,
  toCurrentDTO,
  toFinaleState,
  toLeaderboard,
  toSongDTO,
} from '../sockets/emit.js';
import type { MomentRuntime, Room, SongRuntime } from './state.js';
import { currentSong, registerRoom } from './state.js';
import type { Track } from '../types.js';

// Known-good Audius ids if trending ever fails (durations are reasonable).
const FALLBACK_TRACK_IDS = ['BqpPKMP', 'XBQQkmO', '937qObw', 'VRAJYZ9'];

function emitRoom(room: Room, event: string, payload: unknown): void {
  room.io.to(room.joinCode).emit(event, payload);
}

export function makeRuntimeSong(row: {
  id: string;
  audiusId: string;
  title: string;
  artist: string;
  durationSec: number;
  artworkUrl: string | null;
  streamUrl: string;
  hue: number;
  addedById: string;
  position: number;
  played: boolean;
}): SongRuntime {
  return {
    id: row.id,
    audiusId: row.audiusId,
    title: row.title,
    artist: row.artist,
    durationSec: row.durationSec,
    artworkUrl: row.artworkUrl,
    streamUrl: row.streamUrl,
    hue: row.hue,
    addedById: row.addedById,
    position: row.position,
    peaks: synthPeaks(row.audiusId, row.durationSec),
    heat: 0,
    score: 0,
    buckets: Array(BUCKETS).fill(0),
    counts: {},
    syncs: 0,
    pins: [],
    played: row.played,
  };
}

// ---- room + participant lifecycle ------------------------------
export function createRoom(
  io: Server,
  party: {
    id: string;
    joinCode: string;
    hostToken: string;
    name: string;
    lane: string;
    maxSongs: number;
    chillsBudget: number;
    songLengthMode: string;
  },
): Room {
  const room: Room = {
    io,
    partyId: party.id,
    joinCode: party.joinCode,
    hostToken: party.hostToken,
    name: party.name,
    lane: party.lane,
    maxSongs: party.maxSongs,
    chillsBudget: party.chillsBudget,
    songLengthMode: party.songLengthMode === 'clip' ? 'clip' : 'full',
    phase: 'lobby',
    songs: [],
    idx: 0,
    positionMs: 0,
    frac: 0,
    songStartServerTime: 0,
    clipStartMs: 0,
    effectiveDurationMs: 0,
    schedule: null,
    cursor: 0,
    recent: [],
    lastOrder: null,
    lastPositionBroadcast: 0,
    participants: new Map(),
    bots: BOT_POOL.slice(0, MAX_BOTS).map((b) => ({ ...b, id: null, spawned: false })),
    botChills: {},
    botTimers: [],
    partyStartTime: 0,
    finale: null,
    tick: null,
    emptySince: null,
  };
  registerRoom(room);
  return room;
}

export function addParticipantToRoom(
  room: Room,
  row: {
    id: string;
    name: string;
    color: string;
    isBot: boolean;
    isHost: boolean;
    chillsLeft: number;
  },
): void {
  room.participants.set(row.id, {
    id: row.id,
    name: row.name,
    color: row.color,
    isBot: row.isBot,
    isHost: row.isHost,
    chillsLeft: row.chillsLeft,
    socketIds: new Set(),
    connected: true,
  });
}

// Arm the staggered bot joins so the host watches them orbit in (design timing).
export function armBotTimers(room: Room): void {
  room.bots.forEach((bot) => {
    if (bot.spawned) return;
    const timer = setTimeout(() => void spawnBot(room, bot), bot.joinAt);
    room.botTimers.push(timer);
  });
}

async function spawnBot(
  room: Room,
  bot: { id: string | null; name: string; color: string; spawned: boolean },
): Promise<void> {
  if (bot.spawned || room.phase !== 'lobby') return;
  bot.spawned = true;
  const chills = room.chillsBudget + (room.chillsBudget > 3 ? 1 : 0);
  const row = await prisma.participant.create({
    data: {
      partyId: room.partyId,
      name: bot.name,
      color: bot.color,
      isBot: true,
      isHost: false,
      chillsLeft: chills,
    },
  });
  bot.id = row.id;
  room.botChills[row.id] = chills;
  addParticipantToRoom(room, row);
  emitRoom(room, 'participantJoined', {
    participant: {
      id: row.id,
      name: row.name,
      color: row.color,
      isBot: true,
      isHost: false,
      connected: true,
    },
  });
}

// ---- the shared reaction path (humans + bots) ------------------
function doReaction(
  room: Room,
  song: SongRuntime,
  participantId: string,
  type: ReactionType,
  frac: number,
  now: number,
  isBot: boolean,
): void {
  const res = addReaction(room, song, participantId, type, frac, now);
  const p = room.participants.get(participantId);
  const def = REACTIONS[type];
  // persist the event (fire and forget — heat is the in-memory projection)
  prisma.reaction
    .create({
      data: {
        partyId: room.partyId,
        songId: song.id,
        participantId,
        type,
        frac,
        positionMs: Math.round(frac * room.effectiveDurationMs),
        weight: def.weight,
        isBot,
      },
    })
    .catch(() => {});
  emitRoom(room, 'reactionAdded', {
    songId: song.id,
    participantId,
    participantName: p?.name ?? 'someone',
    type,
    frac,
    weight: def.weight,
    color: def.color,
    glyph: def.glyph,
    isBot,
  });
  if (res.sync) emitRoom(room, 'syncBurst', { songId: song.id, frac, serverTime: now });
}

// A human tap: stamp the live frac, guard scarce chills, then react.
export function humanReact(room: Room, participantId: string, type: ReactionType): void {
  if (room.phase !== 'party') return;
  const song = currentSong(room);
  if (!song) return;
  const p = room.participants.get(participantId);
  if (!p) return;
  if (type === 'chills') {
    if (p.chillsLeft <= 0) return;
    p.chillsLeft -= 1;
    prisma.participant
      .update({ where: { id: participantId }, data: { chillsLeft: p.chillsLeft } })
      .catch(() => {});
  }
  doReaction(room, song, participantId, type, room.frac, Date.now(), p.isBot);
}

// ---- playback ---------------------------------------------------
function botIds(room: Room): string[] {
  const ids: string[] = [];
  for (const p of room.participants.values()) if (p.isBot) ids.push(p.id);
  return ids;
}

function startSong(room: Room): void {
  const song = currentSong(room);
  if (!song) return;
  room.frac = 0;
  room.positionMs = 0;
  room.recent = [];

  const durMs = song.durationSec * 1000;
  let wp;
  if (room.songLengthMode === 'clip') {
    const hottest = [...song.peaks].sort((a, b) => b.w - a.w)[0] ?? { c: 0.5, w: 0.08 };
    const peakMs = hottest.c * durMs;
    room.effectiveDurationMs = Math.min(CLIP_MS, durMs);
    room.clipStartMs = Math.max(
      0,
      Math.min(peakMs - CLIP_LEAD_MS, durMs - room.effectiveDurationMs),
    );
    const startFrac = room.clipStartMs / durMs;
    const endFrac = (room.clipStartMs + room.effectiveDurationMs) / durMs;
    wp = windowPeaks(song.peaks, startFrac, endFrac);
  } else {
    room.clipStartMs = 0;
    room.effectiveDurationMs = durMs;
    wp = song.peaks;
  }

  room.schedule = buildSchedule(song.durationSec, wp, botIds(room), room.idx * 977, room.botChills);
  room.cursor = 0;
  room.songStartServerTime = Date.now();
  room.lastPositionBroadcast = 0;
  room.lastOrder = null;

  emitRoom(room, 'songChanged', toCurrentDTO(room));
}

function tick(room: Room): void {
  if (room.phase !== 'party') return;
  const song = currentSong(room);
  if (!song) return;
  const now = Date.now();

  room.positionMs = Math.min(now - room.songStartServerTime, room.effectiveDurationMs);
  room.frac = room.effectiveDurationMs > 0 ? room.positionMs / room.effectiveDurationMs : 1;

  // fire due bot reactions
  if (room.schedule) {
    while (room.cursor < room.schedule.length && room.schedule[room.cursor].t <= room.frac) {
      const e = room.schedule[room.cursor++];
      doReaction(room, song, e.participantId, e.type, e.t, now, true);
    }
  }

  // light position keepalive (~1/sec)
  if (now - room.lastPositionBroadcast > POSITION_BROADCAST_MS) {
    emitRoom(room, 'tick', { positionMs: room.positionMs, frac: room.frac, serverTime: now });
    room.lastPositionBroadcast = now;
  }

  // leaderboard only when the order changes
  const order = rankedOrder(room).join(',');
  if (order !== room.lastOrder) {
    room.lastOrder = order;
    emitRoom(room, 'leaderboardUpdate', { order: toLeaderboard(room) });
  }

  // song end -> next or finale
  if (room.positionMs >= room.effectiveDurationMs) {
    song.played = true;
    prisma.queuedSong.update({ where: { id: song.id }, data: { played: true } }).catch(() => {});
    if (room.idx + 1 < room.songs.length) {
      room.idx += 1;
      startSong(room);
    } else {
      enterFinale(room);
    }
  }
}

// Seed the queue from trending if no human added songs. Keep durations sane
// (1–7 min) so `full` mode isn't a 60-minute track.
async function seedQueue(room: Room): Promise<void> {
  const sane = (t: Track) => t.durationSec >= 60 && t.durationSec <= 420;
  let tracks: Track[] = (await trending(laneToGenre(room.lane), 18)).filter(sane);
  if (tracks.length < room.maxSongs) {
    // top up with genre-less trending if a narrow lane was thin
    const more = (await trending(undefined, 18)).filter(sane);
    for (const t of more) if (!tracks.find((x) => x.id === t.id)) tracks.push(t);
  }
  if (tracks.length === 0) {
    const fetched = await Promise.all(FALLBACK_TRACK_IDS.map((id) => getTrack(id)));
    tracks = fetched.filter((t): t is Track => t !== null);
  }
  const adder = botIds(room)[0] ?? [...room.participants.values()][0]?.id;
  if (!adder) return;
  for (const t of tracks.slice(0, room.maxSongs)) {
    await addSongToRoom(room, t, adder, /*silent*/ true);
  }
}

export async function addSongToRoom(
  room: Room,
  track: Track,
  addedById: string,
  silent = false,
): Promise<{ ok: boolean; reason?: string }> {
  if (room.songs.length >= room.maxSongs) return { ok: false, reason: 'Queue is full' };
  const position = room.songs.length;
  const row = await prisma.queuedSong.create({
    data: {
      partyId: room.partyId,
      position,
      audiusId: track.id,
      title: track.title,
      artist: track.artist,
      durationSec: track.durationSec,
      artworkUrl: track.artworkUrl,
      genre: track.genre,
      streamUrl: track.streamUrl,
      hue: track.hue,
      addedById,
    },
  });
  room.songs.push(makeRuntimeSong(row));
  if (!silent) emitRoom(room, 'queueUpdated', { songs: room.songs.map((s) => toSongDTO(room, s)) });
  return { ok: true };
}

export async function startParty(room: Room): Promise<{ ok: boolean; reason?: string }> {
  if (room.phase !== 'lobby') return { ok: false, reason: 'Already started' };
  const guests = [...room.participants.values()].filter((p) => !p.isHost).length;
  if (guests < 2) return { ok: false, reason: 'Need 2+ guests' };
  if (room.songs.length === 0) await seedQueue(room);
  if (room.songs.length === 0) return { ok: false, reason: 'No songs available' };

  room.phase = 'party';
  room.partyStartTime = Date.now();
  room.idx = 0;
  await prisma.party.update({ where: { id: room.partyId }, data: { phase: 'party' } });
  emitRoom(room, 'phaseChanged', { phase: 'party' });
  startSong(room);
  room.tick = setInterval(() => tick(room), TICK_MS);
  return { ok: true };
}

export function hostSkip(room: Room): void {
  if (room.phase !== 'party') return;
  const song = currentSong(room);
  if (!song) return;
  // flush remaining bot reactions (backdated) so a skipped song isn't cold
  if (room.schedule) {
    const now = Date.now() - 5000;
    while (room.cursor < room.schedule.length) {
      const e = room.schedule[room.cursor++];
      doReaction(room, song, e.participantId, e.type, e.t, now, true);
    }
  }
  song.played = true;
  prisma.queuedSong.update({ where: { id: song.id }, data: { played: true } }).catch(() => {});
  if (room.idx + 1 < room.songs.length) {
    room.idx += 1;
    startSong(room);
  } else {
    enterFinale(room);
  }
}

export function hostEnd(room: Room): void {
  if (room.phase !== 'party') return;
  const song = currentSong(room);
  if (song) {
    song.played = true;
    prisma.queuedSong.update({ where: { id: song.id }, data: { played: true } }).catch(() => {});
  }
  enterFinale(room);
}

// ---- finale -----------------------------------------------------
function enterFinale(room: Room): void {
  if (room.tick) {
    clearInterval(room.tick);
    room.tick = null;
  }
  room.phase = 'finale';
  prisma.party.update({ where: { id: room.partyId }, data: { phase: 'finale' } }).catch(() => {});

  const { moments } = computeResults(room);
  const bracket = buildBracket(moments);
  room.finale = {
    moments,
    bracket,
    stage: bracket.length ? 'semi' : 'done',
    round: 0,
    finalists: [],
    votes: new Map(),
    decided: null,
    deadline: Date.now() + VOTE_DEADLINE_MS,
    crownedMoment: null,
  };

  emitRoom(room, 'phaseChanged', { phase: 'finale' });

  if (bracket.length === 0) {
    crown(room, moments[0] ?? null);
    return;
  }
  emitRoom(room, 'finaleState', toFinaleState(room));
  beginMatch(room);
}

function beginMatch(room: Room): void {
  const f = room.finale;
  if (!f) return;
  f.deadline = Date.now() + VOTE_DEADLINE_MS;
  // bots trickle their votes
  const pair = activePair(f);
  if (!pair) return;
  const rnd = mulberry32(Math.floor(f.round * 7919 + pair[0].heat + pair[1].heat));
  const bots = [...room.participants.values()].filter((p) => p.isBot);
  bots.forEach((b, i) => {
    const timer = setTimeout(
      () => {
        const cur = room.finale;
        if (!cur || cur.decided !== null) return;
        const p2 = activePair(cur);
        if (!p2) return;
        recordVote(cur, b.id, botVoteSide(p2, rnd()));
        emitRoom(room, 'finaleState', toFinaleState(room));
        maybeResolve(room);
      },
      (i + 1) * BOT_VOTE_STAGGER_MS,
    );
    room.botTimers.push(timer);
  });
  // deadline fallback
  const dl = setTimeout(() => maybeResolve(room), VOTE_DEADLINE_MS + 200);
  room.botTimers.push(dl);
}

export function castVote(room: Room, participantId: string, side: 0 | 1): void {
  const f = room.finale;
  if (!f || f.decided !== null) return;
  recordVote(f, participantId, side);
  emitRoom(room, 'finaleState', toFinaleState(room));
  maybeResolve(room);
}

function maybeResolve(room: Room): void {
  const f = room.finale;
  if (!f || f.decided !== null) return;
  const [a, b] = tally(f);
  const voted = a + b;
  if (voted >= expectedVoters(room) || Date.now() >= f.deadline) {
    f.decided = decideSide(f);
    emitRoom(room, 'finaleState', toFinaleState(room));
    setTimeout(() => doAdvance(room), DECIDE_DELAY_MS);
  }
}

function doAdvance(room: Room): void {
  const f = room.finale;
  if (!f) return;
  const { crowned } = advance(f);
  if (f.stage === 'done') {
    crown(room, crowned ?? f.moments[0] ?? null);
    return;
  }
  emitRoom(room, 'finaleState', toFinaleState(room));
  beginMatch(room);
}

function crown(room: Room, moment: MomentRuntime | null): void {
  if (room.finale) room.finale.crownedMoment = moment;
  room.phase = 'coronation';
  const results = buildResultsDTO(room);
  prisma.party
    .update({ where: { id: room.partyId }, data: { phase: 'coronation' } })
    .catch(() => {});
  prisma.result
    .upsert({
      where: { partyId: room.partyId },
      create: { partyId: room.partyId, payload: JSON.stringify(results) },
      update: { payload: JSON.stringify(results) },
    })
    .catch(() => {});
  emitRoom(room, 'phaseChanged', { phase: 'coronation' });
  emitRoom(room, 'results', results);
}
