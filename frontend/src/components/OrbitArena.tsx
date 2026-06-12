// ============================================================
// NERO PARTY - the orbit arena
// Songs orbit a central sun. The queue is a solar system drawn
// in wobbly ink on neon orange. Territory zones flank the orbit
// left and right - big darkened paint blobs that grow/shrink
// with influence. Faces bob inside them and animate on reactions.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import './OrbitArena.css';
import type { SongDTO, ParticipantDTO } from '../lib/types';
import type { FutureChip } from './ink';
import { blobPath, prng, seedFromName, smoothPath, wobbleCirclePath } from '../lib/ink';
import { EASE_OUT, prefersReducedMotion } from '../lib/motion';
import { fieldBus } from '../lib/fieldBus';
import { AlbumArt } from './atoms';
import { Mark } from './marks';

const ARENA_W = 620;
const ARENA_H = 560;
const CX = ARENA_W / 2;
const CY = Math.round(ARENA_H * 0.44);
const SUN_SIZE = 180;
const SUN_R = SUN_SIZE / 2;
const ORBIT_R = 210;
const FACE_VB = 40;
const FACE_SIZE = 56;
const MAX_PLANETS = 6;
const MAX_ZONES = 4;

type Pt = [number, number];

function buildFace(name: string) {
  const rnd = prng(seedFromName(name) ^ 0x9e3779b1);
  const C = FACE_VB / 2;
  const head = blobPath(C, C, 13.5, seedFromName(name));
  const eyeY = C - 1.5 + (rnd() - 0.5) * 1.6;
  const gap = 5.4 + rnd() * 1.6;
  const eyeL: Pt = [C - gap, eyeY + (rnd() - 0.5) * 1.2];
  const eyeR: Pt = [C + gap, eyeY + (rnd() - 0.5) * 1.2];
  const eyeRad = 1.3 + rnd() * 0.6;
  const mY = C + 5 + (rnd() - 0.5) * 1.4;
  const mW = 4.4 + rnd() * 1.4;
  const calmDip = (rnd() - 0.5) * 2.4;
  const mouth = smoothPath([
    [C - mW, mY],
    [C, mY + calmDip],
    [C + mW, mY],
  ]);
  const mouthGrin = smoothPath([
    [C - mW - 1.4, mY - 1.6],
    [C, mY + 3.4],
    [C + mW + 1.4, mY - 1.6],
  ]);
  return { head, eyeL, eyeR, eyeRad, mouth, mouthGrin };
}

function darkenHex(hex: string, factor = 0.5): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

interface OrbitArenaProps {
  liveSong: SongDTO;
  queue: FutureChip[];
  finishedSongs: SongDTO[];
  participants: ParticipantDTO[];
  liveFrac: number;
  adderName: string;
  isHost: boolean;
  paused: boolean;
  youId: string;
  disliked: boolean;
  onTogglePlay: () => void;
  onSkip: () => void;
  onSetConfirmEnd: (v: boolean) => void;
  onPlayNow: (songId: string) => void;
  onRemove: (songId: string) => void;
}

