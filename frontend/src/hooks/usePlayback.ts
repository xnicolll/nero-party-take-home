// ============================================================
// NERO PARTY — usePlayback: one <audio>, server-anchored seek
// The server is the clock. On each song change we seek to (clipStart +
// position + latency) and play. Browsers block autoplay until a gesture, so
// the Start/Join click "primes" the element by playing a silent clip (which
// has a real src, so the unlock actually lands); a one-tap gate is the fallback.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CurrentDTO } from '../lib/types';

// A valid, tiny silent WAV used only to unlock audio inside a user gesture.
function makeSilentUrl(): string {
  const sr = 8000;
  const n = Math.floor(sr * 0.05);
  const buf = new ArrayBuffer(44 + n);
  const dv = new DataView(buf);
  const ws = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };
  ws(0, 'RIFF');
  dv.setUint32(4, 36 + n, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true);
  dv.setUint32(28, sr, true);
  dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true);
  ws(36, 'data');
  dv.setUint32(40, n, true);
  for (let i = 0; i < n; i++) dv.setUint8(44 + i, 128); // 8-bit silence
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export function usePlayback(current: CurrentDTO | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedKey = useRef<string>(''); // `${songId}:${serverTime}` to seek once per song
  const primedRef = useRef(false);
  const [needsGesture, setNeedsGesture] = useState(false);

  // create + mount the element once (in the DOM so playback is reliable)
  useEffect(() => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'auto';
      a.volume = 1;
      (a as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
      a.id = 'nero-audio';
      audioRef.current = a;
      document.body.appendChild(a);
    }
    const el = audioRef.current;
    return () => {
      el?.pause();
    };
  }, []);

  const seekAndPlay = useCallback((c: CurrentDTO) => {
    const audio = audioRef.current;
    if (!audio) return;
    const elapsed = Date.now() - c.serverTime;
    const seekMs = Math.max(0, c.clipStartMs + c.positionMs + elapsed);
    if (audio.src !== c.song.streamUrl) audio.src = c.song.streamUrl;
    audio.muted = false;
    const apply = () => {
      try {
        audio.currentTime = seekMs / 1000;
      } catch {
        /* re-applied on loadedmetadata */
      }
      audio
        .play()
        .then(() => setNeedsGesture(false))
        .catch(() => setNeedsGesture(true));
    };
    if (audio.readyState >= 1) apply();
    else audio.addEventListener('loadedmetadata', apply, { once: true });
  }, []);

  // react to song changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!current) {
      audio.pause();
      loadedKey.current = '';
      return;
    }
    const key = `${current.song.id}:${current.serverTime}`;
    if (key === loadedKey.current) return;
    loadedKey.current = key;
    if (primedRef.current) seekAndPlay(current);
    else setNeedsGesture(true);
  }, [current, seekAndPlay]);

  // call inside a user gesture (Start / Join / the gate button)
  const prime = useCallback(() => {
    primedRef.current = true;
    const audio = audioRef.current;
    if (!audio) return;
    if (current) {
      seekAndPlay(current);
      return;
    }
    // No song loaded yet (host pressed Start). Unlock the element NOW with a
    // silent clip that has a real src, so the later programmatic play() is allowed.
    const silent = makeSilentUrl();
    audio.src = silent;
    audio
      .play()
      .then(() => {
        audio.pause();
        URL.revokeObjectURL(silent);
      })
      .catch(() => {});
  }, [current, seekAndPlay]);

  return { needsGesture, prime };
}
