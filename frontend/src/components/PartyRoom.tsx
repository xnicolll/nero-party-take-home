// ============================================================
// NERO PARTY - your.party (orbit stage)
// One neon screen, no scrolling. The hand-drawn line under the cycling
// wordmark IS the song: it draws itself with playback and catches every
// like. Below it the orbit arena: the now-playing song is a sun at center,
// queued songs orbit as planets, rays grow with progress, reactions send
// ripples. Guest faces float on the right; a reel of similar songs drifts
// along the bottom.
// ============================================================
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { Mark } from './marks';
import { InkTimeline, type FutureChip } from './ink';
import { ReactionMarks } from './ReactionMarks';
import { GuestDoodles } from './GuestDoodles';
import { OrbitArena } from './OrbitArena';
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
  const [reelFail, setReelFail] = useState<Record<string, boolean>>({});
  const liveSong = songs.find((s) => s.id === current.song.id) ?? current.song;
  const adder = participants.find((p) => p.id === liveSong.addedById);
  const queueFull = songs.length >= party.maxSongs;
  const queuedIds = useMemo(() => new Set(songs.map((s) => s.trackId)), [songs]);

  // the upcoming queue: everything queued after the live song (feeds the orbit)
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

  // finished songs for territory calculation in the orbit
  const finishedRanked = useMemo(
    () => songs.filter((s) => s.played).sort((a, b) => b.score - a.score),
    [songs],
  );

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

  // stepped conveyor: every 2.8s the reel shifts one item left
  const reelTrackRef = useRef<HTMLDivElement>(null);
  const reelClipRef = useRef<HTMLDivElement>(null);
  const reelStepRef = useRef(0);
  const reelAlignRef = useRef(0);
  const REEL_ITEM_W = 104;
  const COVER_W = 88;
  const reelReady = reel.length > 0;
  useLayoutEffect(() => {
    if (!reelReady) return;
    const clip = reelClipRef.current;
    const track = reelTrackRef.current;
    if (!clip || !track) return;
    const r = clip.offsetWidth % REEL_ITEM_W;
    const A = r > 0 && r < COVER_W ? COVER_W - r : 0;
    reelAlignRef.current = A;
    track.style.transition = 'none';
    track.style.transform = `translateX(-${A}px)`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reelReady]);
  useEffect(() => {
    if (reel.length === 0) return;
    const A = reelAlignRef.current;
    const pos = (step: number) => `translateX(calc(-${step} * ${REEL_ITEM_W}px - ${A}px))`;
    if (reelStepRef.current >= reel.length) {
      const track = reelTrackRef.current;
      if (track) {
        track.style.transition = 'none';
        track.style.transform = pos(0);
      }
      reelStepRef.current = 0;
    }
    const id = setInterval(() => {
      const track = reelTrackRef.current;
      if (!track) return;
      reelStepRef.current++;
      if (reelStepRef.current >= reel.length) {
        track.style.transition = 'none';
        track.style.transform = pos(0);
        void (track as HTMLElement).offsetWidth;
        reelStepRef.current = 0;
      }
      track.style.transition = 'transform 0.55s cubic-bezier(0.5,0,0.16,1)';
      track.style.transform = pos(reelStepRef.current);
    }, 2800);
    return () => { clearInterval(id); };
  }, [reel.length]);
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

  // the whole room throbs a contrasting shade the moment a person reacts
  const partyRef = useRef<HTMLDivElement>(null);
  const pulse = useCallback((type: ReactionType | 'dislike') => {
    if (prefersReducedMotion()) return;
    const el = partyRef.current;
    if (!el) return;
    const peak = type === 'hype' ? '#6e4a00' : type === 'dislike' ? '#0f4640' : '#7c1f3a';
    el.animate(
      [
        { backgroundColor: '#ff4d00' },
        { backgroundColor: peak, offset: 0.2 },
        { backgroundColor: '#ff4d00' },
      ],
      { duration: 540, easing: EASE_OUT },
    );
  }, []);
  useEffect(() => fieldBus.on('reaction', (e) => !e.isBot && pulse(e.type)), [pulse]);

  const handleDislike = useCallback(
    (on: boolean) => {
      if (on) pulse('dislike');
      onDislike(on);
    },
    [onDislike, pulse],
  );

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
    <div className={'sp-party' + (skipping ? ' skipping' : '')} ref={partyRef}>
      <header className="sp-party-bar">
        <Wordmark owner="your" />
        <div className="sp-party-actions">
          <button className="sp-onbtn" onClick={copy}>
            {copied ? 'link copied' : 'invite'}
          </button>
          <button className="sp-onbtn" onClick={onHelp} aria-label="How it works">
            ?
          </button>
          <button className="sp-onbtn" onClick={onLeave}>
            leave
          </button>
        </div>
      </header>

      {/* the line: past likes (heart stamps) + the playhead nib. The queue now
          lives in the deck on the right, so the line carries no chips. */}
      <div className="sp-party-line">
        <InkTimeline songId={liveSong.id} frac={liveFrac} pins={pins} bursts={bursts} height={88} />
      </div>

      <main className="sp-stage">
        <OrbitArena
          liveSong={liveSong}
          queue={future}
          finishedSongs={finishedRanked}
          participants={participants}
          liveFrac={liveFrac}
          adderName={adder?.name ?? liveSong.addedByName}
          isHost={isHost}
          paused={paused}
          youId={youId}
          disliked={disliked}
          onTogglePlay={onTogglePlay}
          onSkip={onSkip}
          onSetConfirmEnd={setConfirmEnd}
          onPlayNow={onPlayNow}
          onRemove={onRemove}
        />
      </main>

      <div className="sp-party-foot">
        <div className="sp-feel">
          <ReactionMarks
            onReact={onReact}
            onDislike={handleDislike}
            disliked={disliked}
            hypeLeft={chillsLeft}
            dislikeCount={dislikeCount}
            dislikeTotal={dislikeTotal}
            disabled={paused || skipping}
          />
        </div>
      </div>

      <GuestDoodles participants={participants} youId={youId} />

      <section className="sp-reel">
        <div className="sp-reel-head">
          <span className="sp-onlabel">similar songs · tap to queue</span>
        </div>
        <div className="sp-reel-body">
          <div className="sp-reel-clip" ref={reelClipRef}>
            {reel.length > 0 ? (
              <div className="sp-reel-track" ref={reelTrackRef}>
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
                        onError={() => setReelFail((f) => ({ ...f, [t.id]: true }))}
                      />
                    ) : (
                      <span
                        className="sp-art-blank"
                        style={{ background: `oklch(0.85 0.05 ${t.hue})` }}
                      >
                        <Mark name="note" size={18} />
                      </span>
                    )}
                    <b>{t.title}</b>
                  </button>
                ))}
              </div>
            ) : (
              <div className="sp-reel-skeleton" aria-hidden>
                {Array.from({ length: 14 }, (_, i) => (
                  <span key={i} className="sp-reel-skel" />
                ))}
              </div>
            )}
          </div>
          <button
            className="sp-searchtile"
            disabled={queueFull}
            onClick={() => setShowSearch(true)}
            aria-label={queueFull ? 'Queue full' : 'Search for any song'}
          >
            <Mark name="search" size={26} strokeWidth={2} />
            <span>{queueFull ? 'full' : 'search'}</span>
          </button>
        </div>
      </section>

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
            suggestions={reel}
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
