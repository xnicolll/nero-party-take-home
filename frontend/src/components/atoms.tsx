// ============================================================
// NERO PARTY — shared visual atoms (ported from nero-ui.jsx)
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { REACTIONS, mulberry32 } from '../lib/nero';
import type { ReactionType } from '../lib/types';

export function Grain({ amount = 4 }: { amount?: number }) {
  const op = (amount / 100) * 1.6;
  return <div aria-hidden className="nero-grain" style={{ opacity: op }} />;
}

export function VinylArt({
  hue,
  size = 64,
  spinning,
}: {
  hue: number;
  size?: number;
  spinning?: boolean;
}) {
  const base = `oklch(0.32 0.06 ${hue})`;
  const mid = `oklch(0.55 0.12 ${hue})`;
  const hi = `oklch(0.78 0.10 ${hue})`;
  return (
    <div
      className={'vinyl' + (spinning ? ' vinyl-spin' : '')}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 50%,
          #18130f 0 14%, ${mid} 14% 15%, ${base} 15% 34%,
          ${hi} 34% 35.5%, ${base} 35.5% 52%, ${mid} 52% 53%,
          ${base} 53% 72%, ${hi} 72% 73%, ${base} 73% 100%)`,
      }}
    >
      <span className="vinyl-hole" />
    </div>
  );
}

// Real Audius album art, with the generated vinyl as a graceful fallback.
export function AlbumArt({
  artworkUrl,
  hue,
  size = 64,
  spinning,
  radius,
}: {
  artworkUrl: string | null;
  hue: number;
  size?: number;
  spinning?: boolean;
  radius?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!artworkUrl || failed) return <VinylArt hue={hue} size={size} spinning={spinning} />;
  const r = radius ?? Math.round(size * 0.16);
  return (
    <div className="albumart" style={{ width: size, height: size, borderRadius: r }}>
      <img src={artworkUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}

// Full-bleed blurred artwork = ambient color pulled from the album art.
export function AmbientBackground({ artworkUrl }: { artworkUrl: string | null }) {
  return (
    <div className="ambient" aria-hidden>
      {artworkUrl && <img key={artworkUrl} className="ambient-img" src={artworkUrl} alt="" />}
      <div className="ambient-veil" />
    </div>
  );
}

export function RGlyph({ type, size = 13 }: { type: ReactionType; size?: number }) {
  const r = REACTIONS[type];
  return (
    <span className="rglyph" style={{ color: r.color, fontSize: size }}>
      {r.glyph}
    </span>
  );
}

export function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="eyebrow" style={color ? { color } : undefined}>
      {children}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  ghost,
  big,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  ghost?: boolean;
  big?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      className={'nbtn' + (ghost ? ' nbtn-ghost' : '') + (big ? ' nbtn-big' : '')}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
}

export function PersonDot({
  person,
  lit,
  host,
  size = 30,
}: {
  person: { name: string; color: string };
  lit?: boolean;
  host?: boolean;
  size?: number;
}) {
  return (
    <span
      className="pdot-wrap"
      style={{ width: size, height: size }}
      title={person.name + (host ? ' · host' : '')}
    >
      <span
        className="pdot"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.38,
          background: lit ? person.color : 'transparent',
          color: lit ? '#fdfbf7' : person.color,
          borderColor: person.color,
          boxShadow: lit ? `0 0 ${size * 0.6}px ${person.color}` : 'none',
        }}
      >
        {person.name[0]?.toUpperCase()}
      </span>
      {host && <span className="pdot-host">✦</span>}
    </span>
  );
}

export function HeatShape({
  buckets,
  color,
  w = 120,
  h = 28,
}: {
  buckets: number[];
  color?: string;
  w?: number;
  h?: number;
}) {
  const max = Math.max(1, ...buckets);
  const n = buckets.length || 1;
  return (
    <div className="heatshape" style={{ width: w, height: h }}>
      {buckets.map((v, i) => (
        <span
          key={i}
          style={{
            width: Math.max(1, w / n - 1),
            height: Math.max(2, (v / max) * h),
            background: color || 'var(--accent)',
            opacity: v === 0 ? 0.18 : 0.4 + 0.6 * (v / max),
          }}
        />
      ))}
    </div>
  );
}

// Parallax speck field — 3 layers, mouse + scroll (ported from nero-lobby.jsx).
export function StarField() {
  const wrap = useRef<HTMLDivElement>(null);
  const layers = useMemo(() => {
    const rnd = mulberry32(42);
    return [0.018, 0.045, 0.09].map((depth, li) => ({
      depth,
      stars: Array.from({ length: 24 }, () => ({
        x: rnd() * 100,
        y: rnd() * 100,
        r: 1 + rnd() * (li + 1) * 0.8,
        o: 0.2 + rnd() * 0.4,
        tw: 3 + rnd() * 5,
      })),
    }));
  }, []);
  useEffect(() => {
    let mx = 0,
      my = 0,
      raf: number | null = null;
    const apply = () => {
      raf = null;
      const sc = window.scrollY;
      if (!wrap.current) return;
      [...wrap.current.children].forEach((el, i) => {
        const d = layers[i].depth;
        (el as HTMLElement).style.transform =
          `translate3d(${-mx * d * 900}px, ${-my * d * 600 - sc * d * 2.2}px, 0)`;
      });
    };
    const onMove = (e: MouseEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
    };
  }, [layers]);
  return (
    <div ref={wrap} className="starfield" aria-hidden>
      {layers.map((L, li) => (
        <div key={li} className="starlayer">
          {L.stars.map((s, i) => (
            <span
              key={i}
              className="star"
              style={{
                left: s.x + '%',
                top: s.y + '%',
                width: s.r,
                height: s.r,
                opacity: s.o,
                animationDuration: s.tw + 's',
                animationDelay: ((i * 0.37) % 4) + 's',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
