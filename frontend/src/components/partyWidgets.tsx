// ============================================================
// NERO PARTY — party-room widgets (ported from nero-widgets.jsx)
// Now read socket-fed state instead of the local simulation.
// ============================================================
import { useEffect, useMemo, useRef } from 'react';
import { REACTIONS, REACTION_ORDER, fmtTime, waveform } from '../lib/nero';
import type { ReactionType, SongDTO } from '../lib/types';
import type { Burst, LivePin } from '../hooks/useRoom';
import { Eyebrow, VinylArt } from './atoms';

// ---------- now-playing waveform with moment pins ----------
export function WavePlayer({
  song,
  frac,
  windowSec,
  pins,
  bursts,
}: {
  song: SongDTO;
  frac: number;
  windowSec: number;
  pins: LivePin[];
  bursts: Burst[];
}) {
  const bars = useMemo(() => waveform(song.audiusId, song.peaks, 110), [song.audiusId, song.peaks]);
  const now = Date.now();
  const fresh = pins.filter((p) => p.t && now - p.t < 2600);
  return (
    <div className="wave-wrap">
      <div className="wave-pins">
        {pins.map((p, i) => (
          <span
            key={i}
            className="wave-pin"
            style={{
              left: p.frac * 100 + '%',
              bottom: 8 + ((i * 37) % 4) * 11 + 'px',
              color: REACTIONS[p.type].color,
              opacity: p.t && now - p.t < 2600 ? 1 : 0.5,
            }}
          >
            {REACTIONS[p.type].glyph}
          </span>
        ))}
        {bursts
          .filter((b) => now - b.t < 1400)
          .map((b, i) => (
            <span key={'b' + b.t + i} className="sync-burst" style={{ left: b.frac * 100 + '%' }} />
          ))}
        {fresh.map((p, i) => (
          <span
            key={'t' + p.t + p.participantId + i}
            className="pin-toast"
            style={{ left: p.frac * 100 + '%', color: REACTIONS[p.type].color }}
          >
            {p.name || '·'} · {REACTIONS[p.type].label}
          </span>
        ))}
      </div>
      <div className="wave-bars">
        {bars.map((h, i) => {
          const f = i / (bars.length - 1);
          const played = f <= frac;
          return (
            <span
              key={i}
              style={{
                height: h * 100 + '%',
                background: played ? 'var(--accent)' : 'var(--wave-dim)',
                opacity: played ? 0.45 + h * 0.55 : 1,
              }}
            />
          );
        })}
        <span className="wave-head" style={{ left: frac * 100 + '%' }} />
      </div>
      <div className="wave-times mono">
        <span>{fmtTime(frac * windowSec)}</span>
        <span className="wave-songmeta">
          {song.peaks.length} peak zone{song.peaks.length > 1 ? 's' : ''}
        </span>
        <span>{fmtTime(windowSec)}</span>
      </div>
    </div>
  );
}

