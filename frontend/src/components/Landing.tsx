// ============================================================
// NERO PARTY - the picker
// The landing IS the start: four genre columns of album art
// drifting slowly on paper, vanishing behind one hand-drawn
// horizon line. Hover holds a column still; the refresh re-rolls
// the wall; clicking an art starts the party that second.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE, LANES } from '../lib/nero';
import { wavyLine } from '../lib/ink';
import { prefersReducedMotion } from '../lib/motion';
import type { Track } from '../lib/types';
import { Mark } from './marks';
import { InkRule } from './ink';
import { Wordmark } from './Wordmark';

const LANE_META: Record<string, { label: string; speed: number; up: boolean }> = {
  'Anything goes': { label: 'anything goes', speed: 130, up: true },
  Electronic: { label: 'electronic', speed: 95, up: false },
  'Indie / Alt': { label: 'indie / alt', speed: 150, up: true },
  'Hip-hop': { label: 'hip-hop', speed: 110, up: false },
};

function shuffled<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed * 2654435761 + 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function Landing({
  onPick,
  busy,
}: {
  onPick: (track: Track, lane: string, rect: DOMRect) => void;
  busy?: boolean;
}) {
  const [pools, setPools] = useState<Record<string, Track[]>>({});
  const [roll, setRoll] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [artFail, setArtFail] = useState<Record<string, boolean>>({});
  const pickedRef = useRef<string | null>(null);

  // the columns drift on a rAF so a manual wheel can scrub them and the slow
  // auto-drift resumes a beat later; hover holds a column still to aim a pick
  const trackRefs = useRef(new Map<string, HTMLDivElement>());
  const offsets = useRef<Record<string, number>>({});
  const manualUntil = useRef<Record<string, number>>({});
  const hovered = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    LANES.forEach((lane) => {
      fetch(`${API_BASE}/api/tracks/trending?lane=${encodeURIComponent(lane)}&limit=30`)
        .then((r) => (r.ok ? r.json() : { tracks: [] }))
        .then((d) => alive && setPools((p) => ({ ...p, [lane]: d.tracks ?? [] })))
        .catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, []);

  // each roll deals a fresh hand of 8 per column, deduped across the whole
  // page so the same album cover never appears twice on screen
  const dealt = useMemo(() => {
    const seen = new Set<string>();
    const out: Record<string, Track[]> = {};
    for (const lane of LANES) {
      const pool = shuffled(pools[lane] ?? [], roll + 1);
      const picks: Track[] = [];
      for (const t of pool) {
        if (picks.length >= 8) break;
        const key = (t.artworkUrl || t.id).replace(/\/\d+x\d+bb?\.(jpg|png)/, '/x');
        if (seen.has(key)) continue;
        seen.add(key);
        picks.push(t);
      }
      out[lane] = picks;
    }
    return out;
  }, [pools, roll]);

  const pick = (t: Track, lane: string, el: HTMLElement) => {
    if (leaving || busy) return;
    pickedRef.current = t.id;
    setLeaving(true);
    onPick(t, lane, el.getBoundingClientRect());
  };

  // one rAF drives all four columns: auto-drift unless a column is hovered
  // (held still to aim a pick) or was just scrolled by hand
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(60, now - last) / 1000;
      last = now;
      const reduced = prefersReducedMotion();
      for (const lane of LANES) {
        const el = trackRefs.current.get(lane);
        if (!el) continue;
        const half = el.scrollHeight / 2;
        if (half <= 0) continue;
        const meta = LANE_META[lane];
        let o = offsets.current[lane];
        if (o === undefined) o = meta.up ? 0 : -half;
        const free = now >= (manualUntil.current[lane] ?? 0) && hovered.current !== lane;
        if (free && !reduced) o += (meta.up ? -1 : 1) * (half / meta.speed) * dt;
        if (o <= -half) o += half;
        else if (o > 0) o -= half;
        offsets.current[lane] = o;
        el.style.transform = `translate3d(0, ${o.toFixed(2)}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // wheeling a column scrubs it by hand; auto-drift resumes ~1s later
  const onWheel = (lane: string, e: React.WheelEvent) => {
    const el = trackRefs.current.get(lane);
    if (!el) return;
    const half = el.scrollHeight / 2;
    if (half <= 0) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    let o = (offsets.current[lane] ?? 0) - dy;
    while (o <= -half) o += half;
    while (o > 0) o -= half;
    offsets.current[lane] = o;
    el.style.transform = `translate3d(0, ${o.toFixed(2)}px, 0)`;
    manualUntil.current[lane] = performance.now() + 1100;
  };

  // the columns are clipped along the same wiggle the horizon line draws,
  // so art slips away behind the stroke itself, never a straight edge
  const windowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = windowRef.current;
    if (!el) return;
    const apply = () => {
      const w = el.clientWidth;
      el.style.clipPath = `path('${wavyLine(0, w, 9, 3.4, 22, 7)} L${w} 4000 L0 4000 Z')`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={'sp-pick' + (leaving ? ' leaving' : '')}>
      <header className="sp-pick-top">
        <div className="sp-pick-head">
          <Wordmark owner="nero" />
          <p className="sp-pick-hint">pick a track. your party starts on the click.</p>
        </div>
        <button
          className="sp-shuffle"
          onClick={() => setRoll((r) => r + 1)}
          title="deal a different wall"
          aria-label="Shuffle the album wall"
        >
          shuffle the wall
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden>
            <path
              d="M20 12a8 8 0 1 1-2.5-5.8M20 3.5V7h-3.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      {/* the horizon: the columns slip away behind this line */}
      <div className="sp-pick-horizon">
        <InkRule color="var(--sp-neon)" height={18} stroke={2.5} delay={300} />
      </div>

      <div className="sp-pick-window" ref={windowRef}>
        <main className="sp-pick-grid">
          {LANES.map((lane) => {
            const meta = LANE_META[lane];
            const arts = dealt[lane] ?? [];
            return (
              <section
                key={lane}
                className="sp-col"
                onWheel={(e) => onWheel(lane, e)}
                onMouseEnter={() => (hovered.current = lane)}
                onMouseLeave={() => {
                  if (hovered.current === lane) hovered.current = null;
                }}
              >
                <span className="sp-col-label">{meta.label}</span>
                {arts.length > 0 && (
                  <div
                    key={roll}
                    ref={(el) => {
                      if (el) trackRefs.current.set(lane, el);
                      else trackRefs.current.delete(lane);
                    }}
                    className="sp-col-track"
                  >
                    {[...arts, ...arts].map((t, i) => (
                      <button
                        key={t.id + ':' + i}
                        className={
                          'sp-art-card' +
                          (leaving && pickedRef.current === t.id && i < arts.length
                            ? ' picked'
                            : '')
                        }
                        style={{ animationDelay: `${(i % arts.length) * 55}ms` }}
                        onClick={(e) => pick(t, lane, e.currentTarget)}
                        aria-label={`Start the party with ${t.title} by ${t.artist}`}
                      >
                        {t.artworkUrl && !artFail[t.id] ? (
                          <img
                            src={t.artworkUrl.replace('100x100', '400x400')}
                            alt=""
                            loading="lazy"
                            onError={() => setArtFail((f) => ({ ...f, [t.id]: true }))}
                          />
                        ) : (
                          <span
                            className="sp-art-blank"
                            style={{ background: `oklch(0.85 0.05 ${t.hue})` }}
                          >
                            <Mark name="groove" size={22} />
                          </span>
                        )}
                        <span className="sp-art-meta">
                          <b>{t.title}</b>
                          <i>{t.artist}</i>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </main>
      </div>
    </div>
  );
}
