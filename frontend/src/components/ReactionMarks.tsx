// ============================================================
// NERO PARTY - the reaction input
// v3: the keyboard IS the controls, no buttons to mash.
//   up    = like (a heart on the line + your face reacts)
//   space = hype (the scarce greatest signal, 3 per party)
//   down  = dislike (a skip vote; >50% of the room skips)
// A slim hand-drawn legend keeps it clear; the pre-party beat teaches it.
// ============================================================
import { useEffect, useRef } from 'react';
import type { ReactionType } from '../lib/types';
import { Mark } from './marks';

export function ReactionMarks({
  onReact,
  onDislike,
  disliked,
  hypeLeft,
  dislikeCount,
  dislikeTotal,
  disabled,
}: {
  onReact: (t: ReactionType) => void;
  onDislike: (on: boolean) => void;
  disliked: boolean;
  hypeLeft: number;
  dislikeCount: number;
  dislikeTotal: number;
  disabled?: boolean;
}) {
  // a ref so the one global key handler always sees the latest props
  const live = useRef({ onReact, onDislike, disliked, hypeLeft, disabled });
  live.current = { onReact, onDislike, disliked, hypeLeft, disabled };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const r = live.current;
      if (r.disabled) return;
      // don't hijack keys while someone is typing (search, names)
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        r.onReact('like');
      } else if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (r.hypeLeft > 0) r.onReact('hype'); // scarce: nothing happens when you're out
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        r.onDislike(!r.disliked);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const dislikePct = Math.min(100, (dislikeCount / Math.max(1, dislikeTotal)) * 100);
  return (
    <div className={'sp-keys' + (disabled ? ' off' : '')}>
      <button
        type="button"
        className="sp-input-key"
        onClick={() => !disabled && onReact('like')}
        disabled={disabled}
        aria-label="Like this moment"
      >
        <span className="sp-input-glyph like" aria-hidden>
          <Mark name="like" size={18} />
        </span>
        <kbd>up</kbd>
        <em>like</em>
      </button>
      <button
        type="button"
        className="sp-input-key"
        onClick={() => !disabled && hypeLeft > 0 && onReact('hype')}
        disabled={disabled || hypeLeft <= 0}
        aria-label={`Hype, ${hypeLeft} left`}
      >
        <span className="sp-input-glyph hype" aria-hidden>
          <Mark name="hype" size={18} />
        </span>
        <kbd>space</kbd>
        <em>hype</em>
        <span className="sp-input-dots" aria-label={`${hypeLeft} hype left`}>
          {Array.from({ length: 3 }, (_, i) => (
            <i key={i} className={i < hypeLeft ? 'on' : ''} />
          ))}
        </span>
      </button>
      <button
        type="button"
        className={'sp-input-key sp-input-dislike' + (disliked ? ' on' : '')}
        onClick={() => !disabled && onDislike(!disliked)}
        disabled={disabled}
        aria-pressed={disliked}
      >
        <span className="sp-input-glyph dislike" aria-hidden>
          <Mark name="thumbsdown" size={18} />
        </span>
        <kbd>down</kbd>
        <em>{disliked ? 'disliked' : 'dislike'}</em>
        <span className="sp-input-fill" style={{ width: `${dislikePct}%` }} aria-hidden />
      </button>
    </div>
  );
}
