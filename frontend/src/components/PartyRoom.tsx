// ============================================================
// NERO PARTY - your.party
// One neon screen, no scrolling. The hand-drawn line under the
// wordmark IS the song: it draws itself with playback, carries the
// playhead nib, and catches every reaction stamp. Art + queue on
// the left, the chart of the party beside it, marks below, and a
// reel of similar songs drifting along the bottom. Tap to queue;
// the host can tap any queued slat to play it right now.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CurrentDTO,
  ParticipantDTO,
  PartyDTO,
  ReactionType,
  SongDTO,
  Track,
} from '../lib/types';
import type { Burst, LivePin } from '../hooks/useRoom';
import { API_BASE } from '../lib/nero';
import { fieldBus } from '../lib/fieldBus';
import { EASE_OUT, prefersReducedMotion } from '../lib/motion';
import { AlbumArt } from './atoms';
import { Mark } from './marks';
import { InkHeatLine, InkTimeline, type FutureChip } from './ink';
import { ReactionMarks } from './ReactionMarks';
import { GuestDoodles } from './GuestDoodles';
import { Wordmark } from './Wordmark';
import { SongSearch } from './SongSearch';
import { Modal } from './Modal';

interface PartyRoomProps {
  party: PartyDTO;
  participants: ParticipantDTO[];
  songs: SongDTO[];
  current: CurrentDTO;
  liveFrac: number;
  pins: LivePin[];
  bursts: Burst[];
  chillsLeft: number;
  youId: string;
  isHost: boolean;
  awaitingMore: boolean;
  paused: boolean;
  onTogglePlay: () => void;
  onReact: (t: ReactionType) => void;
  onSkip: () => void;
  onEnd: () => void;
  onFinish: () => void;
  onLeave: () => void;
  onHelp: () => void;
  onPlayNow: (songId: string) => void;
  search: (q: string) => Promise<Track[]>;
  add: (t: Track) => Promise<{ ok: boolean; reason?: string }>;
  onRemove: (songId: string) => void;
  onDislike: (on: boolean) => void;
  disliked: boolean;
  dislikeCount: number;
  dislikeTotal: number;
  skipping: boolean;
}

