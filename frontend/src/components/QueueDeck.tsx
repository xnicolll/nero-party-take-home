// ============================================================
// NERO PARTY - QueueDeck
// A nestled, fanned deck of upcoming-queue album cards that
// hugs the right of the now-playing art. Cards peek a sliver,
// overlapping with a hairline gap. Hovering a card slides it
// open to ~80% of its width and shoves the rest rightward.
// ============================================================
import type { CSSProperties } from 'react';
import './QueueDeck.css';
import { Mark } from './marks';

type DeckSong = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  hue: number;
};

// how many real cards fan out before they roll into the +N sliver
const MAX_CARDS = 5;

export function QueueDeck({
  songs,
  hostable,
  onPlayNow,
  onRemove,
}: {
  songs: DeckSong[];
  hostable: boolean;
  onPlayNow: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (songs.length === 0) return null;

  const shown = songs.slice(0, MAX_CARDS);
  const overflow = songs.length - shown.length;

  return (
    <div className="sp-deck" role="list" aria-label="Up next">
      <div className="sp-deck-fan">
        {shown.map((song, i) => {
          const Card = hostable ? 'button' : 'div';
          return (
            <Card
              key={song.id}
              role="listitem"
              className={`sp-deck-card${hostable ? ' hostable' : ''}`}
              style={{ zIndex: shown.length - i, '--i': i } as CSSProperties}
              {...(hostable
                ? {
                    type: 'button' as const,
                    onClick: () => onPlayNow(song.id),
                    'aria-label': `Play now: ${song.title} by ${song.artist}`,
                  }
                : {})}
            >
              <span className="sp-deck-cover">
                {song.artworkUrl ? (
                  <img src={song.artworkUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span
                    className="sp-deck-blank"
                    style={{ background: `oklch(0.85 0.05 ${song.hue})` }}
                  >
                    <Mark name="note" size={22} />
                  </span>
                )}
              </span>

              <span className="sp-deck-meta">
                <b>{song.title}</b>
                <i>{song.artist}</i>
              </span>

              {hostable && (
                <span
                  className="sp-deck-x"
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${song.title} from the queue`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(song.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemove(song.id);
                    }
                  }}
                >
                  <Mark name="close" size={13} />
                </span>
              )}
            </Card>
          );
        })}

        {overflow > 0 && (
          <div className="sp-deck-more" role="listitem" aria-label={`${overflow} more queued`}>
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
