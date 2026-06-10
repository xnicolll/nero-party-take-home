// ============================================================
// NERO PARTY - party-room widgets (ported from nero-widgets.jsx)
// Now read socket-fed state instead of the local simulation.
// ============================================================
import { useEffect, useMemo, useRef } from 'react';
import { REACTIONS, REACTION_ORDER, fmtTime, waveform } from '../lib/nero';
import type { ReactionType, SongDTO } from '../lib/types';
import type { Burst, LivePin } from '../hooks/useRoom';
import { AlbumArt } from './atoms';

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
  const bars = useMemo(() => waveform(song.trackId, song.peaks, 110), [song.trackId, song.peaks]);
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
        if (chillsRef.current > 0) onReact('chills'); // don't fire when you're out
        return;
      }
      const i = parseInt(e.key, 10);
      if (i >= 1 && i <= 4) onReact(REACTION_ORDER[i - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onReact, disabled]);
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
            <span className="rchip-glyph" aria-hidden>
              {r.glyph}
            </span>
            <span className="rchip-label">{r.label}</span>
            <span className="rchip-key mono">
              {r.scarce ? `space · ${chillsLeft} left` : `key ${i + 1}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- v2 playlist rail: queue + live standings merged, racing ----------
const RROW = 72;
export function PlaylistRail({
  songs,
  currentId,
  onRemove,
}: {
  songs: SongDTO[];
  currentId: string | null;
  onRemove?: (songId: string) => void;
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

  // Track rank changes and hold the ▲/▼ arrow for ~1.6s. We only re-snapshot
  // ranks when the order actually changes (not on every 60ms re-render), so the
  // arrow doesn't get overwritten the very next frame.
  const prevRank = useRef<Record<string, number>>({});
  const moveAt = useRef<Record<string, { dir: number; at: number }>>({});
  const prevSig = useRef('');
  const sig = ranked.map((r) => r.id).join(',');
  if (sig !== prevSig.current) {
    const stamp = Date.now();
    ranked.forEach((s, i) => {
      const prev = prevRank.current[s.id];
      if (prev != null && prev !== i) moveAt.current[s.id] = { dir: prev > i ? 1 : -1, at: stamp };
      prevRank.current[s.id] = i;
    });
    prevSig.current = sig;
  }
  const nowMs = Date.now();

  return (
    <div className="rail-track">
      <div style={{ position: 'relative', height: ranked.length * RROW }}>
        {songs.map((s, i) => {
          const pos = ranked.findIndex((r) => r.id === s.id);
          const active = s.played || s.id === currentId;
          const m = moveAt.current[s.id];
          const mv = m && nowMs - m.at < 1600 ? m.dir : 0;
          const live = s.id === currentId;
          return (
            <div
              key={s.id}
              className={
                'pcard glass' +
                (live ? ' pcard-live' : '') +
                (s.played ? ' pcard-played' : !active ? ' pcard-queued' : '')
              }
              style={{ transform: `translateY(${pos * RROW}px)`, animationDelay: `${i * 0.04}s` }}
            >
              <span className="pcard-rank mono">
                {active ? String(pos + 1).padStart(2, '0') : '-'}
              </span>
              <span
                className={'pcard-delta' + (mv > 0 ? ' up' : mv < 0 ? ' down' : '')}
                aria-hidden
              >
                {mv > 0 ? '▲' : mv < 0 ? '▼' : ''}
              </span>
              <AlbumArt artworkUrl={s.artworkUrl} hue={s.hue} size={44} radius={8} />
              <span className="pcard-meta">
                <b>{s.title}</b>
                <span>
                  {live
                    ? '● LIVE NOW'
                    : active
                      ? s.artist
                      : `queued · ${s.addedByName.toLowerCase()}`}
                </span>
              </span>
              <span className="pcard-heat mono">{active ? s.score.toFixed(1) : ''}</span>
              {onRemove && !active && (
                <button
                  className="pcard-remove"
                  title="remove from queue"
                  aria-label={`Remove ${s.title} from the queue`}
                  onClick={() => onRemove(s.id)}
                >
                  <span aria-hidden>✕</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
