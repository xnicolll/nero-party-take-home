// ============================================================
// NERO PARTY - guest faces
// Every person in the room is a wobbly hand-drawn ink FACE in their
// color, living on the right margin. It breathes while idle, bounces
// + grins on a like, and grows + spins on a hype. The name sits to
// its left, always on; the host's face wears the crown.
// ============================================================
import { useEffect, useMemo, useRef } from 'react';
import './GuestDoodles.css';
import type { ParticipantDTO } from '../lib/types';
import { fieldBus } from '../lib/fieldBus';
import { blobPath, prng, seedFromName, smoothPath } from '../lib/ink';
import { EASE_INOUT, EASE_OUT, prefersReducedMotion } from '../lib/motion';
import { Mark } from './marks';

const SIZE = 78; // big, friendly faces on the right margin
// an overshooting spring for the like hop, so it lands with bounce
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const VB = 40; // viewBox is square; everything is drawn in this space
const C = VB / 2;

type FaceGeom = {
  head: string;
  eyeL: [number, number];
  eyeR: [number, number];
  eyeR_px: number;
  mouthCalm: string;
  mouthGrin: string;
};

// build one guest's face from a name-seeded prng so each is a little odd
function faceGeom(name: string): FaceGeom {
  const rnd = prng(seedFromName(name) ^ 0x9e3779b1);
  const head = blobPath(C, C, 13.5, seedFromName(name));

  // eyes: two dots, sat a hair above center, with a little asymmetry
  const eyeY = C - 1.5 + (rnd() - 0.5) * 1.6;
  const gap = 5.4 + rnd() * 1.6;
  const eyeL: [number, number] = [C - gap, eyeY + (rnd() - 0.5) * 1.2];
  const eyeR: [number, number] = [C + gap, eyeY + (rnd() - 0.5) * 1.2];
  const eyeR_px = 1.3 + rnd() * 0.6;

  // calm mouth: a gentle wobbly curve. grin: a wide upturned banana.
  const mY = C + 5 + (rnd() - 0.5) * 1.4;
  const mW = 4.4 + rnd() * 1.4;
  const calmDip = (rnd() - 0.5) * 2.4; // can smirk up or down a touch
  const mouthCalm = smoothPath([
    [C - mW, mY],
    [C, mY + calmDip],
    [C + mW, mY],
  ]);
  const mouthGrin = smoothPath([
    [C - mW - 1.4, mY - 1.6],
    [C, mY + 3.4],
    [C + mW + 1.4, mY - 1.6],
  ]);

  return { head, eyeL, eyeR, eyeR_px, mouthCalm, mouthGrin };
}

