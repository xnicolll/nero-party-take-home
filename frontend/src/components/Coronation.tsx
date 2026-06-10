// ============================================================
// NERO PARTY — coronation
// A brief "moment of truth" reveal in the same light UI (no dark/storm), then
// the crowns. Song + Moment of the Night are playable, like the suggestions.
// ============================================================
import { useEffect, useState } from 'react';
import { REACTIONS, fmtTime } from '../lib/nero';
import type { Rec, ResultsDTO } from '../lib/types';
import { AlbumArt, Btn, Eyebrow, RGlyph, StarField } from './atoms';
import { SnippetPlayer, type SnippetTrack } from './SnippetPlayer';
import { Modal } from './Modal';

export function Coronation({
  results,
  onRestart,
  getRecs,
}: {
  results: ResultsDTO;
  onRestart: () => void;
  getRecs: () => Promise<Rec[]>;
}) {
  const [stage, setStage] = useState<'reveal' | 'crown'>('reveal');
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [snippet, setSnippet] = useState<SnippetTrack | null>(null);
  const champ = results.songOfNight;
  const moment = results.momentOfNight;

  useEffect(() => {
    const t = setTimeout(() => setStage('crown'), 1900);
    getRecs().then(setRecs);
    return () => clearTimeout(t);
  }, [getRecs]);

  if (stage === 'reveal') {
    return (
      <div className="coro coro-reveal">
        <StarField />
        <Eyebrow>the votes are in</Eyebrow>
        <h2 className="reveal-title">here's the moment of truth…</h2>
      </div>
    );
  }

  return (
    <div className="coro coro-crown">
      <StarField />
      <div className="coro-cols bare">
        {champ && (
          <button
            className="crown-card crown-song"
            onClick={() =>
              setSnippet({
                title: champ.title,
                artist: champ.artist,
                streamUrl: champ.streamUrl,
                artworkUrl: champ.artworkUrl,
                hue: champ.hue,
                durationSec: champ.durationSec,
              })
            }
          >
            <Eyebrow color="var(--accent)">SONG OF THE NIGHT</Eyebrow>
            <div className="crown-art">
              <AlbumArt
                artworkUrl={champ.artworkUrl}
                hue={champ.hue}
                size={160}
                radius={18}
                priority
              />
              <span className="crown-play">▶</span>
            </div>
            <h3 className="crown-mtitle">{champ.title}</h3>
            <p className="crown-artist">{champ.artist}</p>
            <div className="mono crown-stat">
              {champ.score.toFixed(1)} heat/min · queued by {champ.addedByName.toLowerCase()}
            </div>
          </button>
        )}
        {moment && (
          <button
            className="crown-card crown-moment"
            onClick={() =>
              setSnippet({
                title: moment.title,
                artist: moment.artist,
                streamUrl: moment.streamUrl,
                artworkUrl: moment.artworkUrl,
                hue: moment.hue,
                durationSec: moment.durationSec,
                startFrac: moment.frac,
              })
            }
          >
            <Eyebrow color={REACTIONS[moment.glyph].color}>MOMENT OF THE NIGHT</Eyebrow>
            <div className="crown-art">
              <AlbumArt
                artworkUrl={moment.artworkUrl}
                hue={moment.hue}
                size={160}
                radius={18}
                priority
              />
              <span className="moment-badge">
                <RGlyph type={moment.glyph} size={24} />
              </span>
              <span className="crown-play">▶</span>
            </div>
            <h3 className="crown-mtitle">{moment.title}</h3>
            <p className="crown-artist">at {moment.ts}</p>
            <div className="mono crown-stat">
              won the playoff · {moment.heat.toFixed(0)} peak heat
            </div>
          </button>
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
            {recs.slice(0, 5).map((r) => (
              <button
                key={r.id}
                className="rec-card"
                onClick={() =>
                  setSnippet({
                    title: r.title,
                    artist: r.artist,
                    streamUrl: r.streamUrl,
                    artworkUrl: r.artworkUrl,
                    hue: r.hue,
                    durationSec: r.durationSec,
                  })
                }
              >
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
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="coro-actions">
        <Btn big onClick={onRestart}>
          Go back home
        </Btn>
      </div>

      <Modal open={!!snippet} onClose={() => setSnippet(null)}>
        {snippet && <SnippetPlayer track={snippet} onDone={() => setSnippet(null)} />}
      </Modal>
    </div>
  );
}
