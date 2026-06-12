// ============================================================
// NERO PARTY - the flood
// Picking an album art floods the page with neon paint and lifts the
// cover to the center of the screen, where it HOLDS under an "invite
// your friends + listen" beat. The party is already live + playing
// underneath; tapping the button copies the invite link, then the
// cover glides left into its place in the room and the paint melts away.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion';
import { arrowPath } from '../lib/ink';
import { InkStroke } from './ink';
import { Mark } from './marks';
import './Flood.css';

export interface FloodOrigin {
  x: number;
  y: number;
  w: number;
  h: number;
}

// The one editable thing on the pre-party screen: the host's display name.
// An inline, content-sized field that reads as part of the "hosted by ___"
// line, softly underlined, cream on the neon. Tap to edit, Enter/blur commits.
function NameField({ value, onCommit }: { value: string; onCommit: (name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  // follow the authoritative name in unless we're mid-edit
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim().slice(0, 24);
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  };

  return (
    <span className="sp-flood-name" data-editing={editing || undefined}>
      <input
        ref={ref}
        className="sp-flood-name-input"
        value={draft}
        size={Math.max(2, Math.min(24, draft.length || value.length))}
        maxLength={24}
        spellCheck={false}
        autoComplete="off"
        aria-label="your name"
        onFocus={(e) => {
          setEditing(true);
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
            e.currentTarget.blur();
          }
        }}
      />
      <Mark name="pen" size={13} strokeWidth={2.2} className="sp-flood-name-pen" />
    </span>
  );
}

