// ============================================================
// NERO PARTY - landing: one path. scroll -> learn -> start.
// Ported from the design's nero-lobby.jsx (StarField/FilmStrip/CycleWord).
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { CYCLE_WORDS, REACTION_ORDER } from '../lib/nero';
import { Btn, Eyebrow, HeatShape, RGlyph, StarField } from './atoms';

const STRIP_STEPS = [
  {
    n: '01 · start',
    t: 'Start a party.',
    d: 'Pick the rules. Share one link. Friends join. No accounts.',
  },
  {
    n: '02 · queue',
    t: 'One queue. Everyone adds.',
    d: 'Everyone hears the same song at the same time.',
  },
  {
    n: '03 · react',
    t: 'Tap what emotion you feel.',
    d: 'When you feel it. Your tap sticks to that exact second.',
  },
  {
    n: '04 · sync',
    t: 'Feel it together.',
    d: '3 people tap within 2 seconds? That moment scores highly.',
  },
  {
    n: '05 · chills',
    t: 'Chills are rare.',
    d: 'You only get a few in each party. Worth 3×. Save them for goosebumps.',
  },
  {
    n: '06 · crown',
    t: 'One song wins.',
    d: 'Songs race on a live board. Best moments battle 1v1. Then the crown.',
  },
];
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
        delay = 1900;
      } else if (mode === 'del') {
        i -= 1;
        setTxt(CYCLE_WORDS[wi % CYCLE_WORDS.length].slice(0, i));
        delay = 48;
        if (i === 0) {
          wi += 1;
          mode = 'type';
          delay = 380;
        }
      } else {
        const w = CYCLE_WORDS[wi % CYCLE_WORDS.length];
        i += 1;
        setTxt(w.slice(0, i));
        delay = 82;
        if (i === w.length) mode = 'hold';
      }
      t = setTimeout(step, delay);
    }
    t = setTimeout(step, 1400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);
  return <em>{txt}</em>;
}

function StripDemo({ i }: { i: number }) {
  // cards 2 and 4 carry no icon (cleaner, less "AI")
  if (i === 2)
    return (
      <>
        {REACTION_ORDER.map((r) => (
          <RGlyph key={r} type={r} size={13} />
        ))}
      </>
    );
  if (i === 4) return <RGlyph type="chills" size={16} />;
  if (i === 5) return <HeatShape buckets={[1, 3, 2, 6, 9, 4, 2, 5, 11, 6, 3, 1]} w={90} h={22} />;
  if (i === 0) return <span className="orb" style={{ width: 16, height: 16 }} />;
  return null;
}

function FilmStrip() {
  const outer = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [prog, setProg] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = outer.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / total));
      setProg(p);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const shift = () => {
    const t = track.current;
    if (!t) return 0;
    return Math.max(0, t.scrollWidth - window.innerWidth);
  };
  const stepNo = Math.min(STRIP_STEPS.length, 1 + Math.floor(prog * STRIP_STEPS.length));
  return (
    <section ref={outer} id="how" className="strip-outer" style={{ height: '380vh' }}>
      <div className="strip-sticky">
        <div className="strip-head">
          <Eyebrow>how it works</Eyebrow>
          <div className="strip-rule">
            <span style={{ width: prog * 100 + '%' }} />
          </div>
          <span className="strip-count">
            {String(stepNo).padStart(2, '0')} / {String(STRIP_STEPS.length).padStart(2, '0')}
          </span>
        </div>
        <div
          ref={track}
          className="strip-track"
          style={{ transform: `translate3d(${-prog * shift()}px,0,0)` }}
        >
          {STRIP_STEPS.map((s, i) => (
            <article key={i} className="strip-card">
              <div className="strip-num">{s.n}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
              <div className="strip-demo">
                <StripDemo i={i} />
              </div>
            </article>
          ))}
          <div className="strip-endcap">
            <div className="orb orb-sm" />
          </div>
        </div>
      </div>
    </section>
  );
}

// vertical SVG spine on the left that draws as you scroll
function ScrollSpine({ prog }: { prog: number }) {
  const y = prog * 1000;
  return (
    <div className="scroll-spine">
      <svg width="14" height="100%" viewBox="0 0 14 1000" preserveAspectRatio="none">
        <line
          className="spine-track"
          x1="7"
          y1="0"
          x2="7"
          y2="1000"
          vectorEffect="non-scaling-stroke"
        />
        <line
          className="spine-fill"
          x1="7"
          y1="0"
          x2="7"
          y2={y}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="spine-node" style={{ top: prog * 100 + '%' }} />
    </div>
  );
}

export function Landing({ onBegin }: { onBegin: () => void }) {
  const [prog, setProg] = useState(0); // full-page scroll progress (spine)
  const [navP, setNavP] = useState(0); // hero progress (nav swoop)

  useEffect(() => {
    const onScroll = () => {
      const max = document.body.scrollHeight - window.innerHeight;
      setProg(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      setNavP(Math.min(1, window.scrollY / (window.innerHeight * 0.6)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toHow = () => {
    const el = document.getElementById('how');
    if (el) window.scrollTo({ top: el.offsetTop + 10, behavior: 'smooth' });
  };

  // nav swoops from center-top down-left to dock beside the spine
  const navShiftX = navP * (typeof window !== 'undefined' ? window.innerWidth / 2 - 150 : 300);
  const navStyle = {
    transform: `translateX(-50%) translate(${-navShiftX}px, ${navP * 4}px) scale(${1 - 0.08 * navP})`,
    boxShadow: navP > 0.5 ? '0 10px 34px rgba(30,25,19,0.14)' : undefined,
  };

  return (
    <div className="landing">
      <StarField />
      <ScrollSpine prog={prog} />
      <div className="spine-mask" />
      <nav className="pillnav swoop" style={navStyle}>
        <span className="pillnav-brand">
          <span className="pillnav-dot" />
          nero party
        </span>
        <div className="pillnav-links">
          <button className="pillnav-link" onClick={toHow}>
            how it works
          </button>
        </div>
        <button
          className="pillnav-link pillnav-cue"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          {navP > 0.5 ? '↑ top' : 'scroll ↓'}
        </button>
      </nav>
      <header className="hero">
        <div className="hero-path">
          throw a listening party<b>…</b>
        </div>
        <h1 className="hero-title">
          nero <CycleWord />
          <span className="cursor">▮</span>
        </h1>
        <p className="hero-sub">
          queue songs with friends, react the moment you feel it. one track gets crowned winner.
        </p>
        <div className="hero-scroll">
          <b>scroll to learn the ritual</b> ↓
        </div>
      </header>
      <FilmStrip />
      <section className="land-final">
        <div className="orb orb-md" />
        <h2 className="land-final-title">that's everything. ready?</h2>
        <Btn big onClick={onBegin}>
          start the party
        </Btn>
      </section>
    </div>
  );
}
