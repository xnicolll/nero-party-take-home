// ============================================================
// NERO PARTY — usePlayback: one <audio>, server-anchored seek
// The server is the clock. On each song change we seek to (clipStart +
// position + latency) and play. Browsers block autoplay until a gesture, so
// the Start/Join click primes it; otherwise we show a one-tap gate.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CurrentDTO } from '../lib/types';

export function usePlayback(current: CurrentDTO | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedKey = useRef<string>(''); // `${songId}:${serverTime}` to seek once per song
  const primedRef = useRef(false);
  const [needsGesture, setNeedsGesture] = useState(false);

  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }

  const seekAndPlay = useCallback((c: CurrentDTO) => {
    const audio = audioRef.current;
    if (!audio) return;
    const elapsed = Date.now() - c.serverTime;
    const seekMs = Math.max(0, c.clipStartMs + c.positionMs + elapsed);
    if (audio.src !== c.song.streamUrl) audio.src = c.song.streamUrl;
    const apply = () => {
      try {
        audio.currentTime = seekMs / 1000;
      } catch {
        /* will retry on canplay */
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
    if (current) seekAndPlay(current);
    else {
      // unlock the element with a silent play/pause
      audio
        .play()
        .then(() => audio.pause())
        .catch(() => {});
    }
  }, [current, seekAndPlay]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  return { needsGesture, prime };
}