// ---------- reaction bar ----------
export function ReactionBar({
  onReact,
  chillsLeft,
  disabled,
}: {
  onReact: (t: ReactionType) => void;
  chillsLeft: number;
  disabled?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = parseInt(e.key, 10);
      if (i >= 1 && i <= 5) onReact(REACTION_ORDER[i - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onReact]);
  return (
    <div className="rbar">
      {REACTION_ORDER.map((id, i) => {
        const r = REACTIONS[id];
        const out = r.scarce && chillsLeft <= 0;
        return (
          <button
            key={id}
            className={'rchip' + (r.scarce ? ' rchip-scarce' : '')}
            disabled={disabled || out}
            style={{ ['--rc' as string]: r.color }}
            onClick={() => onReact(id)}
          >
            <span className="rchip-glyph">{r.glyph}</span>
            <span className="rchip-label">{r.label}</span>
            <span className="rchip-key mono">{r.scarce ? chillsLeft + ' LEFT' : i + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- F1-style live leaderboard ----------
const ROW = 64;
export function Leaderboard({
  songs,
  currentId,
  hidden,
}: {
  songs: SongDTO[];
  currentId: string | null;
  hidden?: boolean;
}) {
  const ranked = useMemo(() => {
    const arr = [...songs];
    arr.sort((a, b) => {
      const as = a.played || a.id === currentId;
      const bs = b.played || b.id === currentId;
      if (as !== bs) return as ? -1 : 1;
      if (!as) return a.position - b.position;
      return b.score - a.score;
    });
    return arr;
  }, [songs, currentId]);

  // movement flashes
  const prevPos = useRef<Record<string, number>>({});
  const moves: Record<string, number> = {};
  ranked.forEach((s, i) => {
    const prev = prevPos.current[s.id];
    if (prev != null && prev !== i) moves[s.id] = prev > i ? 1 : -1;
  });
  useEffect(() => {
    const next: Record<string, number> = {};
    ranked.forEach((s, i) => (next[s.id] = i));
    prevPos.current = next;
  });

  const leader = ranked.find((s) => s.played || s.id === currentId);
  return (
    <aside className={'lboard' + (hidden ? ' lboard-hidden' : '')}>
      <div className="lboard-head">
        <Eyebrow>LIVE STANDINGS</Eyebrow>
        <span className="lboard-note mono">heat / min</span>
      </div>
      <div className="lboard-track" style={{ height: ranked.length * ROW }}>
        {songs.map((s) => {
          const pos = ranked.findIndex((r) => r.id === s.id);
          const active = s.played || s.id === currentId;
          const mv = moves[s.id] || 0;
          const gap = leader && active && s.id !== leader.id ? leader.score - s.score : null;
          return (
            <div
              key={s.id}
              className={
                'lrow' + (s.id === currentId ? ' lrow-live' : '') + (!active ? ' lrow-queued' : '')
              }
              style={{ transform: `translateY(${pos * ROW}px)` }}
            >
              <span className="lrow-pos mono">
                {active ? String(pos + 1).padStart(2, '0') : '–'}
              </span>
              <span className={'lrow-delta' + (mv > 0 ? ' up' : mv < 0 ? ' down' : '')}>
                {mv > 0 ? '▲' : mv < 0 ? '▼' : ''}
              </span>
              <VinylArt hue={s.hue} size={34} />
              <span className="lrow-meta">
                <b>{s.title}</b>
                <i className="mono">
                  {s.id === currentId
                    ? '● LIVE'
                    : active
                      ? gap != null
                        ? '-' + gap.toFixed(1)
                        : 'LEADER'
                      : 'queued'}
                </i>
              </span>
              <span className="lrow-score mono">{active ? s.score.toFixed(1) : ''}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ---------- horizontal filmstrip queue ----------
export function QueueStrip({ songs, currentId }: { songs: SongDTO[]; currentId: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const nextIdx = songs.findIndex((x) => !x.played && x.id !== currentId);
  return (
    <div className="qstrip" ref={ref}>
      {songs.map((s, i) => {
        const status =
          s.id === currentId ? 'live' : s.played ? 'played' : i === nextIdx ? 'next' : 'queued';
        return (
          <div key={s.id} className={'qcard qcard-' + status}>
            <VinylArt hue={s.hue} size={52} spinning={status === 'live'} />
            <div className="qcard-meta">
              <b>{s.title}</b>
              <span>{s.artist}</span>
              <span className="mono qcard-sub">
                {fmtTime(s.durationSec)} · {s.addedByName.toLowerCase()}
              </span>
            </div>
            <span className={'qcard-tag mono qtag-' + status}>
              {status === 'live'
                ? '● NOW'
                : status === 'played'
                  ? s.score.toFixed(1)
                  : status === 'next'
                    ? 'UP NEXT'
                    : String(i + 1).padStart(2, '0')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
