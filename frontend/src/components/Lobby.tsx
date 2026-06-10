// ============================================================
// NERO PARTY - lobby: flat orb, real participants orbit in (no connectors)
// Ported from nero-lobby.jsx; nodes now come from the live snapshot.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import type { ParticipantDTO, PartyDTO, SongDTO, Track } from '../lib/types';
import { Btn, Eyebrow, StarField } from './atoms';
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
}: LobbyProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Record<string, { ang: number; r: number }>>({});
  const rotRef = useRef(-90);
  const [copied, setCopied] = useState(false);
  const [showSongs, setShowSongs] = useState(false);
  const [lastJoined, setLastJoined] = useState<string | null>(null);
  const [snippet, setSnippet] = useState<SnippetTrack | null>(null);
  const prevCount = useRef(participants.length);

  // nodes = everyone except yourself; you are the center orb
  const others = participants.filter((p) => p.id !== youId);
  const guests = participants.filter((p) => !p.isHost).length;
  const host = participants.find((p) => p.isHost);
  const inviteUrl = `${window.location.host}/j/${party.joinCode}`;

  useEffect(() => {
    if (participants.length > prevCount.current) {
      const newest = participants[participants.length - 1];
      if (newest && newest.id !== youId) setLastJoined(newest.name);
    }
    prevCount.current = participants.length;
  }, [participants, youId]);

  // even distribution; new nodes grow outward from the center (design rAF)
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const R = 168;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      rotRef.current += dt * 6;
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
          node.ang += d * 0.07;
          node.r += (R - node.r) * 0.06;
          const a = (node.ang * Math.PI) / 180;
          arm.style.setProperty('--nx', Math.cos(a) * node.r + 'px');
          arm.style.setProperty('--ny', Math.sin(a) * node.r * 0.82 + 'px');
          arm.style.opacity = String(Math.min(1, node.r / 60));
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const copy = () => {
    try {
      navigator.clipboard.writeText(`${window.location.origin}/j/${party.joinCode}`);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="lobby">
      <StarField />
      <button className="back-btn" onClick={onLeave}>
        ← leave party
      </button>
      <div className="lobby-top">
        <Eyebrow>
          ~/lobby · {party.lane.toLowerCase()} · {party.maxSongs} songs max
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

        <button className="pillnav-link mono" onClick={() => setShowSongs(true)}>
          ＋ queue songs · {songs.length}/{party.maxSongs}
        </button>

        <div className="lobby-feed">
          {participants.length <= 1 ? (
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
          <Btn big disabled={guests < 2} onClick={onStart}>
            {guests < 2 ? 'Waiting for 2+ guests' : `Start the party (${participants.length})`}
          </Btn>
        ) : (
          <span className="lobby-wait mono">waiting for the host to start…</span>
        )}
      </div>

      <Modal open={showSongs} onClose={() => setShowSongs(false)}>
        <div className="tut-card" style={{ width: 440 }}>
          <span className="tut-path">
            ~/queue · {songs.length}/{party.maxSongs}
          </span>
          <SongSearch
            search={search}
            add={add}
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
            queuedIds={new Set(songs.map((s) => s.audiusId))}
          />
          <div className="tut-foot">
            <span className="lobby-wait mono">
              {songs.length} queued · friends can add via the link
            </span>
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
