// ============================================================
// NERO PARTY - the suggestions conveyor
// A stepped conveyor of similar songs: every couple of seconds the row
// rolls one cover to the left (the leftmost bleeds off the page edge),
// a blank opens at the right, then the next cover pops into it. Tap any
// cover to queue it; the search tile pinned at the right adds anything.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import type { Track } from '../lib/types';
import { Mark } from './marks';

const SLOT = 104; // px per cover, including the gutter
const STEP_MS = 2200; // how often the row advances
const SLIDE_MS = 620; // the roll-left duration (mirrors the CSS transition)

type Slot = { key: number; track: Track; slot: number; fresh: boolean };

export function SongReel({
  pool,
  onQueue,
  queueFull,
  adding,
  onSearch,
}: {
  pool: Track[];
  onQueue: (t: Track, el: HTMLElement) => void;
  queueFull: boolean;
  adding: string | null;
  onSearch: () => void;
}) {
  const clipRef = useRef<HTMLDivElement>(null);
  const cursor = useRef(0); // walks the pool, cycling
  const uid = useRef(0); // stable React keys
  const [count, setCount] = useState(0); // how many covers fit
  const [slots, setSlots] = useState<Slot[]>([]);
  const [fail, setFail] = useState<Record<string, boolean>>({});

  // measure how many covers fit across the strip
  useEffect(() => {
    const el = clipRef.current;
    if (!el) return;
    const measure = () => setCount(Math.max(1, Math.floor(el.clientWidth / SLOT)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // fill the strip once we know the width + have songs (seeds only once)
  useEffect(() => {
    if (count <= 0 || pool.length === 0 || slots.length > 0) return;
    const seed: Slot[] = [];
    for (let i = 0; i < count; i++) {
      seed.push({ key: uid.current++, track: pool[cursor.current++ % pool.length], slot: i, fresh: false });
    }
    setSlots(seed);
  }, [count, pool, slots.length]);

  // the stepped advance: roll everything one slot left, then drop the cover
  // that fell off the edge and pop a fresh one into the empty right slot
  useEffect(() => {
    if (slots.length === 0 || pool.length === 0 || count <= 0) return;
    let settle: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setSlots((prev) => prev.map((s) => ({ ...s, slot: s.slot - 1, fresh: false })));
      settle = setTimeout(() => {
        setSlots((prev) => {
          const kept = prev.filter((s) => s.slot >= 0);
          const track = pool[cursor.current++ % pool.length];
          return [...kept, { key: uid.current++, track, slot: count - 1, fresh: true }];
        });
      }, SLIDE_MS);
    }, STEP_MS);
    return () => {
      clearInterval(id);
      clearTimeout(settle);
    };
  }, [slots.length, pool, count]);

  const loading = pool.length === 0;

  return (
    <section className="sp-reel">
      <div className="sp-reel-head">
        <span className="sp-onlabel">similar songs · tap to queue</span>
      </div>
      <div className="sp-reel-body">
        <div className="sp-reel-clip" ref={clipRef}>
          {loading ? (
            <div className="sp-reel-skeleton" aria-hidden>
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className="sp-reel-skel" />
              ))}
            </div>
          ) : (
            <div className="sp-conv">
              {slots.map((s) => (
                <div
                  key={s.key}
                  className="sp-conv-slot"
                  style={{ transform: `translateX(${s.slot * SLOT}px)` }}
                >
                  <button
                    className={'sp-reel-item' + (s.fresh ? ' fresh' : '')}
                    disabled={queueFull || adding === s.track.id}
                    onClick={(e) => onQueue(s.track, e.currentTarget)}
                    aria-label={`Queue ${s.track.title} by ${s.track.artist}`}
                  >
                    {s.track.artworkUrl && !fail[s.track.id] ? (
                      <img
                        src={s.track.artworkUrl.replace('100x100', '300x300')}
                        alt=""
                        onError={() => setFail((f) => ({ ...f, [s.track.id]: true }))}
                      />
                    ) : (
                      <span className="sp-art-blank" style={{ background: `oklch(0.85 0.05 ${s.track.hue})` }}>
                        <Mark name="note" size={18} />
                      </span>
                    )}
                    <b>{s.track.title}</b>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          className="sp-searchtile"
          disabled={queueFull}
          onClick={onSearch}
          aria-label={queueFull ? 'Queue full' : 'Search for any song'}
        >
          <Mark name="search" size={26} strokeWidth={2} />
          <span>{queueFull ? 'full' : 'search'}</span>
        </button>
      </div>
    </section>
  );
}
