// ============================================================
// NERO PARTY - the wordmark
// nero.<word> cycles on the landing like someone typing; on the
// party page it flips, letter by letter, into your.party.
// ============================================================
import { useEffect, useState } from 'react';
import { CYCLE_WORDS } from '../lib/nero';

function CycleWord() {
  const [txt, setTxt] = useState(CYCLE_WORDS[0]);
  useEffect(() => {
    let wi = 0,
      i = CYCLE_WORDS[0].length,
      mode: 'hold' | 'del' | 'type' = 'hold',
      alive = true,
      t: ReturnType<typeof setTimeout>;
    function step() {
      if (!alive) return;
      let delay = 75;
      if (mode === 'hold') {
        mode = 'del';
        delay = 2100;
      } else if (mode === 'del') {
        i -= 1;
        setTxt(CYCLE_WORDS[wi % CYCLE_WORDS.length].slice(0, i));
        delay = 46;
        if (i === 0) {
          wi += 1;
          mode = 'type';
          delay = 360;
        }
      } else {
        const w = CYCLE_WORDS[wi % CYCLE_WORDS.length];
        i += 1;
        setTxt(w.slice(0, i));
        delay = 84;
        if (i === w.length) mode = 'hold';
      }
      t = setTimeout(step, delay);
    }
    t = setTimeout(step, 1600);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);
  return (
    <span className="sp-wordmark-cycle">
      {txt}
      <span className="sp-wordmark-caret" aria-hidden />
    </span>
  );
}

export function Wordmark({ owner }: { owner: 'nero' | 'your' }) {
  return (
    <h1 className="sp-wordmark" aria-label={`${owner}.party`}>
      <span className="sp-wordmark-owner">
        {owner.split('').map((ch, i) => (
          <span
            key={owner + i}
            className="sp-wordmark-letter"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            {ch}
          </span>
        ))}
      </span>
      <span className="sp-wordmark-dot">.</span>
      {owner === 'nero' ? <CycleWord /> : <span className="sp-wordmark-cycle">party</span>}
    </h1>
  );
}
