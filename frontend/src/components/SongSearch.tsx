// ============================================================
// NERO PARTY - search iTunes + add to the queue
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { fmtTime } from '../lib/nero';
import type { Track } from '../lib/types';
import { AlbumArt } from './atoms';
import { Mark } from './marks';

export function SongSearch({
  search,
  add,
  onUnqueue,
  onPreview,
  full,
  queuedIds,
  suggestions,
}: {
  search: (q: string) => Promise<Track[]>;
  add: (t: Track) => Promise<{ ok: boolean; reason?: string }>;
  onUnqueue?: (trackId: string) => void;
  onPreview?: (t: Track) => void;
  full?: boolean;
  queuedIds: Set<string>;
  suggestions?: Track[];
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    tRef.current = setTimeout(async () => {
      const r = await search(q);
      setResults(r);
      setLoading(false);
    }, 320);
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, [q, search]);

  const onAdd = async (t: Track) => {
    setAdding(t.id);
    const r = await add(t);
    setAdding(null);
    if (r.ok) setAdded((s) => new Set(s).add(t.id));
  };

  const onUnadd = (t: Track) => {
    setAdded((s) => {
      const n = new Set(s);
      n.delete(t.id);
      return n;
    });
    onUnqueue?.(t.id);
  };

  return (
    <div className="sp-search">
      <input
        className="sp-input sp-search-input"
        placeholder="search a song to add…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus
      />
      {!q.trim() && suggestions && suggestions.length > 0 && (
        <div className="sp-search-suggest">
          <span className="sp-label">suggested</span>
          <div className="sp-search-suggest-row">
            {suggestions
              .filter((t) => !queuedIds.has(t.id) && !added.has(t.id))
              .slice(0, 5)
              .map((t) => (
                <button
                  key={t.id}
                  className="sp-search-suggest-item"
                  disabled={!!full || adding === t.id}
                  onClick={() => onAdd(t)}
                  title={`${t.title} - ${t.artist}`}
                >
                  <AlbumArt artworkUrl={t.artworkUrl} hue={t.hue} size={64} radius={10} />
                  <b>{t.title}</b>
                </button>
              ))}
          </div>
        </div>
      )}
      <div className="sp-search-results">
        {loading && <div className="sp-hint">searching…</div>}
        {!loading && q.trim() && results.length === 0 && (
          <div className="sp-hint">no tracks found</div>
        )}
        {results.map((t) => {
          const isQueued = queuedIds.has(t.id) || added.has(t.id);
          return (
            <div key={t.id} className="sp-search-row">
              <AlbumArt artworkUrl={t.artworkUrl} hue={t.hue} size={34} radius={6} />
              <div className="sp-search-meta">
                <b>{t.title}</b>
                <span>
                  {t.artist} · {fmtTime(t.durationSec)}
                </span>
              </div>
              {onPreview && (
                <button
                  className="sp-iconbtn"
                  onClick={() => onPreview(t)}
                  title="preview"
                  aria-label={`Preview ${t.title}`}
                >
                  <Mark name="play" size={11} />
                </button>
              )}
              <button
                className={'sp-chip' + (isQueued ? ' on' : '')}
                disabled={(!isQueued && !!full) || adding === t.id}
                onClick={() => (isQueued ? onUnadd(t) : onAdd(t))}
                title={isQueued ? 'remove from queue' : 'add to queue'}
              >
                {adding === t.id ? 'adding…' : isQueued ? 'queued' : full ? 'full' : 'add'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
