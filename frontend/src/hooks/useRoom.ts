// ============================================================
// NERO PARTY - useRoom: socket-driven party state
// Holds the latest snapshot and folds in live deltas (reactions, syncs,
// leaderboard, song changes, finale). Replaces the design's local useParty.
// ============================================================
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { socket, emitAck } from '../lib/socket';
import type {
  CurrentDTO,
  FinaleState,
  LeaderRow,
  ParticipantDTO,
  ReactionAdded,
  ReactionType,
  ResultsDTO,
  ServerPhase,
  Snapshot,
  SongDTO,
  Track,
} from '../lib/types';

export interface LivePin {
  frac: number;
  type: ReactionType;
  participantId: string;
  name: string;
  t: number;
}
export interface Burst {
  frac: number;
  t: number;
}

interface RoomState {
  joined: boolean;
  phase: ServerPhase | null;
  party: Snapshot['party'] | null;
  you: Snapshot['you'] | null;
  participants: ParticipantDTO[];
  songs: SongDTO[];
  current: CurrentDTO | null;
  leaderboard: LeaderRow[];
  finale: FinaleState | null;
  results: ResultsDTO | null;
  pins: LivePin[]; // live pins for the current song
  bursts: Burst[];
  awaitingMore: boolean; // queue exhausted, host deciding
  paused: boolean; // host paused playback for everyone
}

const EMPTY: RoomState = {
  joined: false,
  phase: null,
  party: null,
  you: null,
  participants: [],
  songs: [],
  current: null,
  leaderboard: [],
  finale: null,
  results: null,
  pins: [],
  bursts: [],
  awaitingMore: false,
  paused: false,
};

type Action =
  | { type: 'snapshot'; snap: Snapshot }
  | { type: 'participantJoined'; p: ParticipantDTO }
  | { type: 'participantLeft'; id: string }
  | { type: 'queueUpdated'; songs: SongDTO[] }
  | { type: 'phaseChanged'; phase: ServerPhase }
  | { type: 'songChanged'; current: CurrentDTO }
  | { type: 'reactionAdded'; r: ReactionAdded }
  | { type: 'syncBurst'; songId: string; frac: number }
  | { type: 'leaderboard'; order: LeaderRow[] }
  | { type: 'finale'; finale: FinaleState }
  | { type: 'results'; results: ResultsDTO }
  | { type: 'queueExhausted' }
  | { type: 'playback'; paused: boolean; serverTime: number; positionMs: number }
  | { type: 'localChills' }
  | { type: 'reset' };

function recompute(song: SongDTO): number {
  return song.heat / (song.durationSec / 60);
}

function reducer(state: RoomState, action: Action): RoomState {
  switch (action.type) {
    case 'snapshot': {
      const s = action.snap;
      return {
        joined: true,
        phase: s.party.phase,
        party: s.party,
        you: s.you,
        participants: s.participants,
        songs: s.songs,
        current: s.current,
        leaderboard: s.leaderboard,
        finale: s.finale,
        results: s.results,
        pins: (s.current?.song.pins ?? []).map((p) => ({ ...p, name: '', t: 0 })),
        bursts: [],
        awaitingMore: s.awaitingMore,
        paused: s.paused,
      };
    }
    case 'participantJoined': {
      const exists = state.participants.some((p) => p.id === action.p.id);
      const participants = exists
        ? state.participants.map((p) => (p.id === action.p.id ? { ...p, connected: true } : p))
        : [...state.participants, action.p];
      return { ...state, participants };
    }
    case 'participantLeft':
      return {
        ...state,
        participants: state.participants.map((p) =>
          p.id === action.id ? { ...p, connected: false } : p,
        ),
      };
    case 'queueUpdated':
      return { ...state, songs: action.songs };
    case 'phaseChanged':
      return { ...state, phase: action.phase, awaitingMore: false, paused: false };
    case 'queueExhausted':
      return { ...state, awaitingMore: true };
    case 'playback':
      return {
        ...state,
        paused: action.paused,
        current: state.current
          ? { ...state.current, serverTime: action.serverTime, positionMs: action.positionMs }
          : state.current,
      };
    case 'songChanged': {
      // replace the current song entry with its fresh (reset) version
      const songs = state.songs.map((s) =>
        s.id === action.current.song.id ? action.current.song : { ...s },
      );
      return {
        ...state,
        current: action.current,
        songs,
        pins: action.current.song.pins.map((p) => ({ ...p, name: '', t: 0 })),
        bursts: [],
        awaitingMore: false,
        paused: false,
      };
    }
    case 'reactionAdded': {
      const r = action.r;
      const songs = state.songs.map((s) => {
        if (s.id !== r.songId) return s;
        const counts = { ...s.counts, [r.type]: (s.counts[r.type] || 0) + 1 };
        const heat = s.heat + r.weight;
        const next = { ...s, counts, heat, score: 0 };
        next.score = recompute(next);
        return next;
      });
      const isCurrent = state.current?.song.id === r.songId;
      const pins = isCurrent
        ? [
            ...state.pins,
            {
              frac: r.frac,
              type: r.type,
              participantId: r.participantId,
              name: r.participantName,
              t: Date.now(),
            },
          ]
        : state.pins;
      return { ...state, songs, pins };
    }
    case 'syncBurst': {
      const songs = state.songs.map((s) => {
        if (s.id !== action.songId) return s;
        const heat = s.heat + 3;
        const next = { ...s, heat, syncs: s.syncs + 1, score: 0 };
        next.score = recompute(next);
        return next;
      });
      const isCurrent = state.current?.song.id === action.songId;
      const bursts = isCurrent
        ? [...state.bursts, { frac: action.frac, t: Date.now() }]
        : state.bursts;
      return { ...state, songs, bursts };
    }
    case 'leaderboard': {
      // reconcile authoritative scores
      const byId = new Map(action.order.map((r) => [r.songId, r.score]));
      const songs = state.songs.map((s) => (byId.has(s.id) ? { ...s, score: byId.get(s.id)! } : s));
      return { ...state, songs, leaderboard: action.order };
    }
    case 'finale':
      return { ...state, finale: action.finale };
    case 'results':
      return { ...state, results: action.results, phase: 'coronation' };
    case 'localChills':
      return state.you
        ? { ...state, you: { ...state.you, chillsLeft: Math.max(0, state.you.chillsLeft - 1) } }
        : state;
    case 'reset':
      return EMPTY;
    default:
      return state;
  }
}

