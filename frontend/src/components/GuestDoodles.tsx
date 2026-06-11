// ============================================================
// NERO PARTY - guest doodles
// Every person in the room is a small hand-drawn blob in their
// color, living on the right margin. It wiggles when they react;
// hover reveals the name. The host's doodle wears the crown.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import type { ParticipantDTO } from '../lib/types';
import { fieldBus } from '../lib/fieldBus';
import { blobPath, seedFromName } from '../lib/ink';
import { EASE_OUT, prefersReducedMotion } from '../lib/motion';
import { Mark } from './marks';

export function GuestDoodles({
  participants,
  youId,
}: {
  participants: ParticipantDTO[];
  youId: string;
}) {
  const refs = useRef(new Map<string, HTMLSpanElement>());
  const [flash, setFlash] = useState<string | null>(null);
  const prevIds = useRef(new Set(participants.map((p) => p.id)));

  useEffect(() => {
    return fieldBus.on('reaction', (e) => {
      if (prefersReducedMotion()) return;
      const el = refs.current.get(e.participantId);
      el?.animate(
        [
          { transform: 'rotate(0deg) scale(1)' },
          { transform: 'rotate(-9deg) scale(1.18)' },
          { transform: 'rotate(7deg) scale(0.94)' },
          { transform: 'rotate(0deg) scale(1)' },
        ],
        { duration: 540, easing: EASE_OUT },
      );
    });
  }, []);

  // when someone steps in, their name flashes beside their doodle
  useEffect(() => {
    const fresh = participants.filter((p) => !prevIds.current.has(p.id));
    prevIds.current = new Set(participants.map((p) => p.id));
    if (!fresh.length) return;
    setFlash(fresh[fresh.length - 1].id);
    const t = setTimeout(() => setFlash(null), 2400);
    return () => clearTimeout(t);
  }, [participants]);

  return (
    <div className="sp-doodles" aria-label="people in the party">
      {participants.map((p) => (
        <span
          key={p.id}
          ref={(el) => {
            if (el) refs.current.set(p.id, el);
            else refs.current.delete(p.id);
          }}
          className="sp-doodle"
          tabIndex={0}
          aria-label={`${p.name}${p.isHost ? ', host' : ''}${p.id === youId ? ', you' : ''}`}
        >
          <svg viewBox="0 0 34 34" width="38" height="38" aria-hidden>
            <path
              d={blobPath(17, 17, 11.5, seedFromName(p.name))}
              fill={p.color}
              stroke="var(--sp-ink)"
              strokeWidth={1.6}
            />
          </svg>
          {p.isHost && (
            <span className="sp-doodle-crown" aria-hidden>
              <Mark name="host" size={10} strokeWidth={2.8} />
            </span>
          )}
          <i className={'sp-doodle-name' + (flash === p.id ? ' show' : '')}>
            {p.name}
            {p.id === youId ? ' (you)' : ''}
          </i>
        </span>
      ))}
    </div>
  );
}
