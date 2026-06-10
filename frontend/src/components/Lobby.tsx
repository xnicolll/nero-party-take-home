// ============================================================
// NERO PARTY - lobby: flat orb, real participants orbit in (no connectors)
// nodes come from the live snapshot.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import type { ParticipantDTO, PartyDTO, SongDTO, Track } from '../lib/types';
import { AlbumArt, Btn, Eyebrow, StarField } from './atoms';
import { SongSearch } from './SongSearch';
import { SnippetPlayer, type SnippetTrack } from './SnippetPlayer';
import { Modal } from './Modal';

interface LobbyProps {
  party: PartyDTO;
  participants: ParticipantDTO[];
  songs: SongDTO[];
  youId: string;
  isHost: boolean;
  onStart: () => void;
  onLeave: () => void;
  search: (q: string) => Promise<Track[]>;
  add: (t: Track) => Promise<{ ok: boolean; reason?: string }>;
  remove: (songId: string) => void;
}

export function Lobby({
  party,
  participants,
  songs,
  youId,
  isHost,
  onStart,
  onLeave,
  search,
  add,
  remove,
}: LobbyProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Record<string, { ang: number; r: number }>>({});
  const rotRef = useRef(-90);
  const [copied, setCopied] = useState(false);
  const [showSongs, setShowSongs] = useState(false);
  const [lastJoined, setLastJoined] = useState<string | null>(null);
  const [snippet, setSnippet] = useState<SnippetTrack | null>(null);
  const prevIds = useRef<Set<string>>(new Set(participants.map((p) => p.id)));
  const promptedRef = useRef(false);

  // prompt the host to add songs the moment they land in an empty lobby
  useEffect(() => {
    if (isHost && songs.length === 0 && !promptedRef.current) {
      promptedRef.current = true;
      setShowSongs(true);
    }
  }, [isHost, songs.length]);

  // nodes = everyone except yourself; you are the center orb
  const others = participants.filter((p) => p.id !== youId);
  const guests = participants.filter((p) => !p.isHost).length;
  const host = participants.find((p) => p.isHost);
  const inviteUrl = `${window.location.host}/j/${party.joinCode}`;

  useEffect(() => {
    // announce genuinely-new people by id (handles several arriving at once)
    const fresh = participants.filter((p) => !prevIds.current.has(p.id) && p.id !== youId);
    if (fresh.length && prevIds.current.size > 0) setLastJoined(fresh[fresh.length - 1].name);
    prevIds.current = new Set(participants.map((p) => p.id));
  }, [participants, youId]);

  // even distribution; new nodes grow outward from the center (design rAF).
  // Pauses when the tab is hidden, and holds still under reduced-motion.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();
    const R = 168;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce) rotRef.current += dt * 6; // don't spin under reduced-motion
      const field = fieldRef.current;
      if (field) {
        const arms = [...field.querySelectorAll<HTMLElement>('.lobby-node-arm')];
        const n = arms.length;
        arms.forEach((arm, i) => {
          const id = arm.dataset.id!;
          const target = rotRef.current + i * (360 / n);
          if (!nodesRef.current[id]) nodesRef.current[id] = { ang: target, r: 0 };
          const node = nodesRef.current[id];
          const d = ((target - node.ang + 540) % 360) - 180;
          node.ang += d * (reduce ? 0.3 : 0.07);
          node.r += (R - node.r) * (reduce ? 0.3 : 0.06);
          const a = (node.ang * Math.PI) / 180;
          arm.style.setProperty('--nx', Math.cos(a) * node.r + 'px');
          arm.style.setProperty('--ny', Math.sin(a) * node.r * 0.82 + 'px');
          arm.style.opacity = String(Math.min(1, node.r / 60));
        });
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) start();
    };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const copy = () => {
    const url = `${window.location.origin}/j/${party.joinCode}`;
    // only claim success if the clipboard write actually resolves
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {},
    );
  };

  return (
    <div className="lobby">
      <StarField />
      <button className="back-btn" onClick={onLeave}>
        ← leave party
      </button>
      <div className="lobby-top">
        <Eyebrow>
          lobby · {party.lane.toLowerCase()} · {party.maxSongs} songs max
          {host ? ` · hosted by ${host.name}` : ''}
        </Eyebrow>
        <h2 className="lobby-title">{party.name}</h2>
      </div>

      <div ref={fieldRef} className="lobby-field">
        <div className="orb orb-core">
          <span className="orb-count">{participants.length}</span>
        </div>
        {others.map((p) => (
          <div key={p.id} className="lobby-node-arm" data-id={p.id}>
            <div className="lobby-node" style={{ borderColor: p.color, color: p.color }}>
              <span className="lobby-node-dot" style={{ background: p.color }} />
              {p.name}
              {p.isHost && <span title="host"> ✦</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="lobby-bottom">
        <button className="invite-chip" onClick={copy}>
          <span className="invite-url">{inviteUrl}</span>
          <span className="invite-copy">{copied ? 'COPIED ✓' : 'COPY LINK'}</span>
        </button>

        <button
          className={'pillnav-link mono lobby-add' + (songs.length === 0 ? ' lobby-add-empty' : '')}
          onClick={() => setShowSongs(true)}
        >
          ＋ queue songs · {songs.length}/{party.maxSongs}
        </button>

        <div className="lobby-feed">
          {songs.length === 0 ? (
            <span className="lobby-wait">the queue is empty · add songs to play</span>
          ) : participants.length <= 1 ? (
            <span className="lobby-wait">waiting for friends…</span>
          ) : lastJoined ? (
            <span key={lastJoined + participants.length} className="lobby-joinmsg">
              {lastJoined} joined the party
            </span>
          ) : (
            <span className="lobby-wait">{guests} here</span>
          )}
        </div>

        {isHost ? (
          <Btn big disabled={guests < 2 || songs.length === 0} onClick={onStart}>
            {songs.length === 0
              ? 'Add a song to start'
              : guests < 2
                ? 'Waiting for 2+ guests'
                : `Start the party (${participants.length})`}
          </Btn>
        ) : (
          <span className="lobby-wait mono">waiting for the host to start…</span>
        )}
      </div>

      <Modal open={showSongs} onClose={() => setShowSongs(false)}>
        <div className="tut-card" style={{ width: 440 }}>
          <span className="tut-path">
            your queue · {songs.length}/{party.maxSongs}
          </span>
          <SongSearch
            search={search}
            add={add}
            onUnqueue={(trackId) => {
              const s = songs.find((x) => x.trackId === trackId);
              if (s) remove(s.id);
            }}
            onPreview={(t) =>
              setSnippet({
                title: t.title,
                artist: t.artist,
                streamUrl: t.streamUrl,
                artworkUrl: t.artworkUrl,
                hue: t.hue,
                durationSec: t.durationSec,
              })
            }
            full={songs.length >= party.maxSongs}
            queuedIds={new Set(songs.map((s) => s.trackId))}
          />
          {songs.length > 0 && (
            <>
              <Eyebrow>in the queue · {songs.length}</Eyebrow>
              <div className="search-results" style={{ maxHeight: 160 }}>
                {songs.map((s) => (
                  <div key={s.id} className="search-row queue-item">
                    <AlbumArt artworkUrl={s.artworkUrl} hue={s.hue} size={30} radius={6} />
                    <div className="search-row-meta">
                      <b>{s.title}</b>
                      <span>
                        {s.artist} · {s.addedByName.toLowerCase()}
                      </span>
                    </div>
                    <button
                      className="search-row-btn mono"
                      title="preview"
                      aria-label={`Preview ${s.title}`}
                      onClick={() =>
                        setSnippet({
                          title: s.title,
                          artist: s.artist,
                          streamUrl: s.streamUrl,
                          artworkUrl: s.artworkUrl,
                          hue: s.hue,
                          durationSec: s.durationSec,
                        })
                      }
                    >
                      <span aria-hidden>▶</span>
                    </button>
                    <button
                      className="search-row-btn remove mono"
                      title="remove from queue"
                      aria-label={`Remove ${s.title} from the queue`}
                      onClick={() => remove(s.id)}
                    >
                      <span aria-hidden>✕</span>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="tut-foot">
            <span className="lobby-wait mono">friends can add via the link</span>
            <button className="tut-next" onClick={() => setShowSongs(false)}>
              done →
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!snippet} onClose={() => setSnippet(null)}>
        {snippet && <SnippetPlayer track={snippet} onDone={() => setSnippet(null)} />}
      </Modal>
    </div>
  );
}
