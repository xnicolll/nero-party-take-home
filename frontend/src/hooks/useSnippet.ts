// ============================================================
// NERO PARTY - landing snippet preview
// Hovering an album card for a beat plays a short taste of the
// track: seek into the song, fade up, and fade back out the
// moment the mouse leaves. Only one snippet sounds at a time.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';

const HOVER_DELAY = 300; // hover-intent: a passing mouse should not trigger
const PEAK_VOL = 0.7;
const FADE_IN_MS = 150;
const FADE_OUT_MS = 120;
const SEEK_FRAC = 0.3; // drop in ~30% through the clip, past any intro
const FADE_STEP_MS = 20;

export interface Snippet {
  // id of the card currently sounding (or arming), for the glow
  playingId: string | null;
  // arm a card: starts after the hover-intent delay
  enter: (id: string, streamUrl: string, durationSec: number) => void;
  // leave a card: fades out + stops if it was the active one
  leave: (id: string) => void;
  // first user gesture unlocks audio so later hovers are instant
  unlock: () => void;
}

export function useSnippet(): Snippet {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const armRef = useRef<number | null>(null); // hover-intent timer
  const fadeRef = useRef<number | null>(null); // volume ramp timer
  const armedFor = useRef<string | null>(null); // card the arm timer is for
  const unlocked = useRef(false);

  const getAudio = () => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'auto';
      a.volume = 0;
      audioRef.current = a;
    }
    return audioRef.current;
  };

  const clearTimers = () => {
    if (armRef.current !== null) {
      clearTimeout(armRef.current);
      armRef.current = null;
    }
    if (fadeRef.current !== null) {
      clearInterval(fadeRef.current);
      fadeRef.current = null;
    }
  };

  const ramp = useCallback((to: number, ms: number, onDone?: () => void) => {
    const a = getAudio();
    if (fadeRef.current !== null) clearInterval(fadeRef.current);
    const from = a.volume;
    const steps = Math.max(1, Math.round(ms / FADE_STEP_MS));
    let step = 0;
    fadeRef.current = window.setInterval(() => {
      step += 1;
      const v = from + (to - from) * (step / steps);
      a.volume = Math.min(1, Math.max(0, v));
      if (step >= steps) {
        if (fadeRef.current !== null) clearInterval(fadeRef.current);
        fadeRef.current = null;
        onDone?.();
      }
    }, FADE_STEP_MS);
  }, []);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    ramp(0, FADE_OUT_MS, () => {
      a.pause();
    });
  }, [ramp]);

  const start = useCallback(
    (id: string, streamUrl: string, durationSec: number) => {
      const a = getAudio();
      a.src = streamUrl;
      a.currentTime = (durationSec || 30) * SEEK_FRAC;
      a.volume = 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') {
        p
          .then(() => {
            setPlayingId(id);
            ramp(PEAK_VOL, FADE_IN_MS);
          })
          .catch(() => {
            // autoplay still blocked: fail silently until a gesture unlocks
          });
      } else {
        setPlayingId(id);
        ramp(PEAK_VOL, FADE_IN_MS);
      }
    },
    [ramp],
  );

  const enter = useCallback(
    (id: string, streamUrl: string, durationSec: number) => {
      clearTimers();
      armedFor.current = id;
      armRef.current = window.setTimeout(() => {
        armRef.current = null;
        start(id, streamUrl, durationSec);
      }, HOVER_DELAY);
    },
    [start],
  );

  const leave = useCallback(
    (id: string) => {
      // only react to the card we are actually armed/playing for
      if (armedFor.current === id) armedFor.current = null;
      if (armRef.current !== null) {
        clearTimeout(armRef.current);
        armRef.current = null;
      }
      if (playingId === id) {
        stop();
        setPlayingId(null);
      }
    },
    [playingId, stop],
  );

  const unlock = useCallback(() => {
    if (unlocked.current) return;
    unlocked.current = true;
    const a = getAudio();
    const wasMuted = a.muted;
    a.muted = true;
    const p = a.play();
    if (p && typeof p.then === 'function') {
      p
        .then(() => {
          a.pause();
          a.muted = wasMuted;
        })
        .catch(() => {
          a.muted = wasMuted;
        });
    } else {
      a.muted = wasMuted;
    }
  }, []);

  // tidy up timers + audio on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.src = '';
      }
    };
  }, []);

  return { playingId, enter, leave, unlock };
}
