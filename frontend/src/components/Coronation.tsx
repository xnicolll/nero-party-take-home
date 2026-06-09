// ============================================================
// NERO PARTY — coronation (v2)
// dim -> replay the peak -> crown. Real album art, less card framing, and a
// "you might like" row matched from what the group liked (Audius genre/artist).
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { REACTIONS, fmtTime, mulberry32, seedFromId } from '../lib/nero';
import type { Rec, ReactionType, ResultsDTO } from '../lib/types';
import { AlbumArt, Btn, Eyebrow, HeatShape, RGlyph, StarField } from './atoms';

const STORM_TYPES: ReactionType[] = ['drop', 'groove', 'feels', 'wtf', 'chills'];

export function Coronation({
  results,
  onRestart,
  getRecs,
}: {
  results: ResultsDTO;
  onRestart: () => void;
  getRecs: () => Promise<Rec[]>;
}) {
  const [stage, setStage] = useState<'dim' | 'replay' | 'crown'>('dim');
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const champ = results.songOfNight;
  const moment = results.momentOfNight;

  useEffect(() => {
    const t1 = setTimeout(() => setStage('replay'), 1400);
    const t2 = setTimeout(() => setStage('crown'), 4600);
    getRecs().then(setRecs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [getRecs]);

  const storm = useMemo(() => {
    if (!moment) return [];
    const rnd = mulberry32(seedFromId(moment.songId) + 99);
    return Array.from({ length: 14 }, (_, i) => ({
      type: i % 3 === 0 ? moment.glyph : STORM_TYPES[Math.floor(rnd() * STORM_TYPES.length)],
      left: 12 + ((i * 61) % 76),
      delay: i * 0.18,
      size: 18 + ((i * 7) % 22),
    }));
  }, [moment]);

  if (stage === 'dim') {
    return (
      <div className="coro coro-dim">
        <p className="coro-dimtext mono">the lights go down…</p>
      </div>
    );
  }

  if (stage === 'replay' && moment) {
    return (
      <div className="coro coro-replay">
        <Eyebrow>
          REPLAYING THE PEAK · {moment.title.toUpperCase()} · {moment.ts}
        </Eyebrow>
        <div className="coro-storm">
          {storm.map((g, i) => (
            <span
              key={i}
              className="storm-glyph"
              style={{
                color: REACTIONS[g.type].color,
                left: g.left + '%',
                animationDelay: g.delay + 's',
                fontSize: g.size,
              }}
            >
              {REACTIONS[g.type].glyph}
            </span>
          ))}
          <HeatShape buckets={moment.buckets} w={520} h={80} />
        </div>
      </div>
    );
  }

  return (
    <div className="coro coro-crown">
      <StarField />
      <div className="coro-cols bare">
        {champ && (
          <div className="crown-card crown-song">
            <Eyebrow color="var(--accent)">SONG OF THE NIGHT</Eyebrow>
            <AlbumArt artworkUrl={champ.artworkUrl} hue={champ.hue} size={188} radius={20} />
            <h2 className="crown-title">{champ.title}</h2>
            <p className="crown-artist">{champ.artist}</p>
            <div className="mono crown-stat">
              {champ.score.toFixed(1)} heat/min · queued by {champ.addedByName.toLowerCase()}
            </div>
            <HeatShape buckets={champ.buckets} w={240} h={34} />
          </div>
        )}
        {moment && (
          <div className="crown-card crown-moment">
            <Eyebrow color={REACTIONS[moment.glyph].color}>MOMENT OF THE NIGHT</Eyebrow>
            <div className="crown-moment-glyph">
              <RGlyph type={moment.glyph} size={54} />
            </div>
            <h3 className="crown-mtitle">{moment.title}</h3>
            <p className="crown-artist">at {moment.ts}</p>
            <div className="mono crown-stat">
              won the playoff · {moment.heat.toFixed(0)} peak heat
            </div>
          </div>
        )}
      </div>

      <div className="superl-row">
        {results.superlatives.map((s) => (
          <div key={s.key} className="superl">
            <span className="superl-key mono">{s.key}</span>
            <b>{s.songTitle}</b>
            <span className="superl-stat mono">{s.stat}</span>
          </div>
        ))}
      </div>

      <div className="recs">
        <Eyebrow>WHAT TO PLAY NEXT · matched to your night</Eyebrow>
        {recs === null ? (
          <span className="recs-loading">finding songs your room would love…</span>
        ) : recs.length === 0 ? (
          <span className="recs-loading">no matches this time</span>
        ) : (
          <div className="recs-row">
            {recs.map((r) => (
              <div key={r.id} className="rec-card">
                <div className="rec-art">
                  <AlbumArt artworkUrl={r.artworkUrl} hue={r.hue} size={150} radius={14} />
                  <span className="rec-reason">{r.reason}</span>
                </div>
                <div className="rec-meta">
                  <b>{r.title}</b>
                  <span>
                    {r.artist} · {fmtTime(r.durationSec)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="coro-actions">
        <Btn big onClick={onRestart}>
          Run it back
        </Btn>
      </div>
    </div>
  );
}
