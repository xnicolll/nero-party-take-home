// ============================================================
// NERO PARTY - the mark set
// One geometric family replacing emoji + dingbats everywhere:
// 24x24 grid, 1.75 stroke, round caps, currentColor. The five
// reaction marks double as field/ribbon pins and the favicon.
// ============================================================
import type { CSSProperties } from 'react';
import type { ReactionType } from '../lib/types';

export type MarkName =
  | ReactionType
  | 'play'
  | 'pause'
  | 'skip'
  | 'close'
  | 'host'
  | 'down'
  | 'add'
  | 'check'
  | 'note'
  | 'search'
  | 'pen'
  | 'thumbsdown';

const PATHS: Record<MarkName, string> = {
  like: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  hype: 'M12 3.5C12.4 3.2 12.1 2.8 12 2.5M12 2.5v12.5M10.2 18.5a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0',
  // a thumbs-down: the dislike / skip vote
  thumbsdown:
    'M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z',
  // a music note: fallback for missing album art
  note: 'M9 18V5l12-2v13M9 18a3 3 0 1 0-6 0 3 3 0 0 0 6 0M21 16a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  play: 'M8.5 5.5 18.5 12 8.5 18.5Z',
  pause: 'M9 5.5v13M15 5.5v13',
  skip: 'M5.5 5.5 12 12l-6.5 6.5M13 5.5 19.5 12 13 18.5',
  close: 'M6 6l12 12M18 6 6 18',
  host: 'M12 3.5l1.8 6.7 6.7 1.8-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8Z',
  down: 'M6.5 9.5 12 15l5.5-5.5',
  add: 'M12 5.5v13M5.5 12h13',
  check: 'M5.5 12.5 10 17l8.5-9.5',
  // a magnifier: the search control
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM21 21l-4.7-4.7',
  // a pencil: the tap-to-edit hint on the host name
  pen: 'M16.5 4.5l3 3M4 20l1-4L17 4l3 3L8 19Z',
};

export function Mark({
  name,
  size = 16,
  strokeWidth = 1.75,
  className,
  style,
}: {
  name: MarkName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
