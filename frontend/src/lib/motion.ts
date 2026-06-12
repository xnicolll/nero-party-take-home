// ============================================================
// NERO PARTY - motion tokens
// One easing vocabulary for CSS vars, WAAPI calls, and the field,
// so every animation in the room speaks the same accent.
// ============================================================
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const EASE_INOUT = 'cubic-bezier(0.65, 0, 0.35, 1)';

export const DUR = {
  tap: 160, // press feedback
  ui: 320, // state changes
  scene: 700, // entrances, reorders
} as const;

// the audio crossfade is the clock the song-change choreography dances around
export { FADE_MS } from '../hooks/usePlayback';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}
