// ============================================================
// NERO PARTY - snippet preview card (rendered inside a <Modal>)
// Plays ~12s from a representative point (or a given start), eager artwork.
// ============================================================
import { useEffect, useRef } from 'react';
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
          const target = 0.75; // comfortable preview level, not full blast
          let v = 0;
          const id = setInterval(() => {
            v = Math.min(target, v + 0.09);
            a.volume = v;
            if (v >= target) clearInterval(id);
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
    <div className="sp-snippet">
      <AlbumArt artworkUrl={track.artworkUrl} hue={track.hue} size={132} radius={14} priority />
      <div className="sp-snippet-meta">
        <b>{track.title}</b>
        <span>{track.artist}</span>
      </div>
      <div className="sp-snippet-bar" aria-hidden>
        <span />
      </div>
      <span className="sp-hint">tap anywhere to close</span>
    </div>
  );
}
