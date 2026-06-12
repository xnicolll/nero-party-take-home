// ============================================================
// NERO PARTY - the ghost-ink tour
// First party only: the ink line draws a few quick labelled
// arrows over the REAL interface for a fast spatial orientation
// (now playing, the leaderboard, up next, the room).
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
    const el = (sel: string) => document.querySelector<HTMLElement>(sel);
    const rect = (sel: string) => el(sel)?.getBoundingClientRect();
    const clampX = (x: number) => Math.max(16, Math.min(window.innerWidth - 290, x));
    const clampY = (y: number) => Math.max(16, Math.min(window.innerHeight - 80, y));
    const vw = window.innerWidth;

    const now = rect('.sp-now-art');
    const board = rect('.sp-board');
    const deck = rect('.sp-deck');
    const reel = rect('.sp-reel');
    const faces = rect('.sp-faces');
    const reelSearch = rect('.sp-searchtile');
    const found: Note[] = [];

    // 1 - now playing: chip above the art, arrow points down into it
    if (now)
      found.push({
        tx: now.left + now.width * 0.5,
        ty: now.top + now.height * 0.18,
        lx: clampX(now.left + now.width * 0.5 - 50),
        ly: clampY(now.top - 72),
        label: 'now playing',
        seed: 3,
        tilt: -1.5,
      });

    // 2 - leaderboard: chip to the right, arrow points left into the board
    if (board)
      found.push({
        tx: board.left + board.width * 0.3,
        ty: board.top + 40,
        lx: clampX(board.right + 16),
        ly: clampY(board.top + 8),
        label: 'the leaderboard, finished songs climb here',
        seed: 5,
        tilt: 1.5,
      });

    // 3 - queue deck (or reel): chip above, arrow points down into it
    const nextEl = deck ?? reel;
    if (nextEl)
      found.push({
        tx: nextEl.left + Math.min(nextEl.width * 0.3, 80),
        ty: nextEl.top + 20,
        lx: clampX(nextEl.left + 30),
        ly: clampY(nextEl.top - 68),
        label: 'up next - search bottom-right to add',
        seed: 8,
        tilt: -1,
      });

    // also label the search tile if visible
    if (reelSearch && !deck)
      found.push({
        tx: reelSearch.left + reelSearch.width * 0.5,
        ty: reelSearch.top + 12,
        lx: clampX(reelSearch.left - 200),
        ly: clampY(reelSearch.top - 18),
        label: 'search to add any song',
        seed: 14,
        tilt: 1,
      });

    // 4 - the faces: chip to their left, arrow points right
    if (faces)
      found.push({
        tx: faces.left + 20,
        ty: faces.top + faces.height * 0.25,
        lx: clampX(Math.max(vw * 0.5, faces.left - 260)),
        ly: clampY(faces.top + 8),
        label: "the room - they react when you do",
        seed: 11,
        tilt: 2,
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
