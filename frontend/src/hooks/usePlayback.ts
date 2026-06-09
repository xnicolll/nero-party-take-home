// ============================================================
// NERO PARTY — usePlayback: one <audio>, server-anchored seek, smooth fades
// The server is the clock. On each song change we fade the old track out, seek
// the new one to (clipStart + position + latency), and fade it in. Browsers
// block autoplay until a gesture, so Start/Join plays a silent clip to unlock;
// a one-tap gate is the fallback. Passing current=null fades out + pauses.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CurrentDTO } from '../lib/types';

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
  for (let i = 0; i < n; i++) dv.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export function usePlayback(current: CurrentDTO | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedKey = useRef<string>('');
  const primedRef = useRef(false);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);

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

  const fadeTo = useCallback(
    (audio: HTMLAudioElement, target: number, ms: number, done?: () => void) => {
      if (fadeRef.current) clearInterval(fadeRef.current);
      const start = audio.volume;
      const steps = Math.max(1, Math.round(ms / 30));
      let i = 0;
      fadeRef.current = setInterval(() => {
        i++;
        audio.volume = Math.max(0, Math.min(1, start + (target - start) * (i / steps)));
        if (i >= steps) {
          if (fadeRef.current) clearInterval(fadeRef.current);
          fadeRef.current = null;
          done?.();
        }
      }, 30);
    },
    [],
  );

  const seekAndPlay = useCallback(
    (c: CurrentDTO) => {
      const audio = audioRef.current;
      if (!audio) return;
      const elapsed = Date.now() - c.serverTime;
      const seekMs = Math.max(0, c.clipStartMs + c.positionMs + elapsed);
      if (audio.src !== c.song.streamUrl) audio.src = c.song.streamUrl;
      audio.muted = false;
      audio.volume = 0;
      const apply = () => {
        try {
          audio.currentTime = seekMs / 1000;
        } catch {
          /* re-applied on loadedmetadata */
        }
        audio
          .play()
          .then(() => {
            setNeedsGesture(false);
            fadeTo(audio, 1, 500);
          })
          .catch(() => setNeedsGesture(true));
      };
      if (audio.readyState >= 1) apply();
      else audio.addEventListener('loadedmetadata', apply, { once: true });
    },
    [fadeTo],
  );

  // react to song changes (or stop when current goes null)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!current) {
      loadedKey.current = '';
      if (!audio.paused) fadeTo(audio, 0, 320, () => audio.pause());
      return;
    }
    const key = `${current.song.id}:${current.serverTime}`;
    if (key === loadedKey.current) return;
    loadedKey.current = key;
    if (!primedRef.current) {
      setNeedsGesture(true);
      return;
    }
    // fade the previous track out, then switch + fade in
    if (!audio.paused && audio.src && audio.src !== current.song.streamUrl) {
      fadeTo(audio, 0, 160, () => seekAndPlay(current));
    } else {
      seekAndPlay(current);
    }
  }, [current, seekAndPlay, fadeTo]);

  const prime = useCallback(() => {
    primedRef.current = true;
    const audio = audioRef.current;
    if (!audio) return;
    if (current) {
      seekAndPlay(current);
      return;
    }
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
