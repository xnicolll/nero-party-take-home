// ============================================================
// NERO PARTY - the ghost-ink tour
// First party only: the ink line draws three quick labelled
// arrows over the REAL interface (the line, the marks, the reel).
// Any click dismisses it forever. The ? button replays it.
// ============================================================
import { useEffect, useState } from 'react';
import { arrowPath } from '../lib/ink';
import { InkStroke } from './ink';

interface Note {
  tx: number; // arrow tip (the thing being pointed at)
  ty: number;
  lx: number; // label chip position
  ly: number;
  label: string;
  seed: number;
  tilt: number;
}

export function GhostTour({ onClose }: { onClose: () => void }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [closing, setClosing] = useState(false);

  // close = the opening in reverse, quicker
  const dismiss = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 400);
  };

  useEffect(() => {
    const rect = (sel: string) => document.querySelector(sel)?.getBoundingClientRect();
    const line = rect('.sp-party-line');
    const marks = rect('.sp-marks');
    const reel = rect('.sp-reel');
    const vw = window.innerWidth;
    const found: Note[] = [];
    if (line)
      found.push({
        tx: Math.min(vw - 200, line.left + line.width * 0.68),
        ty: line.top + line.height * 0.55,
        lx: Math.min(vw - 320, line.left + line.width * 0.68 + 60),
        ly: line.top + line.height + 56,
        label: 'the song draws this line as it plays. every tap stamps it',
        seed: 3,
        tilt: -2,
      });
    if (marks)
      found.push({
        tx: marks.left + marks.width * 0.5,
        ty: marks.top + 6,
        lx: marks.left + marks.width * 0.5 + 120,
        ly: marks.top - 64,
        label: 'tap what you feel, the second you feel it (keys 1-4, space)',
        seed: 5,
        tilt: 1.5,
      });
    if (reel)
      found.push({
        tx: reel.left + reel.width * 0.3,
        ty: reel.top + 48,
        lx: reel.left + reel.width * 0.3 + 150,
        ly: reel.top - 40,
        label: 'tap any art to queue it next',
        seed: 8,
        tilt: -1,
      });
    setNotes(found);
  }, []);

  return (
    <div
      className={'sp-tour' + (closing ? ' closing' : '')}
      onClick={dismiss}
      role="dialog"
      aria-label="How the party works"
    >
      <svg className="sp-tour-svg" aria-hidden>
        {notes.map((n, i) => (
          <InkStroke
            key={i}
            d={arrowPath(n.lx, n.ly, n.tx, n.ty, n.seed)}
            width={2.6}
            color="var(--sp-card)"
            draw
            duration={650}
            delay={500 + i * 850}
            erase={closing}
            eraseDuration={280}
          />
        ))}
      </svg>
      {notes.map((n, i) => (
        <span
          key={'c' + i}
          className="sp-tour-chip"
          style={{
            left: n.lx,
            top: n.ly,
            ['--tilt' as string]: `${n.tilt}deg`,
            animationDelay: closing ? `${(notes.length - 1 - i) * 60}ms` : `${380 + i * 850}ms`,
          }}
        >
          {n.label}
        </span>
      ))}
      <span className="sp-tour-skip">click anywhere to start the party</span>
    </div>
  );
}
