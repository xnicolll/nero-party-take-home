// ============================================================
// NERO PARTY - snippet preview card (rendered inside a <Modal>)
// Plays ~12s from a representative point (or a given start), eager artwork.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { fmtTime } from '../lib/nero';
import { AlbumArt } from './atoms';

export interface SnippetTrack {
  title: string;
  artist: string;
  streamUrl: string;
  artworkUrl: string | null;
  hue: number;
  durationSec: number;
  startFrac?: number; // where to start the preview (0..1); defaults to 30%
}

export function SnippetPlayer({ track, onDone }: { track: SnippetTrack; onDone: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [left, setLeft] = useState(12);

  useEffect(() => {
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const a = new Audio();
    a.preload = 'auto';
    a.volume = 0;
    a.src = track.streamUrl;
    audioRef.current = a;
    const begin = () => {
      const frac = track.startFrac ?? 0.3;
      try {
        a.currentTime = Math.max(
          0,
          Math.min((track.durationSec || 60) - 1, (track.durationSec || 60) * frac),
        );
      } catch {
        /* ignore */
      }
      a.play()
        .then(() => {
          let v = 0;
          const id = setInterval(() => {
            v = Math.min(1, v + 0.12);
            a.volume = v;
            if (v >= 1) clearInterval(id);
          }, 35);
        })
        .catch(() => {});
    };
    if (a.readyState >= 1) begin();
    else a.addEventListener('loadedmetadata', begin, { once: true });
    const stop = setTimeout(onDone, 12000);
    return () => {
      clearTimeout(stop);
      a.pause();
      a.src = '';
    };
  }, [track, onDone]);

  return (
    <div className="snippet glass">
      <AlbumArt artworkUrl={track.artworkUrl} hue={track.hue} size={140} radius={16} priority />
      <div>
        <div className="snippet-title">{track.title}</div>
        <div className="mono" style={{ color: 'var(--ink-dim)', fontSize: 12, marginTop: 2 }}>
          {track.artist} · {fmtTime(track.durationSec)}
        </div>
      </div>
      <div className="snippet-bar">
        <span />
      </div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
        <b style={{ color: 'var(--accent)' }}>{left}s</b> left · tap anywhere to close
      </div>
    </div>
  );
}
