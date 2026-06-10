// ============================================================
// NERO PARTY - finale playoff (ported from nero-finale.jsx)
// Server runs the bracket + bot votes; the client renders + casts one vote.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { REACTIONS } from '../lib/nero';
import type { FinaleState, MomentDTO } from '../lib/types';
import { AlbumArt, Eyebrow, HeatShape, RGlyph, StarField } from './atoms';

function MomentCard({
  moment,
  picked,
  votes,
  total,
  winner,
  dimmed,
  playing,
  onPick,
  onHover,
  onLeave,
  onPreview,
}: {
  moment: MomentDTO;
  picked: boolean;
  votes: number;
  total: number;
  winner: boolean;
  dimmed: boolean;
  playing: boolean;
  onPick: (() => void) | null;
  onHover: () => void;
  onLeave: () => void;
  onPreview: () => void;
}) {
  return (
    <button
      className={
        'mcard' +
        (picked ? ' mcard-picked' : '') +
        (winner ? ' mcard-winner' : '') +
        (dimmed ? ' mcard-dim' : '') +
        (playing ? ' mcard-playing' : '')
      }
      onClick={onPick ?? undefined}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      disabled={!onPick}
    >
      <div className="mcard-top">
        <AlbumArt
          artworkUrl={moment.artworkUrl}
          hue={moment.hue}
          size={72}
          radius={12}
          alt={`${moment.title} by ${moment.artist}`}
        />
        <RGlyph type={moment.glyph} size={26} />
      </div>
      <h3 className="mcard-title">{moment.title}</h3>
      <p className="mcard-artist">{moment.artist}</p>
      <div className="mcard-ts mono">at {moment.ts}</div>
      {/* plain span (not a nested button): tap to preview without casting a vote */}
      <span
        className="mcard-playhint"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
      >
        {playing ? (
          <>
            <span className="dot" />
            playing this moment
          </>
        ) : (
          '▶ tap to hear it'
        )}
      </span>
      <HeatShape buckets={moment.buckets} color={REACTIONS[moment.glyph].color} w={180} h={30} />
      <div className="mcard-votes">
        <span className="mcard-bar" style={{ width: total ? (votes / total) * 100 + '%' : 0 }} />
        <span className="mcard-count mono">{votes > 0 ? votes : ''}</span>
      </div>
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

  const pick = (s: 0 | 1) => {
    if (picked != null || decided != null) return;
    setPicked(s);
    onVote(s);
  };

  return (
    <div className="playoff">
      <StarField />
      <Eyebrow>
        THE FINALE ·{' '}
        {finale.stage === 'final'
          ? 'GRAND FINAL'
          : `SEMIFINAL ${finale.round + 1} OF ${finale.matchCount}`}
      </Eyebrow>
      <h2 className="playoff-title">Which moment hit harder?</h2>
      <p className="playoff-sub">
        {picked == null && decided == null
          ? 'Cast your vote, the room follows.'
          : decided != null
            ? 'Decided.'
            : 'The room is voting…'}
      </p>
      <div className="playoff-pair">
        <MomentCard
          moment={finale.pair[0]}
          picked={picked === 0}
          votes={finale.votes[0]}
          total={total}
          winner={decided === 0}
          dimmed={decided === 1}
          playing={previewing === 0}
          onPick={picked == null && decided == null ? () => pick(0) : null}
          onHover={() => scheduleHover(0, finale.pair![0])}
          onLeave={cancelHover}
          onPreview={() => togglePreview(0, finale.pair![0])}
        />
        <span className="playoff-vs">vs</span>
        <MomentCard
          moment={finale.pair[1]}
          picked={picked === 1}
          votes={finale.votes[1]}
          total={total}
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
