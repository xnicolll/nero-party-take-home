// ============================================================
// NERO PARTY - ink components
// The self-drawing line. InkStroke animates a path on with
// stroke-dashoffset; InkUnderline hand-underlines whatever it
// sits beneath; the live song timeline lives in PartyRoom and
// composes these.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { EASE_INOUT, prefersReducedMotion } from '../lib/motion';
import { heatOutline, loopPath, wavyLine } from '../lib/ink';
import { REACTIONS } from '../lib/nero';
import type { Burst, LivePin } from '../hooks/useRoom';
import { Mark } from './marks';

export function InkStroke({
  d,
  width = 2,
  color = 'currentColor',
  draw = false,
  duration = 800,
  delay = 0,
  erase = false,
  eraseDuration = 300,
  onDone,
}: {
  d: string;
  width?: number;
  color?: string;
  draw?: boolean;
  duration?: number;
  delay?: number;
  erase?: boolean; // un-draws the stroke (the draw animation in reverse)
  eraseDuration?: number;
  onDone?: () => void;
}) {
  const ref = useRef<SVGPathElement>(null);

  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    if (!draw || prefersReducedMotion()) {
      p.style.strokeDasharray = '';
      p.style.strokeDashoffset = '';
      onDone?.();
      return;
    }
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    const anim = p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
      duration,
      delay,
      easing: EASE_INOUT,
      fill: 'forwards',
    });
    let alive = true;
    anim.finished
      .then(() => {
        if (!alive) return;
        p.style.strokeDashoffset = '0';
        onDone?.();
      })
      .catch(() => {});
    return () => {
      alive = false;
      anim.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, draw, duration, delay]);

  // the line pulls itself back in
  useEffect(() => {
    const p = ref.current;
    if (!p || !erase) return;
    if (prefersReducedMotion()) {
      p.style.opacity = '0';
      return;
    }
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len}`;
    const anim = p.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: len }], {
      duration: eraseDuration,
      easing: EASE_INOUT,
      fill: 'forwards',
    });
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erase, eraseDuration]);

  return (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

// a queued song, resting on the line's undrawn future
export interface FutureChip {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  hue: number;
}

// the live song timeline: one hand-drawn line that draws itself as the
// song plays; every reaction stamps the line at the second it landed,
// a sync makes the line do a loop-the-loop, and the queue rests on the
// line's future, right of the nib. Past, present, and what's next: one
// stroke.
export function InkTimeline({
  songId,
  frac,
  pins,
  bursts,
  height = 96,
  future = [],
  hostable = false,
  onChipPlay,
  onChipRemove,
}: {
  songId: string;
  frac: number;
  pins: LivePin[];
  bursts: Burst[];
  height?: number;
  future?: FutureChip[];
  hostable?: boolean;
  onChipPlay?: (id: string) => void;
  onChipRemove?: (id: string) => void;
}) {
  const W = 1000;
  const d = useMemo(() => wavyLine(8, W - 8, height / 2, 4, 16, 7), [height]);
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  // a queued cover that fails to load falls back to its hue swatch instead of
  // leaving the browser's broken-image glyph sitting on the line
  const [artFail, setArtFail] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setLen(pathRef.current?.getTotalLength() ?? 0);
  }, [d]);

  // between songs the old line retracts to the start before the new one draws
  // in, so the changeover is one continuous gesture instead of a hard cut
  const prevSong = useRef<string | undefined>(undefined);
  const [wiping, setWiping] = useState(false);
  useEffect(() => {
    if (!prefersReducedMotion() && prevSong.current !== undefined && prevSong.current !== songId) {
      setWiping(true);
      const t = setTimeout(() => setWiping(false), 440);
      prevSong.current = songId;
      return () => clearTimeout(t);
    }
    prevSong.current = songId;
  }, [songId]);
  // points ride the exact stroke (dash reveal works by length, not x,
  // so left% alone would drift off the wobble)
  const ptAt = (f: number) =>
    pathRef.current && len
      ? pathRef.current.getPointAtLength(len * Math.min(1, Math.max(0, f)))
      : null;
  const tip = ptAt(frac);
  const shown = future.slice(0, 8);
  const now = Date.now();
  return (
    <div className="sp-inkline" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
      >
        <path className="sp-inkline-base" d={d} />
        <path
          ref={pathRef}
          className="sp-inkline-draw"
          d={d}
          style={
            !len
              ? { strokeDasharray: '1', strokeDashoffset: '1' }
              : wiping
                ? {
                    strokeDasharray: `${len}`,
                    strokeDashoffset: `${len}`,
                    transition: 'stroke-dashoffset 440ms var(--sp-ease-inout)',
                  }
                : { strokeDasharray: `${len}`, strokeDashoffset: `${len * (1 - frac)}` }
          }
        />
      </svg>
      <span
        className={'sp-inkline-nib' + (wiping ? ' wiping' : '')}
        style={
          tip
            ? { left: `${(tip.x / 10).toFixed(2)}%`, top: `${tip.y.toFixed(1)}px` }
            : { left: `${(frac * 100).toFixed(2)}%`, top: '50%' }
        }
      />
      {shown.map((c, i) => {
        const cf = Math.min(0.985, frac + ((1 - frac) * (i + 1)) / (shown.length + 1));
        const pt = ptAt(cf);
        return (
          <div
            key={c.id}
            className={'sp-fchip' + (hostable ? ' hostable' : '')}
            style={
              pt
                ? { left: `${(pt.x / 10).toFixed(2)}%`, top: `${pt.y.toFixed(1)}px` }
                : { left: `${(cf * 100).toFixed(2)}%`, top: '50%' }
            }
            role={hostable ? 'button' : undefined}
            tabIndex={hostable ? 0 : -1}
            aria-label={
              hostable ? `Play ${c.title} by ${c.artist} now` : `${c.title} by ${c.artist}, up next`
            }
            onClick={() => hostable && onChipPlay?.(c.id)}
            onKeyDown={(e) => {
              if (hostable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onChipPlay?.(c.id);
              }
            }}
          >
            {c.artworkUrl && !artFail[c.id] ? (
              <img
                src={c.artworkUrl}
                alt=""
                onError={() => setArtFail((f) => ({ ...f, [c.id]: true }))}
              />
            ) : (
              <span
                className="sp-fchip-blank"
                style={{ background: `oklch(0.85 0.05 ${c.hue})` }}
              />
            )}
            <span className="sp-fchip-name">
              {c.title}
              {hostable ? ' · play now' : ''}
            </span>
            {onChipRemove && (
              <button
                className="sp-fchip-x"
                aria-label={`Remove ${c.title} from the queue`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChipRemove(c.id);
                }}
              >
                <Mark name="close" size={8} strokeWidth={3} />
              </button>
            )}
          </div>
        );
      })}
      {future.length > shown.length && (
        <span className="sp-fchip-more" style={{ left: '99%', top: '50%' }}>
          +{future.length - shown.length}
        </span>
      )}
      {pins.map((p, i) => {
        const fresh = p.t && now - p.t < 2400;
        const jr = Math.abs(Math.sin(p.frac * 997 + i)); // stable pseudo-random
        return (
          <span
            key={p.participantId + ':' + p.t + ':' + i}
            className={'sp-stamp' + (fresh ? ' fresh' : '')}
            style={{
              left: `${(p.frac * 100).toFixed(2)}%`,
              top: `${18 + jr * 46}%`,
              color: REACTIONS[p.type].color,
            }}
          >
            <span
              className="sp-stamp-in"
              style={{ transform: `rotate(${(jr * 22 - 11).toFixed(0)}deg)` }}
            >
              <Mark name={p.type} size={14} strokeWidth={2.4} />
            </span>
            {fresh && p.name && <i>{p.name}</i>}
          </span>
        );
      })}
      {bursts
        .filter((b) => now - b.t < 4200)
        .map((b) => (
          <svg
            key={'loop' + b.t}
            className="sp-inkline-loop"
            style={{ left: `${(b.frac * 100).toFixed(2)}%` }}
            viewBox="0 0 140 70"
            width="140"
            height="70"
            aria-hidden
          >
            <InkStroke d={loopPath(70, 46, 14)} width={2.6} draw duration={850} />
          </svg>
        ))}
    </div>
  );
}

// a song's whole night as one variable-width ink stroke (the chart)
export function InkHeatLine({
  buckets,
  scaleMax,
  color = 'currentColor',
  height = 22,
}: {
  buckets: number[];
  scaleMax: number;
  color?: string;
  height?: number;
}) {
  const W = 320;
  const d = useMemo(() => {
    const n = buckets.length || 48;
    const max = Math.max(1, scaleMax);
    const widths = Array.from(
      { length: n },
      (_, i) => 1 + Math.sqrt((buckets[i] ?? 0) / max) * height * 0.72,
    );
    return heatOutline(4, W - 4, height / 2, widths, 13);
  }, [buckets, scaleMax, height]);
  return (
    <svg
      className="sp-heatline"
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={d} fill={color} />
    </svg>
  );
}

// a full-width hand-drawn rule: stretches edge to edge, squiggle intact
export function InkRule({
  height = 18,
  stroke = 2.5,
  color = 'currentColor',
  seed = 7,
  delay = 200,
  className,
}: {
  height?: number;
  stroke?: number;
  color?: string;
  seed?: number;
  delay?: number;
  className?: string;
}) {
  const W = 1200;
  const d = useMemo(() => wavyLine(0, W, height / 2, 3.4, 22, seed), [height, seed]);
  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height }}
      aria-hidden
    >
      <InkStroke d={d} width={stroke} color={color} draw duration={900} delay={delay} />
    </svg>
  );
}

// a hand-drawn underline that draws itself in when mounted
export function InkUnderline({
  width: w = 200,
  height = 14,
  stroke = 2.5,
  seed = 7,
  delay = 200,
  color = 'currentColor',
  className,
}: {
  width?: number;
  height?: number;
  stroke?: number;
  seed?: number;
  delay?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={w}
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      fill="none"
      aria-hidden
      style={{ display: 'block', overflow: 'visible' }}
    >
      <InkStroke
        d={wavyLine(2, w - 2, height / 2, 2.6, 8, seed)}
        width={stroke}
        color={color}
        draw
        duration={620}
        delay={delay}
      />
    </svg>
  );
}
