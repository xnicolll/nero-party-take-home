// ============================================================
// NERO PARTY - short tutorial (ported from nero-tutorial.jsx)
// ============================================================
import { useState } from 'react';
import { REACTION_ORDER } from '../lib/nero';
import { HeatShape, PersonDot, RGlyph, VinylArt } from './atoms';

const DEMO_HUES = [28, 264, 330];
const DEMO_PEOPLE = [
  { name: 'You', color: '#E8743B' },
  { name: 'Maya', color: '#C2703E' },
  { name: 'Theo', color: '#5F8A4E' },
];

const TUT_STEPS = [
  {
    path: 'step 1 of 6',
    title: 'Start a party',
    body: 'Pick the rules. Share one link. Friends join. No accounts.',
    visual: () => <div className="orb orb-sm" />,
  },
  {
    path: 'step 2 of 6',
    title: 'Songs play for everyone',
    body: 'One shared queue. Everyone hears the same song at the same time.',
    visual: () => (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {DEMO_HUES.map((h) => (
          <VinylArt key={h} hue={h} size={38} />
        ))}
      </div>
    ),
  },
  {
    path: 'step 3 of 6',
    title: 'Tap what you feel',
    body: 'Your tap sticks to that exact second of the song. The drop. The bridge. That bit.',
    visual: () => (
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {REACTION_ORDER.map((r) => (
          <RGlyph key={r} type={r} size={18} />
        ))}
      </div>
    ),
  },
  {
    path: 'step 4 of 6',
    title: 'Sync = bonus',
    body: '3 people tap within 2 seconds? That moment scores highly. Feel it together.',
    visual: () => (
      <div style={{ display: 'flex', gap: 6 }}>
        {DEMO_PEOPLE.map((p) => (
          <PersonDot key={p.name} person={p} lit size={30} />
        ))}
      </div>
    ),
  },
  {
    path: 'step 5 of 6',
    title: 'CHILLS is rare',
    body: 'You only get a few in each party. Worth 3×. Save it for real goosebumps.',
    visual: () => <RGlyph type="chills" size={32} />,
  },
  {
    path: 'step 6 of 6',
    title: 'One song wins',
    body: 'Songs race on a live board. At the end, the best moments battle 1v1. Then a winner is crowned.',
    visual: () => (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <HeatShape buckets={[1, 3, 2, 6, 9, 4, 2, 5, 11, 6, 3, 1]} w={130} h={36} />
      </div>
    ),
  },
];

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = TUT_STEPS[i];
  const last = i === TUT_STEPS.length - 1;
  const V = step.visual;
  return (
    <div className="tut-overlay" onClick={onClose}>
      <div className="tut-card" onClick={(e) => e.stopPropagation()}>
        <span className="tut-path">{step.path}</span>
        <div className="tut-visual">
          <V />
        </div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tut-foot">
          <div className="tut-dots">
            {TUT_STEPS.map((_, d) => (
              <span key={d} className={'tut-dot' + (d === i ? ' on' : '')} />
            ))}
          </div>
          <div className="tut-btns">
            {i > 0 && (
              <button className="tut-skip" onClick={() => setI(i - 1)}>
                back
              </button>
            )}
            {!last && (
              <button className="tut-skip" onClick={onClose}>
                skip
              </button>
            )}
            <button className="tut-next" onClick={() => (last ? onClose() : setI(i + 1))}>
              {last ? 'got it →' : 'next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