export function OrbitArena({
  liveSong,
  queue,
  finishedSongs,
  participants,
  adderName,
  isHost,
  paused,
  youId,
  disliked,
  onTogglePlay,
  onSkip,
  onSetConfirmEnd,
  onPlayNow,
  onRemove,
}: OrbitArenaProps) {
  const sunArtRef = useRef<HTMLDivElement>(null);
  const [ripples, setRipples] = useState<number[]>([]);
  const [hypeFlash, setHypeFlash] = useState(false);

  // --- orbit ring ---
  const orbitRing = useMemo(() => wobbleCirclePath(CX, CY, ORBIT_R, 42), []);

  // --- territory influence tracking ---
  const reactionCounts = useRef(new Map<string, number>());
  const [influenceVer, setInfluenceVer] = useState(0);
  const influenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dislikeAccum = useRef(0);

  const bumpInfluence = () => {
    if (influenceTimer.current) clearTimeout(influenceTimer.current);
    influenceTimer.current = setTimeout(() => setInfluenceVer((v) => v + 1), 100);
  };

  useEffect(() => {
    return fieldBus.on('reaction', (e) => {
      const prev = reactionCounts.current.get(e.participantId) ?? 0;
      reactionCounts.current.set(e.participantId, prev + (e.type === 'hype' ? 8 : 2));
      bumpInfluence();
    });
  }, []);

  const prevDisliked = useRef(false);
  useEffect(() => {
    if (disliked && !prevDisliked.current) {
      dislikeAccum.current += 3;
      bumpInfluence();
    }
    prevDisliked.current = disliked;
  }, [disliked]);

  // decay territory scores when a new song starts
  const prevSongId = useRef(liveSong.id);
  useEffect(() => {
    if (prevSongId.current !== liveSong.id) {
      prevSongId.current = liveSong.id;
      for (const [key, val] of reactionCounts.current) {
        reactionCounts.current.set(key, Math.round(val * 0.6));
      }
      bumpInfluence();
    }
  }, [liveSong.id]);

  // --- territory zones ---
  const territories = useMemo(() => {
    const map = new Map<string, { score: number; color: string; name: string }>();

    for (const s of finishedSongs) {
      const p = participants.find((pp) => pp.id === s.addedById);
      if (!p) continue;
      const entry = map.get(s.addedById) ?? { score: 0, color: p.color, name: p.name };
      entry.score += s.score;
      map.set(s.addedById, entry);
    }

    for (const [pid, count] of reactionCounts.current) {
      const p = participants.find((pp) => pp.id === pid);
      if (!p) continue;
      const entry = map.get(pid) ?? { score: 0, color: p.color, name: p.name };
      entry.score += count;
      map.set(pid, entry);
    }

    if (youId && dislikeAccum.current > 0) {
      const entry = map.get(youId);
      if (entry) entry.score = Math.max(0, entry.score - dislikeAccum.current);
    }

    if (map.size === 0) return [];

    const entries = Array.from(map.entries())
      .filter(([, v]) => v.score > 0)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, MAX_ZONES);

    const leftCount = Math.ceil(entries.length / 2);
    const rightCount = Math.floor(entries.length / 2);

    return entries.map(([id, { score, color, name }], i) => {
      const side = i % 2 === 0 ? 'left' : 'right';
      const row = Math.floor(i / 2);
      const rowTotal = side === 'left' ? leftCount : rightCount;

      const posX = side === 'left' ? -120 - row * 40 : ARENA_W + 120 + row * 40;
      const vertFrac = rowTotal <= 1 ? 0.46 : 0.3 + (row / (rowTotal - 1)) * 0.36;
      const posY = ARENA_H * vertFrac;

      const blobSize = Math.max(100, Math.min(500, 100 + score * 6));
      const blobD = blobPath(150, 150, 128, seedFromName(name) ^ 0xbeef);
      const darkColor = darkenHex(color, 0.5);
      const face = buildFace(name);

      return { id, color, darkColor, name, score, blobSize, posX, posY, blobD, face };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishedSongs, participants, influenceVer, youId]);

  // --- zone face animation refs ---
  const zoneFaceRefs = useRef(new Map<string, SVGSVGElement>());
  const zoneMouthRefs = useRef(new Map<string, SVGPathElement>());

  useEffect(() => {
    return fieldBus.on('reaction', (e) => {
      if (prefersReducedMotion()) return;
      const faceEl = zoneFaceRefs.current.get(e.participantId);
      if (!faceEl) return;

      if (e.type === 'hype') {
        faceEl.animate(
          [
            { transform: 'rotate(0deg) scale(1)' },
            { transform: 'rotate(-20deg) scale(1.1)', offset: 0.12 },
            { transform: 'rotate(340deg) scale(1.35)', offset: 0.5 },
            { transform: 'rotate(700deg) scale(1.1)', offset: 0.82 },
            { transform: 'rotate(720deg) scale(1)' },
          ],
          { duration: 1080, easing: EASE_OUT },
        );
      } else {
        faceEl.animate(
          [
            { transform: 'translateY(0) rotate(0deg) scale(1)' },
            { transform: 'translateY(-8px) rotate(-5deg) scale(1.15)', offset: 0.28 },
            { transform: 'translateY(1px) rotate(3deg) scale(0.94)', offset: 0.55 },
            { transform: 'translateY(0) rotate(0deg) scale(1)' },
          ],
          { duration: 650, easing: EASE_OUT },
        );
      }

      const mouthEl = zoneMouthRefs.current.get(e.participantId);
      const t = territories.find((tt) => tt.id === e.participantId);
      if (mouthEl && t) {
        mouthEl.animate(
          [
            { d: `path('${t.face.mouth}')` },
            { d: `path('${t.face.mouthGrin}')`, offset: 0.15 },
            { d: `path('${t.face.mouthGrin}')`, offset: 0.75 },
            { d: `path('${t.face.mouth}')` },
          ],
          { duration: 1200, easing: EASE_OUT },
        );
      }
    });
  }, [territories]);

  // --- queue: planets on the orbit ring ---
  const shown = queue.slice(0, MAX_PLANETS);
  const overflow = queue.length - shown.length;
  const planetCoords = useMemo(
    () =>
      shown.map((_, i) => {
        const angle = (i / Math.max(shown.length, 1)) * Math.PI * 2 - Math.PI / 2;
        return {
          x: ORBIT_R * Math.cos(angle),
          y: ORBIT_R * Math.sin(angle),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown.length, ...shown.map((s) => s.id)],
  );

  const sunTopPct = `${((CY / ARENA_H) * 100).toFixed(1)}%`;

  // --- reaction effects ---
  useEffect(() => {
    return fieldBus.on('reaction', (e) => {
      if (prefersReducedMotion()) return;
      sunArtRef.current?.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }],
        { duration: 360, easing: EASE_OUT },
      );
      if (e.type === 'like') {
        setRipples((r) => [...r, Date.now()]);
      } else if (e.type === 'hype') {
        sunArtRef.current?.animate(
          [
            { transform: 'scale(1)', filter: 'brightness(1)' },
            { transform: 'scale(1.16)', filter: 'brightness(1.2)', offset: 0.3 },
            { transform: 'scale(1)', filter: 'brightness(1)' },
          ],
          { duration: 700, easing: EASE_OUT },
        );
        const now = Date.now();
        setRipples((r) => [...r, now, now + 90, now + 180]);
        setHypeFlash(true);
        setTimeout(() => setHypeFlash(false), 2000);
      }
    });
  }, []);

  useEffect(() => {
    if (ripples.length === 0) return;
    const id = setTimeout(
      () => setRipples((r) => r.filter((t) => Date.now() - t < 1000)),
      1100,
    );
    return () => clearTimeout(id);
  }, [ripples]);

  return (
    <div className="sp-orbit">
      {/* hype flash: full-screen strobe */}
      {hypeFlash && <div className="sp-orbit-hype-strobe" />}

      {/* territory zones */}
      {territories.map((t, i) => (
        <div
          key={`zone-${t.id}`}
          className="sp-orbit-zone"
          style={{
            left: t.posX,
            top: t.posY,
            width: t.blobSize,
            height: t.blobSize,
            animationDuration: `${3.8 + i * 0.7}s`,
            animationDelay: `${i * -1.4}s`,
          }}
        >
          <svg className="sp-orbit-zone-blob" viewBox="0 0 300 300" aria-hidden>
            <path d={t.blobD} fill={t.darkColor} opacity={0.38} />
          </svg>
          <div className="sp-orbit-zone-face">
            <svg
              ref={(el) => {
                if (el) zoneFaceRefs.current.set(t.id, el);
                else zoneFaceRefs.current.delete(t.id);
              }}
              viewBox={`0 0 ${FACE_VB} ${FACE_VB}`}
              width={FACE_SIZE}
              height={FACE_SIZE}
              aria-hidden
            >
              <path
                d={t.face.head}
                fill={t.color}
                stroke="var(--sp-ink)"
                strokeWidth={1.4}
                strokeLinejoin="round"
              />
              <circle cx={t.face.eyeL[0]} cy={t.face.eyeL[1]} r={t.face.eyeRad} fill="var(--sp-ink)" />
              <circle cx={t.face.eyeR[0]} cy={t.face.eyeR[1]} r={t.face.eyeRad} fill="var(--sp-ink)" />
              <path
                ref={(el) => {
                  if (el) zoneMouthRefs.current.set(t.id, el);
                  else zoneMouthRefs.current.delete(t.id);
                }}
                d={t.face.mouth}
                fill="none"
                stroke="var(--sp-ink)"
                strokeWidth={1.4}
                strokeLinecap="round"
              />
            </svg>
            <span className="sp-orbit-zone-name">{t.name}</span>
          </div>
        </div>
      ))}

      {/* SVG decorative layer */}
      <svg
        className="sp-orbit-svg"
        viewBox={`0 0 ${ARENA_W} ${ARENA_H}`}
        aria-hidden
      >
        {/* orbit ring */}
        <path
          d={orbitRing}
          fill="none"
          stroke="var(--sp-ink)"
          strokeWidth={1.5}
          strokeDasharray="6 8"
          opacity={0.22}
        />

        {/* reaction ripples */}
        {ripples.map((t) => (
          <circle key={t} cx={CX} cy={CY} r={SUN_R + 6} className="sp-orbit-ripple" />
        ))}
      </svg>

      {/* sun: the now-playing song (square art, not circular) */}
      <div className="sp-orbit-sun" key={liveSong.id} style={{ top: sunTopPct }}>
        <div className="sp-orbit-sun-art sp-now-art" ref={sunArtRef}>
          <AlbumArt
            artworkUrl={liveSong.artworkUrl?.replace('100x100', '400x400') ?? null}
            hue={liveSong.hue}
            size={SUN_SIZE}
            radius={18}
            priority
            alt={`${liveSong.title} by ${liveSong.artist}`}
          />
        </div>
        <h2 className="sp-orbit-title sp-in" style={{ animationDelay: '0.12s' }}>
          {liveSong.title}
        </h2>
        <p className="sp-orbit-artist sp-in" style={{ animationDelay: '0.18s' }}>
          {liveSong.artist}
        </p>
        <p className="sp-orbit-by sp-in" style={{ animationDelay: '0.24s' }}>
          queued by {adderName.toLowerCase()}
        </p>
        {isHost ? (
          <div className="sp-orbit-controls">
            <button className="sp-hostkey" onClick={onTogglePlay}>
              <Mark name={paused ? 'play' : 'pause'} size={12} strokeWidth={2.4} />
              {paused ? 'resume' : 'pause'}
            </button>
            <button className="sp-hostkey" onClick={onSkip}>
              <Mark name="skip" size={12} strokeWidth={2.4} />
              skip
            </button>
            <button className="sp-hostkey warn" onClick={() => onSetConfirmEnd(true)}>
              end
            </button>
          </div>
        ) : (
          paused && <span className="sp-onfaint">paused by the host</span>
        )}
      </div>

      {/* orbiting planets (these stay circular) */}
      {shown.map((song, i) => (
        <div
          key={song.id}
          className={'sp-orbit-planet' + (isHost ? ' hostable' : '')}
          style={
            {
              '--ox': `${planetCoords[i]?.x ?? 0}px`,
              '--oy': `${planetCoords[i]?.y ?? 0}px`,
              top: sunTopPct,
              animationDelay: `${i * 0.08}s`,
            } as React.CSSProperties
          }
          role={isHost ? 'button' : undefined}
          tabIndex={isHost ? 0 : -1}
          onClick={() => isHost && onPlayNow(song.id)}
          onKeyDown={(e) => {
            if (isHost && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onPlayNow(song.id);
            }
          }}
          aria-label={`${song.title} by ${song.artist}${isHost ? ', play now' : ', up next'}`}
        >
          <span className="sp-orbit-planet-art">
            {song.artworkUrl ? (
              <img src={song.artworkUrl} alt="" loading="lazy" decoding="async" />
            ) : (
              <span
                className="sp-orbit-planet-blank"
                style={{ background: `oklch(0.85 0.05 ${song.hue})` }}
              >
                <Mark name="note" size={16} />
              </span>
            )}
          </span>
          <span className="sp-orbit-planet-label">{song.title}</span>
          {isHost && (
            <span
              className="sp-orbit-planet-x"
              role="button"
              tabIndex={0}
              aria-label={`Remove ${song.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(song.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove(song.id);
                }
              }}
            >
              <Mark name="close" size={10} />
            </span>
          )}
        </div>
      ))}

      {overflow > 0 && <span className="sp-orbit-overflow">+{overflow}</span>}
    </div>
  );
}
