// ============================================================
// NERO PARTY - authoritative engine
// The server is the clock. One tick loop per room advances playback, fires bot
// reactions, races the leaderboard, and drives finale -> coronation.
// ============================================================
import { randomUUID } from 'crypto';
import type { Server } from 'socket.io';
import { prisma } from '../db.js';
import {
  BOT_POOL,
  BUCKETS,
  BOT_VOTE_STAGGER_MS,
  DECIDE_DELAY_MS,
  MAX_BOTS,
  POSITION_BROADCAST_MS,
  REACTIONS,
  REACTION_ORDER,
  ROOM_TTL_MS,
  SYNC_WINDOW_MS,
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
import { buildSchedule, botVoteSide } from './bots.js';
import { synthPeaks } from '../lib/waveform.js';
import { mulberry32 } from '../lib/prng.js';
import {
  buildResultsDTO,
  toCurrentDTO,
  toFinaleState,
  toLeaderboard,
  toSongDTO,
} from '../sockets/emit.js';
import type { MomentRuntime, Room, SongRuntime } from './state.js';
import { allRooms, connectedHumanCount, currentSong, destroyRoom, registerRoom } from './state.js';
import type { Track } from '../types.js';

function emitRoom(room: Room, event: string, payload: unknown): void {
  room.io.to(room.joinCode).emit(event, payload);
}

export function makeRuntimeSong(row: {
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
  played: boolean;
}): SongRuntime {
  return {
    id: row.id,
    trackId: row.trackId,
    title: row.title,
    artist: row.artist,
    durationSec: row.durationSec,
    artworkUrl: row.artworkUrl,
    streamUrl: row.streamUrl,
    hue: row.hue,
    genre: row.genre,
    addedById: row.addedById,
    position: row.position,
    peaks: synthPeaks(row.trackId, row.durationSec),
    heat: 0,
    score: 0,
    buckets: Array(BUCKETS).fill(0),
    bucketsByType: Object.fromEntries(
      REACTION_ORDER.map((t) => [t, Array(BUCKETS).fill(0)]),
    ) as Record<ReactionType, number[]>,
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
    awaitingMore: false,
    paused: false,
    dislikes: new Set(),
    dislikeTimers: [],
    skipping: false,
    skipTimer: null,
    finaleTimers: [],
  };
  registerRoom(room);
  return room;
}

// Periodically drop rooms that have had no connected humans for a while, so the
// in-memory maps + their tick/bot/finale timers don't leak forever.
export function startRoomSweep(): void {
  setInterval(() => {
    const now = Date.now();
    for (const room of allRooms()) {
      if (connectedHumanCount(room) > 0) {
        room.emptySince = null;
      } else if (room.emptySince == null) {
        room.emptySince = now;
      } else if (now - room.emptySince > ROOM_TTL_MS) {
        destroyRoom(room);
      }
    }
  }, 30_000).unref?.();
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
    rejoinToken: randomUUID(),
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
  // instant parties skip the lobby, so bots drop in mid-song too
  if (bot.spawned || (room.phase !== 'lobby' && room.phase !== 'party')) return;
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
  // a bot that lands mid-song warms up on it: slot 1-2 reactions into what's
  // left of the schedule (kept sorted; the tick loop fires them naturally)
  if (room.phase === 'party' && room.schedule) {
    const rnd = mulberry32(room.idx * 977 + row.id.length * 131 + room.schedule.length);
    const remaining = 1 - room.frac;
    if (remaining > 0.15) {
      const count = remaining > 0.45 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const e = {
          t: Math.min(0.98, room.frac + 0.08 + rnd() * (remaining - 0.1)),
          participantId: row.id,
          type: 'like' as ReactionType,
        };
        let i = room.cursor;
        while (i < room.schedule.length && room.schedule[i].t <= e.t) i++;
        room.schedule.splice(i, 0, e);
      }
    }
  }
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
  // persist the event (fire and forget - heat is the in-memory projection)
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
  if (type === 'hype') {
    // chillsLeft is the scarce-budget field (kept as-is to avoid a DB migration);
    // it now powers hype, the greatest signal, capped per party.
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
  room.paused = false;
  room.frac = 0;
  room.positionMs = 0;
  room.recent = [];
  room.skipping = false;
  room.dislikes = new Set();
  room.dislikeTimers.forEach(clearTimeout);
  room.dislikeTimers = [];

  // iTunes serves ~30s previews, so the preview IS the playable window: play it
  // from the start, no seeking.
  room.clipStartMs = 0;
  room.effectiveDurationMs = song.durationSec * 1000;
  const wp = song.peaks;

  room.schedule = buildSchedule(song.durationSec, wp, botIds(room), room.idx * 977, room.botChills);
  room.cursor = 0;
  room.songStartServerTime = Date.now();
  room.lastPositionBroadcast = 0;
  room.lastOrder = null;

  emitRoom(room, 'songChanged', toCurrentDTO(room));
}

function tick(room: Room): void {
  if (room.phase !== 'party') return;
  if (room.paused || room.skipping) return; // frozen: position + reactions don't advance
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

  // song end -> next, or pause for the host to add more / finish
  if (room.positionMs >= room.effectiveDurationMs) advanceAfter(room);
}

// mark the current song played, then move to the next or pause for more
function advanceAfter(room: Room): void {
  if (room.phase !== 'party') return; // a stale skip timer must not fire mid-finale
  const song = currentSong(room);
  if (song) {
    song.played = true;
    prisma.queuedSong.update({ where: { id: song.id }, data: { played: true } }).catch(() => {});
  }
  // every 5 songs played, quietly expand the queue cap by 5 so the party never
  // runs out of room (starts at 20, grows to 25, 30, etc.)
  const playedCount = room.songs.filter((s) => s.played).length;
  if (playedCount > 0 && playedCount % 5 === 0) {
    room.maxSongs += 5;
    prisma.party.update({ where: { id: room.partyId }, data: { maxSongs: room.maxSongs } }).catch(() => {});
    emitRoom(room, 'queueCapUpdate', { maxSongs: room.maxSongs });
  }
  if (room.idx + 1 < room.songs.length) {
    room.idx += 1;
    startSong(room);
  } else {
    pauseForMore(room);
  }
}

// skip the current song with a reason broadcast for the 10s toast. We hold
// `skipping` briefly so the UI can stop the audio + grey out + fade before the
// next song comes in (or the party wraps up).
function skipCurrent(
  room: Room,
  reason: string,
  flush: boolean,
  extra: Record<string, unknown> = {},
): void {
  if (room.phase !== 'party' || room.skipping) return;
  const song = currentSong(room);
  if (!song) return;
  room.skipping = true;
  room.dislikeTimers.forEach(clearTimeout); // stop any pending bot pile-on
  room.dislikeTimers = [];
  if (flush && room.schedule) {
    // host moving on: flush bot reactions so the song isn't artificially cold.
    // Spread the backdated timestamps beyond the sync window so the flush can't
    // manufacture a phantom sync (they'd otherwise all share one timestamp).
    let back = Date.now() - 5000;
    while (room.cursor < room.schedule.length) {
      const e = room.schedule[room.cursor++];
      doReaction(room, song, e.participantId, e.type, e.t, back, true);
      back -= SYNC_WINDOW_MS + 50;
    }
  }
  emitRoom(room, 'songSkipped', { title: song.title, reason, ...extra });
  // hold the greyed-out transition for 3s before the next song fades in. Tracked
  // so enterFinale/destroyRoom can cancel it (a host can END mid-skip).
  if (room.skipTimer) clearTimeout(room.skipTimer);
  room.skipTimer = setTimeout(() => {
    room.skipTimer = null;
    room.skipping = false;
    advanceAfter(room);
  }, 3000);
}

// ---- dislikes -> auto-skip --------------------------------------
// Who counts toward the dislike majority: bots + still-connected humans (so a
// party where people have left can still reach "more than half").
function voterCount(room: Room): number {
  let n = 0;
  for (const p of room.participants.values()) if (p.isBot || p.connected) n++;
  return n;
}

export function setDislike(room: Room, participantId: string, on: boolean): void {
  if (room.phase !== 'party' || room.paused || room.skipping) return;
  const p = room.participants.get(participantId);
  if (!p) return;
  if (on) room.dislikes.add(participantId);
  else room.dislikes.delete(participantId);
  emitRoom(room, 'dislikeUpdate', { count: room.dislikes.size, total: voterCount(room) });
  if (on && !p.isBot) rallyBots(room); // a human dislike rallies the room
  checkDislikeSkip(room);
}

// A participant renames themselves: trim, clamp to 1-24 chars, ignore empty,
// then broadcast the new name to the whole room (incl. the caller).
export function renameParticipant(room: Room, participantId: string, name: unknown): void {
  const p = room.participants.get(participantId);
  if (!p) return;
  const next = String(name ?? '')
    .trim()
    .slice(0, 24);
  if (!next || next === p.name) return;
  p.name = next;
  prisma.participant.update({ where: { id: p.id }, data: { name: next } }).catch(() => {});
  emitRoom(room, 'participantRenamed', { participantId: p.id, name: next });
}

function rallyBots(room: Room): void {
  const myIdx = room.idx;
  for (const part of room.participants.values()) {
    if (!part.isBot || room.dislikes.has(part.id)) continue;
    if (Math.random() > 0.55) continue; // only some bots agree
    const timer = setTimeout(
      () => {
        // bail if the song moved on, or the host paused/skipped meanwhile
        if (room.phase !== 'party' || room.paused || room.skipping || room.idx !== myIdx) return;
        if (room.dislikes.has(part.id)) return;
        room.dislikes.add(part.id);
        emitRoom(room, 'dislikeUpdate', { count: room.dislikes.size, total: voterCount(room) });
        checkDislikeSkip(room);
      },
      600 + Math.floor(Math.random() * 1400),
    );
    room.dislikeTimers.push(timer);
  }
}

function checkDislikeSkip(room: Room): void {
  if (room.phase !== 'party' || room.paused || room.skipping) return;
  // more than half the room (connected humans + bots) disliked it -> skip
  const total = voterCount(room);
  if (room.dislikes.size > total / 2) {
    skipCurrent(room, 'most of the room disliked it', false, {
      dislikes: room.dislikes.size,
      total,
    });
  }
}

// Queue exhausted: stop the clock and ask the host to add more or wrap up.
function pauseForMore(room: Room): void {
  if (room.tick) {
    clearInterval(room.tick);
    room.tick = null;
  }
  room.awaitingMore = true;
  emitRoom(room, 'queueExhausted', { canAdd: room.songs.length < room.maxSongs });
}

// Host chose to keep going after adding songs (or a song arrived mid-pause).
function resumeFromMore(room: Room): void {
  if (!room.awaitingMore) return;
  const nextIdx = room.songs.findIndex((s) => !s.played);
  if (nextIdx === -1) return; // nothing new to play
  room.awaitingMore = false;
  room.idx = nextIdx;
  startSong(room);
  room.tick = setInterval(() => tick(room), TICK_MS);
}

// Host chose to finish -> crown.
export function finishParty(room: Room): void {
  room.awaitingMore = false;
  enterFinale(room);
}

function emitQueue(room: Room): void {
  emitRoom(room, 'queueUpdated', { songs: room.songs.map((s) => toSongDTO(room, s)) });
}

export async function addSongToRoom(
  room: Room,
  track: Track,
  addedById: string,
  silent = false,
): Promise<{ ok: boolean; reason?: string }> {
  if (room.phase !== 'lobby' && room.phase !== 'party')
    return { ok: false, reason: 'Party has ended' };
  if (room.songs.length >= room.maxSongs) return { ok: false, reason: 'Queue is full' };
  const row = await prisma.queuedSong.create({
    data: {
      partyId: room.partyId,
      // assign position after the await so concurrent adds don't collide
      position: room.songs.length,
      trackId: track.id,
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
  // re-derive position from the live array length in case another add interleaved
  row.position = room.songs.length;
  room.songs.push(makeRuntimeSong(row));
  if (!silent) emitQueue(room);
  // a song arriving during the intermission resumes playback
  if (!silent && room.awaitingMore) resumeFromMore(room);
  return { ok: true };
}

// Remove an upcoming (not playing, not played) song from the queue.
export function removeSong(room: Room, songId: string): { ok: boolean; reason?: string } {
  if (room.phase !== 'lobby' && room.phase !== 'party')
    return { ok: false, reason: 'Party has ended' };
  const idx = room.songs.findIndex((s) => s.id === songId);
  if (idx === -1) return { ok: false, reason: 'Not in the queue' };
  const song = room.songs[idx];
  if (song.played) return { ok: false, reason: 'Already played' };
  if (room.phase === 'party' && idx <= room.idx) return { ok: false, reason: 'Playing now' };
  room.songs.splice(idx, 1);
  room.songs.forEach((s, i) => (s.position = i)); // re-number in memory
  prisma.queuedSong.delete({ where: { id: songId } }).catch(() => {});
  room.songs.forEach((s, i) =>
    prisma.queuedSong.update({ where: { id: s.id }, data: { position: i } }).catch(() => {}),
  );
  emitQueue(room);
  return { ok: true };
}

export async function startParty(
  room: Room,
  opts?: { allowSolo?: boolean },
): Promise<{ ok: boolean; reason?: string }> {
  if (room.phase !== 'lobby') return { ok: false, reason: 'Already started' };
  const guests = [...room.participants.values()].filter((p) => !p.isHost).length;
  // instant parties start the second the host picks a song - bots trickle in after
  if (!opts?.allowSolo && guests < 2) return { ok: false, reason: 'Need 2+ guests' };
  // everyone adds their own songs now - no auto-seeding
  if (room.songs.length === 0) return { ok: false, reason: 'Add a song to start' };

  room.phase = 'party';
  room.partyStartTime = Date.now();
  room.idx = 0;
  await prisma.party.update({ where: { id: room.partyId }, data: { phase: 'party' } });
  emitRoom(room, 'phaseChanged', { phase: 'party' });
  emitQueue(room); // make sure clients have the authoritative queue
  startSong(room);
  room.tick = setInterval(() => tick(room), TICK_MS);
  return { ok: true };
}

// Host pauses playback for everyone - the clock + reactions freeze.
export function hostPause(room: Room): void {
  if (room.phase !== 'party' || room.paused) return;
  room.paused = true;
  // freeze the room: drop pending bot dislike-rallies so nothing auto-skips while paused
  room.dislikeTimers.forEach(clearTimeout);
  room.dislikeTimers = [];
  emitRoom(room, 'playback', { paused: true, positionMs: room.positionMs, serverTime: Date.now() });
}

// Host resumes - position continues from where it froze.
export function hostResume(room: Room): void {
  if (room.phase !== 'party' || !room.paused) return;
  room.paused = false;
  room.songStartServerTime = Date.now() - room.positionMs;
  const song = currentSong(room);
  emitRoom(room, 'playback', {
    paused: false,
    positionMs: room.positionMs,
    serverTime: Date.now(),
    effectiveDurationMs: room.effectiveDurationMs,
    clipStartMs: room.clipStartMs,
    streamUrl: song?.streamUrl ?? null,
  });
}

export function hostSkip(room: Room): void {
  skipCurrent(room, 'skipped by the host', true);
}

// Host taps a queued song: it plays right now. The current song is marked
// played, the chosen one slots in next, and the rest of the queue keeps
// its order.
export function playNow(room: Room, songId: string): void {
  if (room.phase !== 'party' || room.skipping) return;
  const targetIdx = room.songs.findIndex((s) => s.id === songId);
  if (targetIdx < 0 || targetIdx === room.idx) return;
  const target = room.songs[targetIdx];
  if (target.played) return;
  const cur = currentSong(room);
  if (cur) {
    cur.played = true;
    prisma.queuedSong.update({ where: { id: cur.id }, data: { played: true } }).catch(() => {});
  }
  room.songs.splice(targetIdx, 1);
  room.songs.splice(room.idx + 1, 0, target);
  room.songs.forEach((s, i) => (s.position = i));
  room.idx += 1;
  startSong(room);
  emitQueue(room);
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
  if (room.phase === 'finale' || room.phase === 'coronation') return; // never re-enter
  if (room.tick) {
    clearInterval(room.tick);
    room.tick = null;
  }
  // cancel any in-flight skip hold or stale finale timers before we start fresh
  if (room.skipTimer) {
    clearTimeout(room.skipTimer);
    room.skipTimer = null;
  }
  room.skipping = false;
  room.dislikeTimers.forEach(clearTimeout);
  room.dislikeTimers = [];
  room.finaleTimers.forEach(clearTimeout);
  room.finaleTimers = [];
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
  // clear the previous match's timers so a stale bot vote/deadline can't leak in
  room.finaleTimers.forEach(clearTimeout);
  room.finaleTimers = [];
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
    room.finaleTimers.push(timer);
  });
  // deadline fallback
  const dl = setTimeout(() => maybeResolve(room), VOTE_DEADLINE_MS + 200);
  room.finaleTimers.push(dl);
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
    room.finaleTimers.push(setTimeout(() => doAdvance(room), DECIDE_DELAY_MS));
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
