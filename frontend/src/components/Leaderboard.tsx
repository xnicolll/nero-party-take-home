import './Leaderboard.css';
import type { SongDTO } from '../lib/types';
import { AlbumArt } from './atoms';
import { Mark } from './marks';

// how many rows we show before collapsing the rest into a quiet "+N" line.
const CAP = 7;

// LEFT column of the party page: finished songs ranked by score, building
// toward the song of the night. `songs` arrives pre-sorted (highest first)
// and finished-only from the parent; we render it straight, top-down.
export function Leaderboard({
  songs,
  liveSongId,
}: {
  songs: SongDTO[];
  liveSongId: string;
}) {
  const shown = songs.slice(0, CAP);
  const extra = songs.length - shown.length;

  return (
    <div className="sp-board">
      <div className="sp-board-head">song of the night</div>

      {shown.length === 0 ? (
        <div className="sp-board-empty">nothing&rsquo;s crowned yet</div>
      ) : (
        <ol className="sp-board-list">
          {shown.map((s, i) => (
            <li
              key={s.id}
              data-song-id={s.id}
              className={
                'sp-board-row' +
                (i === 0 ? ' sp-board-row-top' : '') +
                (s.id === liveSongId ? ' sp-board-row-live' : '')
              }
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <AlbumArt artworkUrl={s.artworkUrl} hue={s.hue} size={36} radius={8} />
              <div className="sp-board-meta">
                <span className="sp-board-title">{s.title}</span>
                <span className="sp-board-artist">{s.artist}</span>
              </div>
              <span className="sp-board-score">
                <Mark name="like" size={13} />
                {Math.round(s.score)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {extra > 0 && <div className="sp-board-more">+{extra} more</div>}
    </div>
  );
}
