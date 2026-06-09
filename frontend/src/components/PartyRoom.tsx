// ============================================================
// NERO PARTY — party room (ported from nero-room.jsx)
// Layout identical to the design; state arrives over the socket and the
// <audio> plays the real Audius track in sync with the server clock.
// ============================================================
import { useState } from 'react';
import type {
  CurrentDTO,
  ParticipantDTO,
  PartyDTO,
  ReactionType,
  SongDTO,
  Track,
} from '../lib/types';
import type { Burst, LivePin } from '../hooks/useRoom';
import { Eyebrow, PersonDot, VinylArt } from './atoms';
import { Leaderboard, QueueStrip, ReactionBar, WavePlayer } from './partyWidgets';
import { SongSearch } from './SongSearch';

interface PartyRoomProps {
  party: PartyDTO;
  participants: ParticipantDTO[];
  songs: SongDTO[];
  current: CurrentDTO;
  liveFrac: number;
  pins: LivePin[];
  bursts: Burst[];
  chillsLeft: number;
  youId: string;
  isHost: boolean;
  onReact: (t: ReactionType) => void;
  onSkip: () => void;
  onEnd: () => void;
  onHelp: () => void;
  search: (q: string) => Promise<Track[]>;
  add: (t: Track) => Promise<{ ok: boolean; reason?: string }>;
}

export function PartyRoom({
  party,
  participants,
  songs,
  current,
  liveFrac,
  pins,
  bursts,
  chillsLeft,
  youId,
  isHost,
  onReact,
  onSkip,
  onEnd,
  onHelp,
  search,
  add,
}: PartyRoomProps) {
  const [showAdd, setShowAdd] = useState(false);
  // prefer the live song (updated heat/score) over the songChanged snapshot
  const liveSong = songs.find((s) => s.id === current.song.id) ?? current.song;
  const adder = participants.find((p) => p.id === liveSong.addedById);
  const now = Date.now();
  const litRecent = new Set(
    pins.filter((p) => p.t && now - p.t < 1800).map((p) => p.participantId),
  );
  const windowSec = current.effectiveDurationMs / 1000;

  return (
    <div className="room">
      <header className="room-head">
        <div className="room-head-l">
          <Eyebrow>
            ~/live · {party.name.toLowerCase()} · {party.lane.toLowerCase()}
          </Eyebrow>
          <span className="mono room-songcount">
            SONG {current.idx + 1} / {current.total}
          </span>
        </div>
        <div className="room-people">
          {participants.map((p) => (
            <PersonDot
              key={p.id}
              person={p}
              lit={p.id === youId || litRecent.has(p.id)}
              size={28}
            />
          ))}
        </div>
        <div className="room-host mono">
          <button className="help-fab" onClick={() => setShowAdd(true)} title="add a song">
            ＋
          </button>
          <button className="help-fab" onClick={onHelp} title="how it works">
            ?
          </button>
          {isHost && (
            <>
              <button className="host-btn" onClick={onSkip}>
                SKIP ▸▸
              </button>
              <button className="host-btn host-end" onClick={onEnd}>
                END PARTY
              </button>
            </>
          )}
        </div>
      </header>

      <Leaderboard songs={songs} currentId={liveSong.id} />

      <main className="room-main">
        <div className="np">
          <VinylArt hue={liveSong.hue} size={148} spinning />
          <div className="np-meta">
            <Eyebrow color={adder?.color}>
              QUEUED BY {(adder?.name ?? liveSong.addedByName).toUpperCase()}
            </Eyebrow>
            <h2 className="np-title">{liveSong.title}</h2>
            <p className="np-artist">{liveSong.artist}</p>
          </div>
          <div className="np-heat mono">
            <span className="np-heat-val">{liveSong.score.toFixed(1)}</span>
            <span className="np-heat-label">HEAT / MIN</span>
          </div>
        </div>

        <WavePlayer
          song={liveSong}
          frac={liveFrac}
          windowSec={windowSec}
          pins={pins}
          bursts={bursts}
        />

        <ReactionBar onReact={onReact} chillsLeft={chillsLeft} />
        <p className="rbar-hint mono">
          tap = pinned to this second · 3 people in 2s = sync bonus · keys 1–5
        </p>
      </main>

      <footer className="room-foot">
        <QueueStrip songs={songs} currentId={liveSong.id} />
      </footer>

      {showAdd && (
        <div className="tut-overlay" onClick={() => setShowAdd(false)}>
          <div className="tut-card" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
            <span className="tut-path">
              ~/queue · {songs.length}/{party.maxSongs}
            </span>
            <SongSearch
              search={search}
              add={add}
              full={songs.length >= party.maxSongs}
              queuedIds={new Set(songs.map((s) => s.audiusId))}
            />
            <div className="tut-foot">
              <span className="lobby-wait mono">it joins the back of the queue</span>
              <button className="tut-next" onClick={() => setShowAdd(false)}>
                done →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
