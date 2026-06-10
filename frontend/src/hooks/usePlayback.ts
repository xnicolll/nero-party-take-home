// ============================================================
// NERO PARTY - usePlayback
// Server is the clock. Two audio elements crossfade like a DJ fader on every
// song change; the next track pre-buffers so the gate plays instantly; playback
// follows the room's global paused flag and resumes on tab return.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CurrentDTO } from '../lib/types';

const FADE_MS = 650; // crossfade length

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
  // audioRef = the element playing now; partnerRef = the idle one we fade into.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const partnerRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const primedRef = useRef(false);
  // per-element fade intervals so both sides can fade at once (a real crossfade)
  const fadesRef = useRef(new Map<HTMLAudioElement, ReturnType<typeof setInterval>>());
  // bumped on every transition; a deferred play whose generation is stale bails,
  // so a song that finishes loading after a skip/stop never starts in the background
  const genRef = useRef(0);
  const currentRef = useRef<CurrentDTO | null>(current);
  currentRef.current = current;
  const [needsGesture, setNeedsGesture] = useState(false);

  useEffect(() => {
    if (!audioRef.current) {
      const mk = (id: string) => {
        const a = new Audio();
        a.preload = 'auto';
        a.volume = 1;
        (a as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
        a.id = id;
        document.body.appendChild(a);
        return a;
      };
      audioRef.current = mk('nero-audio');
      partnerRef.current = mk('nero-audio-b');
      const p = new Audio();
      p.preload = 'auto';
      p.muted = true;
      preloadRef.current = p;
    }
    return () => {
      audioRef.current?.pause();
      partnerRef.current?.pause();
    };
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
      const fades = fadesRef.current;
      const existing = fades.get(audio);
      if (existing) clearInterval(existing);
      const start = audio.volume;
      const steps = Math.max(1, Math.round(ms / 30));
      let i = 0;
      const id = setInterval(() => {
        i++;
        audio.volume = Math.max(0, Math.min(1, start + (target - start) * (i / steps)));
        if (i >= steps) {
          clearInterval(id);
          fades.delete(audio);
          done?.();
        }
      }, 30);
      fades.set(audio, id);
    },
    [],
  );

  const seekMsFor = (c: CurrentDTO) =>
    Math.max(0, c.clipStartMs + c.positionMs + (Date.now() - c.serverTime));

  // stop now: invalidate any pending play, fade both elements out, pause
  const stop = useCallback(
    (ms = 300) => {
      genRef.current++;
      for (const el of [audioRef.current, partnerRef.current]) {
        if (el && !el.paused) fadeTo(el, 0, ms, () => el.pause());
      }
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

  // play `c` on the active element, fading in (initial start / resume / resync)
  const seekAndPlay = useCallback(
    (c: CurrentDTO) => {
      const audio = audioRef.current;
      if (!audio) return;
      const myGen = ++genRef.current;
      if (audio.src !== c.song.streamUrl) audio.src = c.song.streamUrl;
      audio.muted = false;
      audio.volume = 0;
      const apply = () => {
        if (genRef.current !== myGen) return;
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

  // crossfade: fade the active element out while the partner fades the new song in
  const crossfade = useCallback(
    (c: CurrentDTO) => {
      const from = audioRef.current;
      const to = partnerRef.current;
      if (!from || !to) return seekAndPlay(c);
      const myGen = ++genRef.current;
      to.src = c.song.streamUrl;
      to.muted = false;
      to.volume = 0;
      const apply = () => {
        if (genRef.current !== myGen) return;
        try {
          to.currentTime = seekMsFor(c) / 1000;
        } catch {
          /* re-applied on loadedmetadata */
        }
        to.play()
          .then(() => {
            if (genRef.current !== myGen) {
              to.pause();
              return;
            }
            setNeedsGesture(false);
            fadeTo(to, 1, FADE_MS);
          })
          .catch(() => setNeedsGesture(true));
      };
      if (to.readyState >= 1) apply();
      else to.addEventListener('loadedmetadata', apply, { once: true });
      // fade the outgoing song down and park it
      if (!from.paused) fadeTo(from, 0, FADE_MS, () => from.pause());
      // swap roles so the new song is now "active"
      audioRef.current = to;
      partnerRef.current = from;
    },
    [fadeTo, seekAndPlay],
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
      crossfade(c);
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
    // unlock the partner element silently so future crossfades can play
    const partner = partnerRef.current;
    if (partner) {
      const s = makeSilentUrl();
      partner.src = s;
      partner.muted = false;
      partner.volume = 0;
      partner
        .play()
        .then(() => {
          partner.pause();
          URL.revokeObjectURL(s);
        })
        .catch(() => {});
    }
    const audio = audioRef.current;
    const c = currentRef.current;
    if (c && !paused) {
      seekAndPlay(c);
      return;
    }
    const silent = makeSilentUrl();
    if (audio) {
      audio.src = silent;
      audio
        .play()
        .then(() => {
          audio.pause();
          URL.revokeObjectURL(silent);
          if (currentRef.current && !paused) seekAndPlay(currentRef.current);
        })
        .catch(() => {});
    }
  }, [paused, seekAndPlay]);

  return { needsGesture, prime };
}
