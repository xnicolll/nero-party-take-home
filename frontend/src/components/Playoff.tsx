// ============================================================
// NERO PARTY — finale playoff (ported from nero-finale.jsx)
// Server runs the bracket + bot votes; the client renders + casts one vote.
// ============================================================
import { useEffect, useState } from 'react';
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
  onPick,
}: {
  moment: MomentDTO;
  picked: boolean;
  votes: number;
  total: number;
  winner: boolean;
  dimmed: boolean;
  onPick: (() => void) | null;
}) {
  return (
    <button
      className={
        'mcard' +
        (picked ? ' mcard-picked' : '') +
        (winner ? ' mcard-winner' : '') +
        (dimmed ? ' mcard-dim' : '')
      }
      onClick={onPick ?? undefined}
      disabled={!onPick}
    >
      <div className="mcard-top">
        <AlbumArt artworkUrl={moment.artworkUrl} hue={moment.hue} size={72} radius={12} />
        <RGlyph type={moment.glyph} size={26} />
      </div>
      <h3 className="mcard-title">{moment.title}</h3>
      <p className="mcard-artist">{moment.artist}</p>
      <div className="mcard-ts mono">at {moment.ts}</div>
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
          ? 'Cast your vote — the room follows.'
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
          onPick={picked == null && decided == null ? () => pick(0) : null}
        />
        <span className="playoff-vs">vs</span>
        <MomentCard
          moment={finale.pair[1]}
          picked={picked === 1}
          votes={finale.votes[1]}
          total={total}
          winner={decided === 1}
          dimmed={decided === 0}
          onPick={picked == null && decided == null ? () => pick(1) : null}
        />
      </div>
    </div>
  );
}
