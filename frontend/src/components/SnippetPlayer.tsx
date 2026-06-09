// ============================================================
// NERO PARTY — short snippet preview in a modal
// Plays ~12s of a track from a representative point. Opened from a click so
// the browser allows playback; if it's blocked it still shows the artwork.
// ============================================================
import { useEffect, useRef } from 'react';
import { fmtTime } from '../lib/nero';
import { AlbumArt } from './atoms';

export interface SnippetTrack {
  title: string;
  artist: string;
  streamUrl: string;
  artworkUrl: string | null;
  hue: number;
  durationSec: number;
}

export function SnippetPlayer({ track, onClose }: { track: SnippetTrack; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = new Audio(track.streamUrl);
    a.volume = 0;
    audioRef.current = a;
    const begin = () => {
      try {
        a.currentTime = Math.min(35, Math.max(0, (track.durationSec || 60) * 0.3));
      } catch {
        /* ignore */
      }
      a.play()
        .then(() => {
          // gentle fade in
          let v = 0;
          const id = setInterval(() => {
            v = Math.min(1, v + 0.1);
            a.volume = v;
            if (v >= 1) clearInterval(id);
          }, 40);
        })
        .catch(() => {});
    };
    if (a.readyState >= 1) begin();
    else a.addEventListener('loadedmetadata', begin, { once: true });
    const stop = setTimeout(onClose, 12000);
    return () => {
      clearTimeout(stop);
      a.pause();
      a.src = '';
    };
  }, [track, onClose]);

  return (
    <div className="audio-gate" onClick={onClose}>
      <div className="snippet glass" onClick={(e) => e.stopPropagation()}>
        <AlbumArt artworkUrl={track.artworkUrl} hue={track.hue} size={140} radius={16} />
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
          12s preview · tap anywhere to close
        </div>
      </div>
    </div>
  );
}