export function Flood({
  origin,
  art,
  inviteUrl,
  hostName,
  onRename,
  onReveal,
  onDone,
}: {
  origin: FloodOrigin;
  art: string | null;
  inviteUrl: string | null;
  hostName: string;
  onRename: (name: string) => void;
  onReveal: () => void;
  onDone: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const revealRef = useRef(onReveal);
  revealRef.current = onReveal;
  const startedRef = useRef(false);
  const [copied, setCopied] = useState(false);

  const reduced = prefersReducedMotion();
  const cx = origin.x + origin.w / 2;
  const cy = origin.y + origin.h / 2;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dist = Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy));
  const coverScale = (dist * 2.4) / 100; // blobs are 100px wide

  // the centered "hero" pose: the cover enlarged, lifted to leave room below
  const centerScale = Math.min(2.4, Math.max(1, 260 / origin.w));
  const centerH = origin.h * centerScale;
  const centerLeft = vw / 2 - (origin.w * centerScale) / 2;
  const centerTop = vh / 2 - centerH / 2 - 50;
  const toCenter = `translate(${(centerLeft - origin.x).toFixed(1)}px, ${(centerTop - origin.y).toFixed(1)}px) scale(${centerScale.toFixed(4)})`;
  const capTop = centerTop + centerH + 26;

  // entrance: the paint covers as the cover flies to center + the beat fades in
  useEffect(() => {
    const clone = cloneRef.current;
    const cap = capRef.current;
    if (reduced) {
      if (clone) clone.style.transform = toCenter;
      if (cap) cap.style.opacity = '1';
      return;
    }
    clone?.animate([{ transform: 'translate(0px, 0px) scale(1.04)' }, { transform: toCenter }], {
      duration: 760,
      delay: 140,
      easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
      fill: 'forwards',
    });
    cap?.animate(
      [
        { opacity: 0, transform: 'translate(-50%, 12px)' },
        { opacity: 1, transform: 'translate(-50%, 0)' },
      ],
      { duration: 520, delay: 640, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fade the whole paint layer out, then hand control back to the room.
  // onReveal fires immediately so the screen crossfades IN while the flood
  // fades OUT - simultaneous, not sequential, so the album art never goes dark.
  const finish = () => {
    revealRef.current();
    const root = rootRef.current;
    if (!root) return doneRef.current();
    root
      .animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: reduced ? 1 : 420,
        easing: 'ease',
        fill: 'forwards',
      })
      .finished.then(() => doneRef.current())
      .catch(() => doneRef.current());
  };

  // glide the cover from center into its slot in the room (it sits on the left)
  const reveal = (attempts = 24) => {
    const clone = cloneRef.current;
    const cap = capRef.current;
    const target = document.querySelector('.sp-now-art');
    if (!target && attempts > 0) {
      setTimeout(() => reveal(attempts - 1), 80);
      return;
    }
    if (!clone || !target) return finish();
    const tr = (target as HTMLElement).getBoundingClientRect();
    const toSlot = `translate(${(tr.left - origin.x).toFixed(1)}px, ${(tr.top - origin.y).toFixed(1)}px) scale(${(tr.width / origin.w).toFixed(4)}, ${(tr.height / origin.h).toFixed(4)})`;
    cap?.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%, 8px)' }], {
      duration: reduced ? 1 : 240,
      easing: 'ease',
      fill: 'forwards',
    });
    clone
      .animate([{ transform: toCenter }, { transform: toSlot }], {
        duration: reduced ? 1 : 720,
        easing: 'cubic-bezier(0.5, 0.05, 0.1, 1)',
        fill: 'forwards',
      })
      .finished.then(finish)
      .catch(finish);
  };

  // name-field hint arrow: draws in after the caption settles, auto-dismisses
  const [nameHint, setNameHint] = useState(true);
  const [nameHintClosing, setNameHintClosing] = useState(false);
  const [hintArrow, setHintArrow] = useState<{
    lx: number;
    ly: number;
    tx: number;
    ty: number;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const input = document.querySelector('.sp-flood-name-input');
      if (!input) return;
      const r = input.getBoundingClientRect();
      setHintArrow({
        lx: Math.max(20, r.left - 180),
        ly: Math.max(20, r.top - 58),
        tx: r.left + r.width / 2,
        ty: r.top - 2,
      });
    }, reduced ? 200 : 1400);
    return () => clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (!nameHint || !hintArrow) return;
    const t = setTimeout(() => {
      setNameHintClosing(true);
      setTimeout(() => setNameHint(false), 420);
    }, 3000);
    return () => clearTimeout(t);
  }, [nameHint, hintArrow]);

  // the one action: copy the invite link, then move the cover left + start
  const onStart = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (inviteUrl) navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => reveal(), reduced ? 0 : 620);
  };

  return (
    <div ref={rootRef} className="sp-flood" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`sp-flood-blob sp-flood-b${i}`}
          style={
            {
              left: cx,
              top: cy,
              '--cover': coverScale,
            } as React.CSSProperties
          }
        />
      ))}
      {art && (
        <div
          ref={cloneRef}
          className="sp-flood-art"
          style={{ left: origin.x, top: origin.y, width: origin.w, height: origin.h }}
        >
          <img src={art.replace('100x100', '400x400')} alt="" />
        </div>
      )}
      <div ref={capRef} className="sp-flood-cap" style={{ top: capTop }}>
        <b>invite your friends + listen</b>
        <p className="sp-flood-host">
          hosted by <NameField value={hostName} onCommit={onRename} />
        </p>
        <div className="sp-flood-legend">
          <span>
            <Mark name="like" size={16} strokeWidth={2} style={{ color: 'var(--sp-on-neon)' }} />
            <kbd>up</kbd> like the moment
          </span>
          <span>
            <Mark name="hype" size={16} strokeWidth={2} style={{ color: 'var(--sp-on-neon)' }} />
            <kbd>space</kbd> hype, your 3 biggest of the night
          </span>
          <span>
            <Mark name="thumbsdown" size={16} strokeWidth={2} style={{ color: 'var(--sp-on-neon)' }} />
            <kbd>down</kbd> not feeling it
          </span>
        </div>
        <button className="sp-flood-cta" onClick={onStart} disabled={copied}>
          {copied ? 'link copied, starting' : 'copy invite link + start'}
          <Mark name={copied ? 'check' : 'skip'} size={13} strokeWidth={2.6} />
        </button>
      </div>

      {nameHint && hintArrow && (
        <div className={'sp-flood-arrow' + (nameHintClosing ? ' closing' : '')}>
          <svg
            style={{
              position: 'fixed',
              inset: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: 'none',
            }}
            aria-hidden
          >
            <InkStroke
              d={arrowPath(hintArrow.lx + 120, hintArrow.ly + 12, hintArrow.tx, hintArrow.ty, 9)}
              width={2.6}
              color="var(--sp-card)"
              draw
              duration={650}
              delay={200}
              erase={nameHintClosing}
              eraseDuration={280}
            />
          </svg>
          <span
            className="sp-flood-arrow-chip"
            style={{ left: hintArrow.lx, top: hintArrow.ly }}
          >
            enter your name here!
          </span>
        </div>
      )}
    </div>
  );
}