const LS_KEY = 'nero-creds';
interface Creds {
  partyId: string;
  participantId: string;
  hostToken?: string;
  joinCode: string;
}
function saveCreds(c: Creds) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(c));
  } catch {}
}
export function loadCreds(): Creds | null {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || 'null');
  } catch {
    return null;
  }
}
export function clearCreds() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}

export function useRoom() {
  const [state, dispatch] = useReducer(reducer, EMPTY);
  const [connected, setConnected] = useState(socket.connected);
  const hostTokenRef = useRef<string | null>(loadCreds()?.hostToken ?? null);

  // smooth playback clock (server-anchored)
  const anchor = useRef({ serverTime: 0, positionMs: 0, effDur: 1, skew: 0 });
  const [, force] = useState(0);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    socket.on('participantJoined', (d: { participant: ParticipantDTO }) =>
      dispatch({ type: 'participantJoined', p: d.participant }),
    );
    socket.on('participantLeft', (d: { participantId: string }) =>
      dispatch({ type: 'participantLeft', id: d.participantId }),
    );
    socket.on('queueUpdated', (d: { songs: SongDTO[] }) =>
      dispatch({ type: 'queueUpdated', songs: d.songs }),
    );
    socket.on('phaseChanged', (d: { phase: ServerPhase }) =>
      dispatch({ type: 'phaseChanged', phase: d.phase }),
    );
    socket.on('songChanged', (c: CurrentDTO) => {
      setAnchor(c.serverTime, c.positionMs, c.effectiveDurationMs);
      dispatch({ type: 'songChanged', current: c });
    });
    socket.on('reactionAdded', (r: ReactionAdded) => dispatch({ type: 'reactionAdded', r }));
    socket.on('syncBurst', (d: { songId: string; frac: number }) =>
      dispatch({ type: 'syncBurst', songId: d.songId, frac: d.frac }),
    );
    socket.on('leaderboardUpdate', (d: { order: LeaderRow[] }) =>
      dispatch({ type: 'leaderboard', order: d.order }),
    );
    socket.on('finaleState', (f: FinaleState) => dispatch({ type: 'finale', finale: f }));
    socket.on('results', (r: ResultsDTO) => dispatch({ type: 'results', results: r }));
    socket.on('queueExhausted', () => dispatch({ type: 'queueExhausted' }));
    socket.on(
      'playback',
      (d: {
        paused: boolean;
        positionMs: number;
        serverTime: number;
        effectiveDurationMs?: number;
      }) => {
        setAnchor(d.serverTime, d.positionMs, d.effectiveDurationMs ?? anchor.current.effDur);
        dispatch({
          type: 'playback',
          paused: d.paused,
          serverTime: d.serverTime,
          positionMs: d.positionMs,
        });
      },
    );
    socket.on('tick', (d: { positionMs: number; serverTime: number }) =>
      setAnchor(d.serverTime, d.positionMs, anchor.current.effDur),
    );

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('participantJoined');
      socket.off('participantLeft');
      socket.off('queueUpdated');
      socket.off('phaseChanged');
      socket.off('songChanged');
      socket.off('reactionAdded');
      socket.off('syncBurst');
      socket.off('leaderboardUpdate');
      socket.off('finaleState');
      socket.off('results');
      socket.off('queueExhausted');
      socket.off('playback');
      socket.off('tick');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // snapshot handler defined inline above needs to be registered once
  useEffect(() => {
    const onSnapshot = (snap: Snapshot) => {
      if (snap.current)
        setAnchor(
          snap.current.serverTime,
          snap.current.positionMs,
          snap.current.effectiveDurationMs,
        );
      dispatch({ type: 'snapshot', snap });
    };
    socket.on('snapshot', onSnapshot);
    return () => void socket.off('snapshot', onSnapshot);
  }, []);

  // live frac ticker while in the party
  useEffect(() => {
    if (state.phase !== 'party') return;
    const id = setInterval(() => force((x) => x + 1), 60);
    return () => clearInterval(id);
  }, [state.phase]);

  // preload album art (deduped) so covers never pop in late
  const preloadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const urls = [state.current?.song.artworkUrl, ...state.songs.map((s) => s.artworkUrl)].filter(
      (u): u is string => !!u,
    );
    for (const u of urls) {
      if (!preloadedRef.current.has(u)) {
        preloadedRef.current.add(u);
        const im = new Image();
        im.src = u;
      }
    }
  }, [state.songs, state.current]);

  function setAnchor(serverTime: number, positionMs: number, effDur: number) {
    anchor.current = { serverTime, positionMs, effDur: effDur || 1, skew: serverTime - Date.now() };
  }

  const liveFrac = (() => {
    if (!state.current) return 0;
    const a = anchor.current;
    if (state.paused) return Math.max(0, Math.min(1, a.positionMs / a.effDur));
    const pos = a.positionMs + (Date.now() + a.skew - a.serverTime);
    return Math.max(0, Math.min(1, pos / a.effDur));
  })();

  // ---- actions ----
  const createParty = useCallback(
    async (cfg: {
      name: string;
      hostName: string;
      lane: string;
      maxSongs: number;
      chillsBudget: number;
      songLengthMode: string;
    }) => {
      const r = await emitAck<any>('createParty', cfg);
      if (r?.ok) {
        hostTokenRef.current = r.hostToken;
        saveCreds({
          partyId: r.partyId,
          participantId: r.participantId,
          hostToken: r.hostToken,
          joinCode: r.joinCode,
        });
        dispatch({ type: 'snapshot', snap: r.snapshot });
      }
      return r;
    },
    [],
  );

  const joinParty = useCallback(async (joinCode: string, name: string) => {
    const r = await emitAck<any>('joinParty', { joinCode, name });
    if (r?.ok) {
      saveCreds({ partyId: r.partyId, participantId: r.participantId, joinCode });
      dispatch({ type: 'snapshot', snap: r.snapshot });
    }
    return r;
  }, []);

  const resume = useCallback(async () => {
    const c = loadCreds();
    if (!c) return { ok: false };
    const r = await emitAck<any>('rejoin', c);
    if (r?.ok) {
      hostTokenRef.current = c.hostToken ?? null;
      dispatch({ type: 'snapshot', snap: r.snapshot });
    } else {
      clearCreds();
    }
    return r;
  }, []);

  const searchTracks = useCallback(async (query: string): Promise<Track[]> => {
    const r = await emitAck<any>('searchTracks', { query });
    return r?.tracks ?? [];
  }, []);

  const addSong = useCallback(async (track: Track) => emitAck<any>('addSong', { track }), []);
  const react = useCallback((type: ReactionType) => {
    if (type === 'chills') dispatch({ type: 'localChills' });
    socket.emit('react', { type });
  }, []);
  const start = useCallback(
    () => emitAck<any>('startParty', { hostToken: hostTokenRef.current }),
    [],
  );
  const skip = useCallback(() => socket.emit('hostSkip', { hostToken: hostTokenRef.current }), []);
  const end = useCallback(() => socket.emit('hostEnd', { hostToken: hostTokenRef.current }), []);
  const finish = useCallback(
    () => socket.emit('finishParty', { hostToken: hostTokenRef.current }),
    [],
  );
  const pausePlayback = useCallback(
    () => socket.emit('hostPause', { hostToken: hostTokenRef.current }),
    [],
  );
  const resumePlayback = useCallback(
    () => socket.emit('hostResume', { hostToken: hostTokenRef.current }),
    [],
  );
  const vote = useCallback((side: 0 | 1) => socket.emit('castVote', { side }), []);
  const leave = useCallback(() => socket.emit('leaveParty'), []);
  const getRecs = useCallback(async () => {
    const r = await emitAck<any>('getRecs', {});
    return (r?.recs ?? []) as import('../lib/types').Rec[];
  }, []);
  const reset = useCallback(() => {
    clearCreds();
    dispatch({ type: 'reset' });
  }, []);

  return {
    connected,
    ...state,
    liveFrac,
    isHost: !!hostTokenRef.current,
    actions: {
      createParty,
      joinParty,
      resume,
      searchTracks,
      addSong,
      react,
      start,
      skip,
      end,
      finish,
      pausePlayback,
      resumePlayback,
      vote,
      leave,
      getRecs,
      reset,
    },
  };
}
