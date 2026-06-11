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
  | 'check';

const PATHS: Record<MarkName, string> = {
  // needle drop: a stem falling into the floor
  drop: 'M12 3v9M7 14l5 5 5-5',
  // one period of groove
  groove: 'M2.5 12C5.7 4.5 8.5 4.5 11.75 12S18 19.5 21.5 12',
  // a swell, rising
  feels: 'M4 16a8 8 0 0 1 16 0M8.5 16a3.5 3.5 0 0 1 7 0',
  // an uneven splat of a bang (deliberately NOT a symmetric spinner)
  wtf: 'M12 12 11 3.5M12 12 17 8.5M12 12 21 13M12 12 14.5 19M12 12 6 19M12 12 3.5 11',
  // a shiver, cascading down the spine
  chills: 'M6.5 4.5v8M12 7.5v8M17.5 10.5v8',
  play: 'M8.5 5.5 18.5 12 8.5 18.5Z',
  pause: 'M9 5.5v13M15 5.5v13',
  skip: 'M5.5 5.5 12 12l-6.5 6.5M13 5.5 19.5 12 13 18.5',
  close: 'M6 6l12 12M18 6 6 18',
  host: 'M12 3.5l1.8 6.7 6.7 1.8-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8Z',
  down: 'M6.5 9.5 12 15l5.5-5.5',
  add: 'M12 5.5v13M5.5 12h13',
  check: 'M5.5 12.5 10 17l8.5-9.5',
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
