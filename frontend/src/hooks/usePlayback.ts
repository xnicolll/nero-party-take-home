// ============================================================
// NERO PARTY - usePlayback
// Server is the clock. New songs pre-buffer (so the gate plays instantly),
// fade in/out, preload the next track, and follow the room's global paused
// flag so play/pause/skip are real-time for everyone. Resumes on tab return.
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

export function usePlayback(current: CurrentDTO | null, nextUrl?: string | null, paused = false) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const primedRef = useRef(false);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // bumped on every transition; a deferred play whose generation is stale bails,
  // so a song that finishes loading after a skip/stop never starts in the background
  const genRef = useRef(0);
  const currentRef = useRef<CurrentDTO | null>(current);
  currentRef.current = current;
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
      const p = new Audio();
      p.preload = 'auto';
      p.muted = true;
      preloadRef.current = p;
    }
    const a = audioRef.current!;
    return () => a.pause();
  }, []);

  useEffect(() => {
    const p = preloadRef.current;
    if (!p || !nextUrl) return;
    if (p.src !== nextUrl) {
      p.src = nextUrl;
      p.load();
    }
  }, [nextUrl]);

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

  const seekMsFor = (c: CurrentDTO) =>
    Math.max(0, c.clipStartMs + c.positionMs + (Date.now() - c.serverTime));

  // stop now: invalidate any pending play, fade out, pause
  const stop = useCallback(
    (ms = 300) => {
      genRef.current++;
      const audio = audioRef.current;
      if (!audio) return;
      if (!audio.paused) fadeTo(audio, 0, ms, () => audio.pause());
    },
    [fadeTo],
  );

  // pre-buffer the clip (no playback) so the gesture starts instantly
  const warm = useCallback((c: CurrentDTO) => {
    const audio = audioRef.current;
    if (!audio) return;
    const myGen = ++genRef.current;
    if (audio.src !== c.song.streamUrl) audio.src = c.song.streamUrl;
    const seek = () => {
      if (genRef.current !== myGen) return;
      try {
        audio.currentTime = seekMsFor(c) / 1000;
      } catch {
        /* ignore */
      }
    };
    if (audio.readyState >= 1) seek();
    else audio.addEventListener('loadedmetadata', seek, { once: true });
  }, []);

  const seekAndPlay = useCallback(
    (c: CurrentDTO) => {
      const audio = audioRef.current;
      if (!audio) return;
      const myGen = ++genRef.current;
      if (audio.src !== c.song.streamUrl) audio.src = c.song.streamUrl;
      audio.muted = false;
      audio.volume = 0;
      const apply = () => {
        if (genRef.current !== myGen) return; // a newer transition happened; don't play
        try {
          audio.currentTime = seekMsFor(c) / 1000;
        } catch {
          /* re-applied on loadedmetadata */
        }
        audio
          .play()
          .then(() => {
            if (genRef.current !== myGen) {
              audio.pause();
              return;
            }
            setNeedsGesture(false);
            fadeTo(audio, 1, 450);
          })
          .catch(() => setNeedsGesture(true));
      };
      if (audio.readyState >= 1) apply();
      else audio.addEventListener('loadedmetadata', apply, { once: true });
    },
    [fadeTo],
  );

  // new song (or stop when current goes null)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const c = currentRef.current;
    if (!c) {
      stop(320);
      return;
    }
    if (!primedRef.current) {
      warm(c); // pre-buffer for an instant gate
      setNeedsGesture(true);
      return;
    }
    if (paused) {
      warm(c);
      return;
    }
    if (!audio.paused && audio.src && audio.src !== c.song.streamUrl) {
      fadeTo(audio, 0, 160, () => seekAndPlay(c));
    } else {
      seekAndPlay(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.song.id]);

  // global pause / resume (real-time for everyone)
  const firstPaused = useRef(true);
  useEffect(() => {
    if (firstPaused.current) {
      firstPaused.current = false;
      return;
    }
    const c = currentRef.current;
    if (!primedRef.current || !c) return;
    if (paused) {
      stop(150);
    } else {
      seekAndPlay(c);
    }
  }, [paused, seekAndPlay, stop]);

  // returning to the tab can suspend audio - resync
  useEffect(() => {
    const resync = () => {
      if (document.visibilityState !== 'visible') return;
      const c = currentRef.current;
      if (!primedRef.current || !c || paused) return;
      const a = audioRef.current;
      if (a && (a.paused || a.readyState < 2)) seekAndPlay(c);
    };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
    };
  }, [paused, seekAndPlay]);

  const prime = useCallback(() => {
    primedRef.current = true;
    const audio = audioRef.current;
    if (!audio) return;
    const c = currentRef.current;
    if (c && !paused) {
      seekAndPlay(c);
      return;
    }
    const silent = makeSilentUrl();
    audio.src = silent;
    audio
      .play()
      .then(() => {
        audio.pause();
        URL.revokeObjectURL(silent);
        if (currentRef.current && !paused) seekAndPlay(currentRef.current);
      })
      .catch(() => {});
  }, [paused, seekAndPlay]);

  return { needsGesture, prime };
}
