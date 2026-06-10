// ============================================================
// NERO PARTY - search iTunes + add to the queue
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { fmtTime } from '../lib/nero';
import type { Track } from '../lib/types';
import { AlbumArt } from './atoms';

export function SongSearch({
  search,
  add,
  onUnqueue,
  onPreview,
  full,
  queuedIds,
}: {
  search: (q: string) => Promise<Track[]>;
  add: (t: Track) => Promise<{ ok: boolean; reason?: string }>;
  onUnqueue?: (trackId: string) => void;
  onPreview?: (t: Track) => void;
  full?: boolean; // queue is full
  queuedIds: Set<string>;
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
    <div className="search-wrap">
      <input
        className="search-input"
        placeholder="search a song to add…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus
      />
      <div className="search-results">
        {loading && <div className="strip-demo mono">searching…</div>}
        {!loading && q.trim() && results.length === 0 && (
          <div className="strip-demo mono">no tracks found</div>
        )}
        {results.map((t) => {
          const isQueued = queuedIds.has(t.id) || added.has(t.id);
          return (
            <div key={t.id} className="search-row">
              <AlbumArt artworkUrl={t.artworkUrl} hue={t.hue} size={34} radius={6} />
              <div className="search-row-meta">
                <b>{t.title}</b>
                <span>
                  {t.artist} · {fmtTime(t.durationSec)}
                </span>
              </div>
              {onPreview && (
                <button
                  className="search-row-btn mono"
                  onClick={() => onPreview(t)}
                  title="preview"
                >
                  ▶
                </button>
              )}
              <button
                className={'search-row-btn add mono' + (isQueued ? ' queued' : '')}
                disabled={(!isQueued && !!full) || adding === t.id}
                onClick={() => (isQueued ? onUnadd(t) : onAdd(t))}
                title={isQueued ? 'remove from queue' : 'add to queue'}
              >
                {adding === t.id ? 'ADDING…' : isQueued ? 'QUEUED ✕' : full ? 'FULL' : '+ ADD'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
