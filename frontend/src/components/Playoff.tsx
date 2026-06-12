// ============================================================
// NERO PARTY - finale playoff, on paper
// Two moments face off. Your vote splashes paint behind your
// pick; the room's tally IS the size of each paint blob. When
// it's decided, the ink line underlines the winner. The server
// runs the bracket + bot votes; the client renders + casts one.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { REACTIONS } from '../lib/nero';
import type { FinaleState, MomentDTO } from '../lib/types';
import { EASE_OUT } from '../lib/motion';
import { AlbumArt } from './atoms';
import { Mark } from './marks';
import { InkUnderline } from './ink';

function MomentCard({
  moment,
  share,
  picked,
  winner,
  dimmed,
  playing,
  onPick,
  onHover,
  onLeave,
  onPreview,
}: {
  moment: MomentDTO;
  share: number; // the room's vote share - the blob's size
  picked: boolean;
  winner: boolean;
  dimmed: boolean;
  playing: boolean;
  onPick: (() => void) | null;
  onHover: () => void;
  onLeave: () => void;
  onPreview: () => void;
}) {
  const color = REACTIONS[moment.glyph].color;
  const ref = useRef<HTMLButtonElement>(null);
  // a fresh vote splashes
  useEffect(() => {
    if (!picked || !ref.current) return;
    ref.current
      .querySelector('.sp-duel-blob')
      ?.animate(
        [
          { transform: `translate(-50%, -50%) scale(${0.4 + share})` },
          { transform: `translate(-50%, -50%) scale(${0.75 + share})` },
          { transform: `translate(-50%, -50%) scale(${0.55 + share})` },
        ],
        { duration: 500, easing: EASE_OUT },
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  return (
    <button
      ref={ref}
      className={
        'sp-duel-card' +
        (picked ? ' picked' : '') +
        (winner ? ' winner' : '') +
        (dimmed ? ' dim' : '')
      }
      onClick={onPick ?? undefined}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      disabled={!onPick}
    >
      <span
        className="sp-duel-blob"
        style={{
          background: color,
          transform: `translate(-50%, -50%) scale(${0.45 + share * 1.05})`,
        }}
        aria-hidden
      />
      <span className="sp-duel-art">
        <AlbumArt
          artworkUrl={moment.artworkUrl?.replace('100x100', '400x400') ?? null}
          hue={moment.hue}
          size={184}
          radius={16}
          alt={`${moment.title} by ${moment.artist}`}
        />
        <span className="sp-duel-mark" style={{ color }}>
          <Mark name={moment.glyph} size={20} strokeWidth={2.2} />
        </span>
      </span>
      <h3 className="sp-duel-title">{moment.title}</h3>
      <p className="sp-duel-artist">{moment.artist}</p>
      {/* plain span (not a nested button): tap to preview without casting a vote */}
      <span
        className={'sp-duel-hint' + (playing ? ' on' : '')}
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
      >
        {playing ? 'playing this moment' : 'hear it'}
      </span>
      <span className="sp-duel-under">
        {winner && <InkUnderline width={150} stroke={3} delay={150} />}
      </span>
      <span className="sp-duel-vote sp-label">{picked ? 'your vote' : ' '}</span>
    </button>
  );
}

export function Playoff({ finale, onVote }: { finale: FinaleState; onVote: (s: 0 | 1) => void }) {
  const [picked, setPicked] = useState<0 | 1 | null>(null);
  const [previewing, setPreviewing] = useState<0 | 1 | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  // one audio element for moment previews
  useEffect(() => {
    const a = new Audio();
    a.preload = 'auto';
    previewRef.current = a;
    return () => {
      a.pause();
      a.src = '';
    };
  }, []);

  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hoverPreview = (side: 0 | 1, m: MomentDTO) => {
    const a = previewRef.current;
    if (!a) return;
    if (a.src !== m.streamUrl) a.src = m.streamUrl;
    const begin = () => {
      try {
        a.currentTime = Math.max(
          0,
          Math.min((m.durationSec || 60) - 1, m.frac * (m.durationSec || 60)),
        );
      } catch {
        /* ignore */
      }
      a.volume = 0.7;
      a.play().catch(() => {});
    };
    if (a.readyState >= 1) begin();
    else a.addEventListener('loadedmetadata', begin, { once: true });
    setPreviewing(side);
  };
  const stopPreview = () => {
    previewRef.current?.pause();
    setPreviewing(null);
  };
  // a passing cursor shouldn't blast audio: only preview after a short hover
  const scheduleHover = (side: 0 | 1, m: MomentDTO) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => hoverPreview(side, m), 260);
  };
  const cancelHover = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    stopPreview();
  };
  // explicit tap (touch / click the hint): toggle immediately
  const togglePreview = (side: 0 | 1, m: MomentDTO) => {
    if (previewing === side) stopPreview();
    else hoverPreview(side, m);
  };

  // reset local pick when the match changes
  const matchKey = `${finale.stage}:${finale.round}:${finale.pair?.[0]?.songId ?? ''}:${finale.pair?.[1]?.frac ?? ''}`;
  useEffect(() => {
    setPicked(null);
  }, [matchKey]);

  if (!finale.pair) return null;
  const total = finale.votes[0] + finale.votes[1];
  const decided = finale.decided;
  const share0 =
    decided != null ? (decided === 0 ? 0.95 : 0.05) : total ? finale.votes[0] / total : 0.5;

  const pick = (s: 0 | 1) => {
    if (picked != null || decided != null) return;
    setPicked(s);
    onVote(s);
  };

  return (
    <div className="sp-finale">
      <header className="sp-finale-head">
        <p className="sp-label sp-in">
          the finale ·{' '}
          {finale.stage === 'final'
            ? 'grand final'
            : `semifinal ${finale.round + 1} of ${finale.matchCount}`}
        </p>
        <h2 className="sp-finale-title sp-in" style={{ animationDelay: '0.1s' }}>
          Which moment hit harder?
        </h2>
        <p className="sp-hint sp-in" style={{ animationDelay: '0.2s' }} role="status">
          {picked == null && decided == null
            ? 'cast your vote - the splash grows with the room'
            : decided != null
              ? 'decided.'
              : 'the room is voting…'}
        </p>
      </header>
      <div className="sp-duel">
        <MomentCard
          moment={finale.pair[0]}
          share={share0}
          picked={picked === 0}
          winner={decided === 0}
          dimmed={decided === 1}
          playing={previewing === 0}
          onPick={picked == null && decided == null ? () => pick(0) : null}
          onHover={() => scheduleHover(0, finale.pair![0])}
          onLeave={cancelHover}
          onPreview={() => togglePreview(0, finale.pair![0])}
        />
        <span className="sp-duel-vs" aria-hidden>
          vs
        </span>
        <MomentCard
          moment={finale.pair[1]}
          share={1 - share0}
          picked={picked === 1}
          winner={decided === 1}
          dimmed={decided === 0}
          playing={previewing === 1}
          onPick={picked == null && decided == null ? () => pick(1) : null}
          onHover={() => scheduleHover(1, finale.pair![1])}
          onLeave={cancelHover}
          onPreview={() => togglePreview(1, finale.pair![1])}
        />
      </div>
    </div>
  );
}
