// ============================================================
// NERO PARTY - the reaction marks
// Five marks, five hues, zero chrome. Keys 1-4 + space (chills)
// fire without looking; the chills budget is dots, not a number.
// ============================================================
import { useEffect, useRef } from 'react';
import { REACTIONS, REACTION_ORDER } from '../lib/nero';
import type { ReactionType } from '../lib/types';
import { EASE_OUT } from '../lib/motion';
import { Mark } from './marks';

// the tap blooms from the button you pressed - origin-aware feedback
function bloomFrom(btn: HTMLButtonElement) {
  btn.querySelector('.sp-markbtn-bloom')?.animate(
    [
      { opacity: 0.55, transform: 'scale(0.5)' },
      { opacity: 0, transform: 'scale(2.1)' },
    ],
    { duration: 420, easing: EASE_OUT },
  );
  btn.animate([{ transform: 'scale(0.88)' }, { transform: 'scale(1)' }], {
    duration: 280,
    easing: EASE_OUT,
  });
}

export function ReactionMarks({
  onReact,
  chillsLeft,
  disabled,
}: {
  onReact: (t: ReactionType) => void;
  chillsLeft: number;
  disabled?: boolean;
}) {
  // read fresh chills inside the stable key handler without re-subscribing
  const chillsRef = useRef(chillsLeft);
  chillsRef.current = chillsLeft;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || disabled) return;
      // don't hijack keys while someone is typing in a field (search, names…)
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      // space = chills (the scarce one) - react without looking
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (chillsRef.current > 0) fireRef.current('chills'); // don't fire when you're out
        return;
      }
      const i = parseInt(e.key, 10);
      if (i >= 1 && i <= 4) fireRef.current(REACTION_ORDER[i - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onReact, disabled]);

  // keyboard reactions bloom from their button too
  const btnRefs = useRef(new Map<ReactionType, HTMLButtonElement>());
  const fire = (id: ReactionType, btn?: HTMLButtonElement | null) => {
    const el = btn ?? btnRefs.current.get(id);
    if (el) bloomFrom(el);
    onReact(id);
  };
  const fireRef = useRef(fire);
  fireRef.current = fire;

  return (
    <div className="sp-marks">
      {REACTION_ORDER.map((id, i) => {
        const r = REACTIONS[id];
        const out = r.scarce && chillsLeft <= 0;
        return (
          <button
            key={id}
            ref={(el) => {
              if (el) btnRefs.current.set(id, el);
              else btnRefs.current.delete(id);
            }}
            className="sp-markbtn"
            disabled={disabled || out}
            style={{ color: r.color }}
            onClick={(e) => fire(id, e.currentTarget)}
            title={r.scarce ? 'space' : `key ${i + 1}`}
            aria-label={`${r.label.toLowerCase()}${r.scarce ? `, ${chillsLeft} left (space)` : ` (key ${i + 1})`}`}
          >
            <span className="sp-markbtn-bloom" aria-hidden />
            <span className="sp-markbtn-glyph" aria-hidden>
              <Mark name={id} size={26} />
            </span>
            <span className="sp-markbtn-label" aria-hidden>
              {r.label.toLowerCase()}
            </span>
            {r.scarce && (
              <span className="sp-markbtn-dots" aria-hidden>
                {Array.from({ length: Math.max(0, chillsLeft) }, (_, k) => (
                  <i key={k} />
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
