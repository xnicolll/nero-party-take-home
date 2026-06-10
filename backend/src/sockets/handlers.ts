// ============================================================
// NERO PARTY - socket handlers (client <-> engine glue)
// ============================================================
import { randomUUID } from 'crypto';
import type { Server, Socket } from 'socket.io';
import { prisma } from '../db.js';
import { GUEST_COLORS, HOST_COLOR, LANES, isReactionType } from '../constants.js';
import { generateJoinCode } from '../lib/joinCode.js';
import { getRoomByCode, getRoomByPartyId, type Room } from '../room/state.js';
import {
  addParticipantToRoom,
  addSongToRoom,
  armBotTimers,
  castVote,
  createRoom,
  finishParty,
  hostEnd,
  hostPause,
  hostResume,
  hostSkip,
  humanReact,
  removeSong,
  setDislike,
  startParty,
} from '../room/engine.js';
import { toSnapshot } from './emit.js';
import { getTrack, searchTracks } from '../services/itunes.js';
import { buildRecs } from '../recommend.js';
import type { Track } from '../types.js';

interface SocketData {
  partyId: string;
  participantId: string;
  joinCode: string;
  isHost: boolean;
}

function clamp(n: unknown, lo: number, hi: number, dflt: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return dflt;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function cleanName(name: unknown, fallback: string): string {
  const s = String(name ?? '').trim();
  return s ? s.slice(0, 24) : fallback;
}

function roomFromSocket(socket: Socket): Room | undefined {
  const d = socket.data as Partial<SocketData>;
  return d.partyId ? getRoomByPartyId(d.partyId) : undefined;
}

function nextGuestColor(room: Room): string {
  let guests = 0;
  for (const p of room.participants.values()) if (!p.isBot && !p.isHost) guests++;
  return GUEST_COLORS[guests % GUEST_COLORS.length];
}

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    // ---- create a party (host) ----
    socket.on('createParty', async (payload: any, ack?: (r: any) => void) => {
      try {
        const lane = LANES.includes(payload?.lane) ? payload.lane : 'Anything goes';
        const party = await prisma.party.create({
          data: {
            joinCode: await generateJoinCode(),
            name: cleanName(payload?.name, 'Untitled Party').slice(0, 36),
            lane,
            maxSongs: clamp(payload?.maxSongs, 3, 12, 5),
            chillsBudget: clamp(payload?.chillsBudget, 1, 5, 3),
            songLengthMode: payload?.songLengthMode === 'clip' ? 'clip' : 'full',
            hostToken: randomUUID(),
            phase: 'lobby',
          },
        });
        const host = await prisma.participant.create({
          data: {
            partyId: party.id,
            name: cleanName(payload?.hostName, 'Host'),
            color: HOST_COLOR,
            isHost: true,
            chillsLeft: party.chillsBudget,
          },
        });
        const room = createRoom(io, party);
        addParticipantToRoom(room, host);
        room.participants.get(host.id)!.socketIds.add(socket.id);
        socket.join(party.joinCode);
        socket.data = {
          partyId: party.id,
          participantId: host.id,
          joinCode: party.joinCode,
          isHost: true,
        } satisfies SocketData;
        armBotTimers(room);
        ack?.({
          ok: true,
          joinCode: party.joinCode,
          partyId: party.id,
          participantId: host.id,
          hostToken: party.hostToken,
          snapshot: toSnapshot(room, host.id),
        });
      } catch (e) {
        ack?.({ ok: false, reason: 'Could not create party' });
      }
    });

    // ---- join via share link ----
    socket.on('joinParty', async (payload: any, ack?: (r: any) => void) => {
      const room = getRoomByCode(String(payload?.joinCode ?? '').toUpperCase());
      if (!room) return ack?.({ ok: false, reason: 'Party not found' });
      if (room.phase === 'coronation') return ack?.({ ok: false, reason: 'This party has ended' });
      const p = await prisma.participant.create({
        data: {
          partyId: room.partyId,
          name: cleanName(payload?.name, 'Guest'),
          color: nextGuestColor(room),
          isHost: false,
          chillsLeft: room.chillsBudget,
        },
      });
      addParticipantToRoom(room, p);
      room.participants.get(p.id)!.socketIds.add(socket.id);
      socket.join(room.joinCode);
      socket.data = {
        partyId: room.partyId,
        participantId: p.id,
        joinCode: room.joinCode,
        isHost: false,
      } satisfies SocketData;
      socket.to(room.joinCode).emit('participantJoined', {
        participant: {
          id: p.id,
          name: p.name,
          color: p.color,
          isBot: false,
          isHost: false,
          connected: true,
        },
      });
      ack?.({
        ok: true,
        partyId: room.partyId,
        participantId: p.id,
        snapshot: toSnapshot(room, p.id),
      });
    });

    // ---- reconnect / second tab ----
    socket.on('rejoin', (payload: any, ack?: (r: any) => void) => {
      const room = getRoomByPartyId(String(payload?.partyId ?? ''));
      if (!room) return ack?.({ ok: false, reason: 'Party ended' });
      const p = room.participants.get(String(payload?.participantId ?? ''));
      if (!p) return ack?.({ ok: false, reason: 'Not in this party' });
      p.socketIds.add(socket.id);
      p.connected = true;
      const isHost = p.isHost && payload?.hostToken === room.hostToken;
      socket.join(room.joinCode);
      socket.data = {
        partyId: room.partyId,
        participantId: p.id,
        joinCode: room.joinCode,
        isHost,
      } satisfies SocketData;
      prisma.participant.update({ where: { id: p.id }, data: { connected: true } }).catch(() => {});
      socket.to(room.joinCode).emit('participantJoined', {
        participant: {
          id: p.id,
          name: p.name,
          color: p.color,
          isBot: p.isBot,
          isHost: p.isHost,
          connected: true,
        },
      });
      ack?.({ ok: true, snapshot: toSnapshot(room, p.id), isHost });
    });

    // ---- search iTunes ----
    socket.on('searchTracks', async (payload: any, ack?: (r: any) => void) => {
      const tracks = await searchTracks(String(payload?.query ?? ''), 12);
      ack?.({ ok: true, tracks });
    });

    // ---- add a song to the queue ----
    socket.on('addSong', async (payload: any, ack?: (r: any) => void) => {
      const room = roomFromSocket(socket);
      if (!room) return ack?.({ ok: false, reason: 'No party' });
      let t: Track | null = payload?.track ?? null;
      if (!t && payload?.trackId) t = await getTrack(String(payload.trackId));
      if (!t || !t.id) return ack?.({ ok: false, reason: 'Track unavailable' });
      const res = await addSongToRoom(room, t, (socket.data as SocketData).participantId);
      ack?.(res);
    });

    // ---- remove a song from the queue ----
    socket.on('removeSong', (payload: any, ack?: (r: any) => void) => {
      const room = roomFromSocket(socket);
      if (!room) return ack?.({ ok: false, reason: 'No party' });
      ack?.(removeSong(room, String(payload?.songId ?? '')));
    });

    // ---- react (human tap) ----
    socket.on('react', (payload: any) => {
      const room = roomFromSocket(socket);
      if (!room) return;
      if (!isReactionType(payload?.type)) return;
      humanReact(room, (socket.data as SocketData).participantId, payload.type);
    });

    // ---- dislike the current song (toggle) ----
    socket.on('dislike', (payload: any) => {
      const room = roomFromSocket(socket);
      if (!room) return;
      setDislike(room, (socket.data as SocketData).participantId, payload?.on !== false);
    });

    // ---- host: start ----
    socket.on('startParty', async (payload: any, ack?: (r: any) => void) => {
      const room = roomFromSocket(socket);
      if (!room) return ack?.({ ok: false, reason: 'No party' });
      if (payload?.hostToken !== room.hostToken)
        return ack?.({ ok: false, reason: 'Not the host' });
      const res = await startParty(room);
      if (!res.ok) socket.emit('errorMsg', { code: 'start', message: res.reason });
      ack?.(res);
    });

    // ---- host: skip / end ----
    socket.on('hostSkip', (payload: any) => {
      const room = roomFromSocket(socket);
      if (!room || payload?.hostToken !== room.hostToken) return;
      hostSkip(room);
    });
    socket.on('hostEnd', (payload: any) => {
      const room = roomFromSocket(socket);
      if (!room || payload?.hostToken !== room.hostToken) return;
      hostEnd(room);
    });
    // host chose "finish" at the queue-exhausted intermission
    socket.on('finishParty', (payload: any) => {
      const room = roomFromSocket(socket);
      if (!room || payload?.hostToken !== room.hostToken) return;
      finishParty(room);
    });
    // host pauses / resumes playback for everyone
    socket.on('hostPause', (payload: any) => {
      const room = roomFromSocket(socket);
      if (!room || payload?.hostToken !== room.hostToken) return;
      hostPause(room);
    });
    socket.on('hostResume', (payload: any) => {
      const room = roomFromSocket(socket);
      if (!room || payload?.hostToken !== room.hostToken) return;
      hostResume(room);
    });

    // ---- recommendations (coronation) ----
    socket.on('getRecs', async (_payload: any, ack?: (r: any) => void) => {
      const room = roomFromSocket(socket);
      if (!room) return ack?.({ recs: [] });
      try {
        const recs = await buildRecs(room, 5);
        ack?.({ recs });
      } catch {
        ack?.({ recs: [] });
      }
    });

    // ---- finale vote ----
    socket.on('castVote', (payload: any) => {
      const room = roomFromSocket(socket);
      if (!room) return;
      const side = payload?.side;
      if (side !== 0 && side !== 1) return;
      castVote(room, (socket.data as SocketData).participantId, side);
    });

    // ---- leave the party (explicit) ----
    socket.on('leaveParty', () => {
      const d = socket.data as Partial<SocketData>;
      if (!d.partyId) return;
      const room = getRoomByPartyId(d.partyId);
      if (!room) return;
      const p = room.participants.get(d.participantId ?? '');
      if (p) {
        p.socketIds.delete(socket.id);
        p.connected = false;
        prisma.participant
          .update({ where: { id: p.id }, data: { connected: false } })
          .catch(() => {});
        socket.to(room.joinCode).emit('participantLeft', { participantId: p.id });
      }
      socket.leave(room.joinCode);
      socket.data = {};
    });

    // ---- disconnect ----
    socket.on('disconnect', () => {
      const d = socket.data as Partial<SocketData>;
      if (!d.partyId) return;
      const room = getRoomByPartyId(d.partyId);
      if (!room) return;
      const p = room.participants.get(d.participantId ?? '');
      if (!p) return;
      p.socketIds.delete(socket.id);
      if (p.socketIds.size === 0) {
        p.connected = false;
        prisma.participant
          .update({ where: { id: p.id }, data: { connected: false } })
          .catch(() => {});
        socket.to(room.joinCode).emit('participantLeft', { participantId: p.id });
      }
    });
  });
}
