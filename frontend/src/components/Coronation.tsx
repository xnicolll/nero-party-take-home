// ============================================================
// NERO PARTY - coronation, the morning after
// Back on paper, one screen: the ink line draws a crown over the
// winner while a neon blob blooms behind it. Superlatives land as
// stamped labels on the left; the wall of suggested album art
// drifts on the right, like posters.
// ============================================================
import { useEffect, useState } from 'react';
import { REACTIONS } from '../lib/nero';
import type { Rec, ResultsDTO } from '../lib/types';
import { crownPath } from '../lib/ink';
import { prefersReducedMotion } from '../lib/motion';
import { AlbumArt } from './atoms';
import { Mark } from './marks';
import { InkStroke } from './ink';
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
  const [stage, setStage] = useState<'hold' | 'crown'>('hold');
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [snippet, setSnippet] = useState<SnippetTrack | null>(null);
  const [artFail, setArtFail] = useState<Record<string, boolean>>({});
  const champ = results.songOfNight;
  const moment = results.momentOfNight;

  useEffect(() => {
    let alive = true;
    getRecs().then((r) => alive && setRecs(r));
    const t = setTimeout(() => alive && setStage('crown'), prefersReducedMotion() ? 0 : 950);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [getRecs]);

  if (!champ) {
    return (
      <div className="sp-end sp-end-hold">
        <p className="sp-label sp-in">the party ended quietly</p>
        <div className="sp-actions sp-in" style={{ animationDelay: '0.2s' }}>
          <button className="sp-btn" onClick={onRestart}>
            go back home
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'hold') {
    return (
      <div className="sp-end sp-end-hold">
        <p className="sp-label sp-in" style={{ animationDelay: '0.2s' }}>
          the votes are in…
        </p>
      </div>
    );
  }

  const wall = recs ?? [];
  // split into three columns; the marquee loops each column, so no song is
  // ever padded in twice (recs are already deduped server-side)
  const wallCols = [0, 1, 2].map((c) => wall.filter((_, i) => i % 3 === c));

  return (
    <div className="sp-end">
      <section className="sp-end-left">
        <div className="sp-crowned-art sp-in">
          <span className="sp-crowned-blob" aria-hidden />
          <svg className="sp-crowned-crown" viewBox="0 0 320 150" aria-hidden>
            <InkStroke
              d={crownPath(160, 96, 168)}
              width={5}
              color="var(--sp-neon)"
              draw
              duration={1150}
              delay={500}
            />
          </svg>
          <AlbumArt
            artworkUrl={champ.artworkUrl?.replace('100x100', '400x400') ?? null}
            hue={champ.hue}
            size={200}
            radius={18}
            priority
            alt={`${champ.title} by ${champ.artist}`}
          />
        </div>
        <p className="sp-label sp-in" style={{ animationDelay: '0.35s' }}>
          song of the party
        </p>
        <h1 className="sp-crowned-title sp-in" style={{ animationDelay: '0.45s' }}>
          {champ.title}
        </h1>
        <p className="sp-sub sp-in" style={{ animationDelay: '0.55s' }}>
          {champ.artist} · queued by {champ.addedByName.toLowerCase()}
        </p>
        <button
          className="sp-btn sp-btn-quiet sp-in"
          style={{ animationDelay: '0.65s' }}
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
          <Mark name="play" size={11} /> play it again
        </button>

        {moment && (
          <button
            className="sp-end-moment sp-in"
            style={{ animationDelay: '0.75s' }}
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
            <span className="sp-label">moment of the party</span>
            <span className="sp-end-moment-row">
              <span style={{ color: REACTIONS[moment.glyph].color }}>
                <Mark name={moment.glyph} size={18} strokeWidth={2.2} />
              </span>
              <b>{moment.title}</b>
              <i>hear it</i>
            </span>
          </button>
        )}

        <div className="sp-stamps sp-in" style={{ animationDelay: '0.85s' }}>
          {results.superlatives.map((s, i) => (
            <div
              key={s.key}
              className="sp-stampcard"
              style={{ transform: `rotate(${(((i * 7) % 5) - 2) * 0.9}deg)` }}
            >
              <span className="sp-stampcard-key">{s.key.toLowerCase()}</span>
              <b>{s.songTitle}</b>
            </div>
          ))}
        </div>

        <div className="sp-actions sp-end-actions sp-in" style={{ animationDelay: '0.95s' }}>
          <button className="sp-btn sp-btn-solid" onClick={onRestart}>
            go back home
          </button>
        </div>
      </section>

      <section className="sp-wall sp-in" style={{ animationDelay: '0.6s' }}>
        <p className="sp-label">what to play next · matched to the party</p>
        {recs === null ? (
          <p className="sp-hint">finding songs your room would love…</p>
        ) : wall.length === 0 ? (
          <p className="sp-hint">no matches this time</p>
        ) : (
          <div className="sp-wall-cols">
            {wallCols.map(
              (col, ci) =>
                col.length > 0 && (
                  <div key={ci} className="sp-wall-clip">
                    <div
                      className={'sp-wall-track' + (ci % 2 ? ' down' : '')}
                      style={{ animationDuration: `${46 + ci * 14}s` }}
                    >
                      {[...col, ...col].map((r, i) => (
                        <button
                          key={r.id + ':' + i}
                          className="sp-wall-item"
                          title={r.reason}
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
                          {r.artworkUrl && !artFail[r.id] ? (
                            <img
                              src={r.artworkUrl.replace('100x100', '300x300')}
                              alt=""
                              loading="lazy"
                              onError={() => setArtFail((f) => ({ ...f, [r.id]: true }))}
                            />
                          ) : (
                            <span
                              className="sp-art-blank"
                              style={{ background: `oklch(0.85 0.05 ${r.hue})` }}
                            >
                              <Mark name="groove" size={18} />
                            </span>
                          )}
                          <span className="sp-wall-meta">
                            <b>{r.title}</b>
                            <i>{r.artist}</i>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ),
            )}
          </div>
        )}
      </section>

      <Modal open={!!snippet} onClose={() => setSnippet(null)}>
        {snippet && <SnippetPlayer track={snippet} onDone={() => setSnippet(null)} />}
      </Modal>
    </div>
  );
}
