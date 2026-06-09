// ============================================================
// NERO PARTY — party room v2
// A clean surface: ambient blurred album art, the waveform vertically central,
// the playlist as racing glass cards on the left (queue + live standings in one),
// real album art, and a top-left + that takes the playlist side over for search.
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
import { AlbumArt, AmbientBackground, Eyebrow, PersonDot } from './atoms';
import { PlaylistRail, ReactionBar, WavePlayer } from './partyWidgets';
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
  const liveSong = songs.find((s) => s.id === current.song.id) ?? current.song;
  const adder = participants.find((p) => p.id === liveSong.addedById);
  const now = Date.now();
  const litRecent = new Set(
    pins.filter((p) => p.t && now - p.t < 1800).map((p) => p.participantId),
  );
  const windowSec = current.effectiveDurationMs / 1000;

  return (
    <div className="room2">
      <AmbientBackground artworkUrl={liveSong.artworkUrl} />

      <header className="room2-top">
        <div className="r2-left">
          <button
            className="r2-iconbtn r2-add glass"
            onClick={() => setShowAdd((s) => !s)}
            title="add a song"
          >
            {showAdd ? '×' : '＋'}
          </button>
          <div className="r2-titles">
            <span className="r2-name">{party.name}</span>
            <span className="r2-sub">
              SONG {current.idx + 1}/{current.total} · {party.lane.toLowerCase()}
            </span>
          </div>
        </div>
        <div className="r2-right">
          <div className="r2-people">
            {participants.map((p) => (
              <PersonDot
                key={p.id}
                person={p}
                lit={p.id === youId || litRecent.has(p.id)}
                size={26}
              />
            ))}
          </div>
          <button className="r2-iconbtn glass" onClick={onHelp} title="how it works">
            ?
          </button>
          {isHost && (
            <div className="r2-host mono">
              <button className="host-btn" onClick={onSkip}>
                SKIP ▸▸
              </button>
              <button className="host-btn host-end" onClick={onEnd}>
                END
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="room2-body">
        <aside className="rail">
          <div className="rail-head">
            <Eyebrow>{showAdd ? 'ADD A SONG' : 'PLAYLIST · LIVE'}</Eyebrow>
            <span className="lboard-note mono">
              {showAdd ? `${songs.length}/${party.maxSongs}` : 'heat / min'}
            </span>
          </div>
          {showAdd ? (
            <div className="rail-search glass">
              <SongSearch
                search={search}
                add={add}
                full={songs.length >= party.maxSongs}
                queuedIds={new Set(songs.map((s) => s.audiusId))}
              />
            </div>
          ) : (
            <PlaylistRail songs={songs} currentId={liveSong.id} />
          )}
        </aside>

        <main className="stage">
          <div className="stage-np">
            <AlbumArt artworkUrl={liveSong.artworkUrl} hue={liveSong.hue} size={196} radius={22} />
            <div>
              <Eyebrow color={adder?.color}>
                QUEUED BY {(adder?.name ?? liveSong.addedByName).toUpperCase()}
              </Eyebrow>
              <h2 className="stage-title">{liveSong.title}</h2>
              <p className="stage-artist">{liveSong.artist}</p>
              <div className="stage-heat mono">{liveSong.score.toFixed(1)} HEAT / MIN</div>
            </div>
          </div>

          <div className="stage-wave">
            <WavePlayer
              song={liveSong}
              frac={liveFrac}
              windowSec={windowSec}
              pins={pins}
              bursts={bursts}
            />
          </div>

          <div className="stage-react">
            <ReactionBar onReact={onReact} chillsLeft={chillsLeft} />
          </div>
          <p className="stage-hint mono">
            tap = pinned to this second · 3 people in 2s = sync · keys 1–5
          </p>
        </main>
      </div>
    </div>
  );
}