export function PartyRoom({
  party,
  participants,
  songs,
  current,
  liveFrac,
  pins,
  bursts,
  chillsLeft,
  youId,
  isHost,
  awaitingMore,
  paused,
  onTogglePlay,
  onReact,
  onSkip,
  onEnd,
  onFinish,
  onLeave,
  onHelp,
  onPlayNow,
  search,
  add,
  onRemove,
  onDislike,
  disliked,
  dislikeCount,
  dislikeTotal,
  skipping,
}: PartyRoomProps) {
  const [copied, setCopied] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [reelFail, setReelFail] = useState<Record<string, boolean>>({});
  const liveSong = songs.find((s) => s.id === current.song.id) ?? current.song;
  const adder = participants.find((p) => p.id === liveSong.addedById);
  const queueFull = songs.length >= party.maxSongs;
  const queuedIds = useMemo(() => new Set(songs.map((s) => s.trackId)), [songs]);

  // the future of the line: everything queued after the live song
  const future: FutureChip[] = useMemo(
    () =>
      songs
        .filter((s) => !s.played && s.id !== liveSong.id)
        .sort((a, b) => a.position - b.position)
        .map((s) => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          artworkUrl: s.artworkUrl,
          hue: s.hue,
        })),
    [songs, liveSong.id],
  );

  // the chart of the party: played + live, by score (top rows only; one screen)
  const ranked = useMemo(
    () => songs.filter((s) => s.played || s.id === liveSong.id).sort((a, b) => b.score - a.score),
    [songs, liveSong.id],
  );
  const chartRows = ranked.slice(0, 5);
  const scaleMax = useMemo(() => Math.max(1, ...ranked.flatMap((s) => s.buckets ?? [])), [ranked]);

  // the similar-songs reel: the lane's chart minus what's already queued
  const [similar, setSimilar] = useState<Track[]>([]);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/tracks/trending?lane=${encodeURIComponent(party.lane)}&limit=30`)
      .then((r) => (r.ok ? r.json() : { tracks: [] }))
      .then((d) => alive && setSimilar(d.tracks ?? []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [party.lane]);
  const reel = useMemo(
    () => similar.filter((t) => !queuedIds.has(t.id)).slice(0, 14),
    [similar, queuedIds],
  );
  const [adding, setAdding] = useState<string | null>(null);
  const queueFromReel = async (t: Track, el: HTMLElement) => {
    if (queueFull || adding) return;
    setAdding(t.id);
    el.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(0.86)' },
        { transform: 'scale(1.06)' },
        { transform: 'scale(1)' },
      ],
      { duration: 420, easing: EASE_OUT },
    );
    await add(t);
    setAdding(null);
  };

  // the art breathes, and pops a little every time anyone feels something
  const artRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    return fieldBus.on('reaction', () => {
      if (prefersReducedMotion()) return;
      artRef.current?.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }, { transform: 'scale(1)' }],
        { duration: 360, easing: EASE_OUT },
      );
    });
  }, []);

  // chart rows glide when the order changes
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const prevTops = useRef(new Map<string, number>());
  const sig = chartRows
    .slice(0, 3)
    .map((r) => r.id)
    .join(',');
  useEffect(() => {
    const tops = new Map<string, number>();
    rowRefs.current.forEach((el, id) => el && tops.set(id, el.getBoundingClientRect().top));
    tops.forEach((top, id) => {
      const prev = prevTops.current.get(id);
      const el = rowRefs.current.get(id);
      if (el && prev != null && Math.abs(prev - top) > 1) {
        el.animate([{ transform: `translateY(${prev - top}px)` }, { transform: 'translateY(0)' }], {
          duration: 600,
          easing: EASE_OUT,
        });
      }
    });
    prevTops.current = tops;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const copy = () => {
    const url = `${window.location.origin}/j/${party.joinCode}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {},
    );
  };

  return (
    <div className={'sp-party' + (skipping ? ' skipping' : '')}>
      <header className="sp-party-bar">
        <Wordmark owner="your" />
        <div className="sp-party-actions">
          <button className="sp-onbtn" onClick={onHelp} aria-label="How it works">
            ?
          </button>
          <button className="sp-onbtn" onClick={onLeave}>
            leave
          </button>
        </div>
      </header>

      {/* the line: past (stamps), present (the nib), future (the queue) */}
      <div className="sp-party-line">
        <InkTimeline
          songId={liveSong.id}
          frac={liveFrac}
          pins={pins}
          bursts={bursts}
          height={96}
          future={future}
          hostable={isHost}
          onChipPlay={onPlayNow}
          onChipRemove={onRemove}
        />
      </div>

      <main className="sp-party-main">
        <section className="sp-now-left" key={liveSong.id}>
          <div className="sp-now-art" ref={artRef}>
            <AlbumArt
              artworkUrl={liveSong.artworkUrl?.replace('100x100', '400x400') ?? null}
              hue={liveSong.hue}
              size={208}
              radius={16}
              priority
              alt={`${liveSong.title} by ${liveSong.artist}`}
            />
          </div>
          <p className="sp-onlabel sp-in" style={{ animationDelay: '0.1s' }}>
            queued by {(adder?.name ?? liveSong.addedByName).toLowerCase()}
            {adder?.isHost && <Mark name="host" size={9} strokeWidth={2.6} />}
          </p>
          <h2 className="sp-now-title sp-in" style={{ animationDelay: '0.16s' }}>
            {liveSong.title}
          </h2>
          <p className="sp-now-artist sp-in" style={{ animationDelay: '0.22s' }}>
            {liveSong.artist}
          </p>
          <button className="sp-invite" onClick={copy}>
            {copied ? 'link copied, go paste it!' : 'invite your friends + listen'}
            <Mark name="skip" size={11} strokeWidth={2.6} />
          </button>
        </section>

        <section className="sp-party-right">
          {chartRows.length > 0 && (
            <div
              className={'sp-chart' + (chartOpen ? ' open' : '')}
              onMouseEnter={() => setChartOpen(true)}
              onMouseLeave={() => setChartOpen(false)}
            >
              <span className="sp-onlabel">the chart of the party</span>
              {/* the top three are always on show; ranks four-plus unfold on hover */}
              <div className="sp-chart-rows">
                {chartRows.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(s.id, el);
                      else rowRefs.current.delete(s.id);
                    }}
                    className={
                      'sp-chart-row' +
                      (s.id === liveSong.id ? ' live' : '') +
                      (s.id === ranked[0].id ? ' lead' : '')
                    }
                  >
                    <span className="sp-chart-meta">
                      <b>{s.title}</b>
                      <i>{s.id === liveSong.id ? 'now playing' : s.artist}</i>
                    </span>
                    <InkHeatLine buckets={s.buckets ?? []} scaleMax={scaleMax} height={24} />
                  </div>
                ))}
              </div>
              {ranked.length > 3 && (
                <>
                  <div className="sp-chart-more" aria-hidden={!chartOpen}>
                    <div className="sp-chart-rows">
                      {chartRows.slice(3).map((s) => (
                        <div
                          key={s.id}
                          className={'sp-chart-row' + (s.id === liveSong.id ? ' live' : '')}
                        >
                          <span className="sp-chart-meta">
                            <b>{s.title}</b>
                            <i>{s.id === liveSong.id ? 'now playing' : s.artist}</i>
                          </span>
                          <InkHeatLine buckets={s.buckets ?? []} scaleMax={scaleMax} height={24} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    className="sp-chart-toggle"
                    onClick={() => setChartOpen((o) => !o)}
                    aria-expanded={chartOpen}
                  >
                    {chartOpen ? 'show less' : `and ${ranked.length - 3} more`}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </main>

      <div className="sp-party-foot">
        <div className="sp-feel">
          <ReactionMarks onReact={onReact} chillsLeft={chillsLeft} disabled={paused || skipping} />
          <button
            className={'sp-markbtn sp-dislike' + (disliked ? ' on' : '')}
            onClick={() => onDislike(!disliked)}
            disabled={paused || skipping}
            aria-pressed={disliked}
            title={disliked ? 'remove your dislike' : 'not feeling it? the room can vote to skip'}
          >
            <span className="sp-markbtn-glyph">
              <span
                className="sp-dislike-fill"
                style={{
                  height: `${Math.min(100, (dislikeCount / Math.max(1, dislikeTotal)) * 100)}%`,
                }}
                aria-hidden
              />
              <Mark name="down" size={24} />
            </span>
            <span className="sp-markbtn-label">{disliked ? 'disliked' : 'dislike'}</span>
          </button>
        </div>
        {isHost ? (
          <div className="sp-hoststrip" aria-label="Host controls">
            <span className="sp-hoststrip-label">host remote</span>
            <button className="sp-hostkey" onClick={onTogglePlay}>
              <Mark name={paused ? 'play' : 'pause'} size={11} strokeWidth={2.4} />
              {paused ? 'resume' : 'pause'}
            </button>
            <button className="sp-hostkey" onClick={onSkip}>
              <Mark name="skip" size={11} strokeWidth={2.4} />
              skip
            </button>
            <button className="sp-hostkey warn" onClick={() => setConfirmEnd(true)}>
              end
            </button>
          </div>
        ) : (
          paused && <span className="sp-onfaint">paused by the host</span>
        )}
      </div>

      <GuestDoodles participants={participants} youId={youId} />

      {reel.length > 0 && (
        <section className="sp-reel">
          <div className="sp-reel-head">
            <span className="sp-onlabel">similar songs · tap to queue</span>
            <button className="sp-onbtn" disabled={queueFull} onClick={() => setShowSearch(true)}>
              {queueFull ? 'queue full' : 'search for anything'}
            </button>
          </div>
          <div className="sp-reel-clip">
            <div className="sp-reel-track">
              {[...reel, ...reel].map((t, i) => (
                <button
                  key={t.id + ':' + i}
                  className="sp-reel-item"
                  disabled={queueFull || adding === t.id}
                  onClick={(e) => queueFromReel(t, e.currentTarget)}
                  aria-label={`Queue ${t.title} by ${t.artist}`}
                >
                  {t.artworkUrl && !reelFail[t.id] ? (
                    <img
                      src={t.artworkUrl.replace('100x100', '300x300')}
                      alt=""
                      loading="lazy"
                      onError={() => setReelFail((f) => ({ ...f, [t.id]: true }))}
                    />
                  ) : (
                    <span
                      className="sp-art-blank"
                      style={{ background: `oklch(0.85 0.05 ${t.hue})` }}
                    >
                      <Mark name="groove" size={18} />
                    </span>
                  )}
                  <b>{t.title}</b>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* queue-exhausted intermission */}
      {awaitingMore && !showSearch && (
        <div className="sp-veil">
          <div className="sp-card">
            <span className="sp-label">intermission</span>
            <h3 className="sp-card-title">That's the whole queue.</h3>
            {isHost ? (
              <>
                <p className="sp-sub">keep listening, or crown the winner?</p>
                <div className="sp-actions">
                  <button
                    className="sp-btn"
                    disabled={queueFull}
                    onClick={() => setShowSearch(true)}
                  >
                    {queueFull ? 'queue full' : 'add songs'}
                  </button>
                  <button className="sp-btn sp-btn-solid" onClick={onFinish}>
                    crown the winner
                  </button>
                </div>
              </>
            ) : (
              <p className="sp-sub">the host is deciding what's next…</p>
            )}
          </div>
        </div>
      )}

      <Modal open={showSearch} onClose={() => setShowSearch(false)}>
        <div className="sp-panel">
          <span className="sp-label">add to the queue</span>
          <SongSearch
            search={search}
            add={add}
            onUnqueue={(trackId) => {
              const s = songs.find((x) => x.trackId === trackId);
              if (s) onRemove(s.id);
            }}
            full={queueFull}
            queuedIds={queuedIds}
          />
          <div className="sp-panel-foot">
            <span className="sp-hint">new songs join the end of the queue</span>
            <button className="sp-btn sp-btn-quiet" onClick={() => setShowSearch(false)}>
              done
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)}>
        <div className="sp-card">
          <h3 className="sp-card-title">End the party?</h3>
          <p className="sp-sub">This crowns the winners for everyone. You can't undo it.</p>
          <div className="sp-actions">
            <button className="sp-btn" onClick={() => setConfirmEnd(false)}>
              keep playing
            </button>
            <button
              className="sp-btn sp-btn-solid"
              onClick={() => {
                setConfirmEnd(false);
                onEnd();
              }}
            >
              end party
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