export function GuestDoodles({
  participants,
  youId,
}: {
  participants: ParticipantDTO[];
  youId: string;
}) {
  const refs = useRef(new Map<string, HTMLSpanElement>());
  const mouths = useRef(new Map<string, SVGPathElement>());
  const names = useRef(new Map<string, HTMLElement>());
  const prevIds = useRef(new Set(participants.map((p) => p.id)));

  const geom = useMemo(() => {
    const m = new Map<string, FaceGeom>();
    for (const p of participants) m.set(p.id, faceGeom(p.name));
    return m;
  }, [participants]);

  // react when a guest's own reaction lands on the bus
  useEffect(() => {
    return fieldBus.on('reaction', (e) => {
      if (prefersReducedMotion()) return;
      const el = refs.current.get(e.participantId);
      if (!el) return;

      if (e.type === 'hype') {
        // a giddy windup, then two full celebratory spins as it grows + settles
        el.animate(
          [
            { transform: 'rotate(0deg) scale(1)' },
            { transform: 'rotate(-26deg) scale(1.08)', offset: 0.12 },
            { transform: 'rotate(340deg) scale(1.4)', offset: 0.5 },
            { transform: 'rotate(700deg) scale(1.12)', offset: 0.82 },
            { transform: 'rotate(720deg) scale(1)' },
          ],
          { duration: 1080, easing: EASE_OUT },
        );
        // the mouth rides along, grinning through the spin
        const mouth = mouths.current.get(e.participantId);
        const g = geom.get(e.participantId);
        if (mouth && g) {
          mouth.animate(
            [
              { d: `path('${g.mouthCalm}')` },
              { d: `path('${g.mouthGrin}')`, offset: 0.18 },
              { d: `path('${g.mouthGrin}')`, offset: 0.82 },
              { d: `path('${g.mouthCalm}')` },
            ],
            { duration: 1400, easing: EASE_OUT },
          );
        }
      } else {
        // a springy, bouncy hop with a playful wiggle on the way down
        el.animate(
          [
            { transform: 'translateY(0) rotate(0deg) scale(1)' },
            { transform: 'translateY(-13px) rotate(-7deg) scale(1.2)', offset: 0.28 },
            { transform: 'translateY(1px) rotate(5deg) scale(0.92)', offset: 0.52 },
            { transform: 'translateY(-5px) rotate(-3deg) scale(1.06)', offset: 0.72 },
            { transform: 'translateY(0) rotate(0deg) scale(1)' },
          ],
          { duration: 760, easing: SPRING },
        );
        // and the mouth holds a big grin for a good while before easing back calm
        const mouth = mouths.current.get(e.participantId);
        const g = geom.get(e.participantId);
        if (mouth && g) {
          mouth.animate(
            [
              { d: `path('${g.mouthCalm}')`, easing: EASE_OUT },
              { d: `path('${g.mouthGrin}')`, offset: 0.12 },
              { d: `path('${g.mouthGrin}')`, offset: 0.78, easing: EASE_INOUT },
              { d: `path('${g.mouthCalm}')` },
            ],
            { duration: 2800, easing: EASE_OUT },
          );
        }
      }
    });
  }, [geom]);

  // when someone steps in, their name flashes brighter for a beat
  useEffect(() => {
    const fresh = participants.filter((p) => !prevIds.current.has(p.id));
    prevIds.current = new Set(participants.map((p) => p.id));
    if (!fresh.length) return;
    const id = fresh[fresh.length - 1].id;
    const el = names.current.get(id);
    if (!el) return;
    el.classList.add('flash');
    const t = setTimeout(() => el.classList.remove('flash'), 2400);
    return () => clearTimeout(t);
  }, [participants]);

  return (
    <div className="sp-faces" aria-label="people in the party">
      {participants.map((p) => {
        const g = geom.get(p.id)!;
        return (
          <span
            key={p.id}
            className="sp-face"
            tabIndex={0}
            aria-label={`${p.name}${p.isHost ? ', host' : ''}${p.id === youId ? ', you' : ''}`}
          >
            <i
              ref={(el) => {
                if (el) names.current.set(p.id, el);
                else names.current.delete(p.id);
              }}
              className="sp-face-name"
            >
              {p.name}
              {p.id === youId ? ' (you)' : ''}
            </i>
            <span
              ref={(el) => {
                if (el) refs.current.set(p.id, el);
                else refs.current.delete(p.id);
              }}
              className="sp-face-body"
            >
              <svg viewBox={`0 0 ${VB} ${VB}`} width={SIZE} height={SIZE} aria-hidden>
                <path
                  d={g.head}
                  fill={p.color}
                  stroke="var(--sp-ink)"
                  strokeWidth={1.7}
                  strokeLinejoin="round"
                />
                <circle cx={g.eyeL[0]} cy={g.eyeL[1]} r={g.eyeR_px} fill="var(--sp-ink)" />
                <circle cx={g.eyeR[0]} cy={g.eyeR[1]} r={g.eyeR_px} fill="var(--sp-ink)" />
                <path
                  ref={(el) => {
                    if (el) mouths.current.set(p.id, el);
                    else mouths.current.delete(p.id);
                  }}
                  d={g.mouthCalm}
                  fill="none"
                  stroke="var(--sp-ink)"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                />
              </svg>
              {p.isHost && (
                <span className="sp-face-crown" aria-hidden>
                  <Mark name="host" size={18} strokeWidth={2.6} />
                </span>
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
}
