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
import { AlbumArt, AmbientBackground, Btn, Eyebrow, PersonDot } from './atoms';
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
  awaitingMore: boolean;
  paused: boolean;
  onTogglePlay: () => void;
  onReact: (t: ReactionType) => void;
  onSkip: () => void;
  onEnd: () => void;
  onFinish: () => void;
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
  awaitingMore,
  paused,
  onTogglePlay,
  onReact,
  onSkip,
  onEnd,
  onFinish,
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
  const queueFull = songs.length >= party.maxSongs;
  const host = participants.find((p) => p.isHost);

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
              {host ? ` · hosted by ${host.name}` : ''}
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
                host={p.isHost}
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
                full={queueFull}
                queuedIds={new Set(songs.map((s) => s.audiusId))}
              />
            </div>
          ) : (
            <PlaylistRail songs={songs} currentId={liveSong.id} />
          )}
        </aside>

        <main className="stage">
          <div className="stage-np">
            <div className="stage-art">
              <AlbumArt
                artworkUrl={liveSong.artworkUrl}
                hue={liveSong.hue}
                size={196}
                radius={22}
                priority
              />
            </div>
            <div>
              <Eyebrow color={adder?.color}>
                QUEUED BY {(adder?.name ?? liveSong.addedByName).toUpperCase()}
                {adder?.isHost ? ' ✦' : ''}
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

          <div className="transport">
            <button
              className={'transport-btn glass' + (paused ? ' is-paused' : '')}
              onClick={onTogglePlay}
              disabled={!isHost}
              title={
                isHost
                  ? paused
                    ? 'resume for everyone'
                    : 'pause for everyone'
                  : 'host controls playback'
              }
            >
              {paused ? '▶' : '❚❚'}
            </button>
            {isHost && (
              <button className="transport-btn glass" onClick={onSkip} title="skip for everyone">
                ▸▸
              </button>
            )}
            <span className="transport-state mono">
              {paused
                ? 'paused by host'
                : isHost
                  ? 'you control playback'
                  : 'tap a feeling · keys 1–5'}
            </span>
          </div>
        </main>
      </div>

      {/* queue-exhausted intermission */}
      {awaitingMore && !showAdd && (
        <div className="audio-gate">
          <div className="intermission glass">
            <Eyebrow>~/intermission</Eyebrow>
            <h3 className="intermission-title">That's the whole queue.</h3>
            {isHost ? (
              <>
                <p className="intermission-sub">Want to listen to more, or crown the winner?</p>
                <div className="intermission-actions">
                  <Btn ghost disabled={queueFull} onClick={() => setShowAdd(true)}>
                    {queueFull ? 'Queue full' : '＋ Add songs'}
                  </Btn>
                  <Btn onClick={onFinish}>Crown the winner →</Btn>
                </div>
              </>
            ) : (
              <p className="intermission-sub">the host is deciding what's next…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
