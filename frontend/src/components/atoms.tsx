// ============================================================
// NERO PARTY - shared visual atoms (album art, person dots)
// ============================================================
import { useEffect, useState } from 'react';
import { Mark } from './marks';

// real album art (iTunes); falls back to a flat hue swatch.
export function AlbumArt({
  artworkUrl,
  hue,
  size = 64,
  radius,
  priority,
  alt = '', // pass a real alt for content art; leave '' for decorative use
}: {
  artworkUrl: string | null;
  hue: number;
  size?: number;
  radius?: number;
  priority?: boolean;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  // a new URL should retry (don't stay stuck on the fallback)
  useEffect(() => setFailed(false), [artworkUrl]);
  const r = radius ?? Math.round(size * 0.16);
  if (!artworkUrl || failed)
    return (
      <div
        className="sp-art sp-art-swatch"
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        style={{
          width: size,
          height: size,
          borderRadius: r,
          background: `oklch(0.27 0.05 ${hue})`,
          color: `oklch(0.62 0.1 ${hue})`,
        }}
      >
        <Mark name="note" size={Math.max(12, Math.round(size * 0.32))} />
      </div>
    );
  return (
    <div className="sp-art" style={{ width: size, height: size, borderRadius: r }}>
      <img
        src={artworkUrl}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
