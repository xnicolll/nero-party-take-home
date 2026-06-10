// ============================================================
// NERO PARTY - create party. Progressive reveal: names first, then genre,
// then song limit + chills, each easing in once the previous is done.
// ============================================================
import { useEffect, useState } from 'react';
import { LANES } from '../lib/nero';
import { Btn, Eyebrow } from './atoms';

export interface CreateConfig {
  name: string;
  hostName: string;
  lane: string;
  maxSongs: number;
  chillsBudget: number;
}

// soundwave-style stepped selector (keyboard-operable slider)
function WaveSelect({
  min,
  max,
  value,
  onChange,
  label,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const n = max - min + 1;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(max, value + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(min, value - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(max);
    }
  };
  return (
    <div
      className="wavesel"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onKeyDown={onKey}
    >
      {Array.from({ length: n }, (_, k) => {
        const v = min + k;
        const h = 38 + 56 * Math.abs(Math.sin((k + 1) * 1.27)); // organic wave heights
        return (
          <div
            key={v}
            className={'wavesel-bar' + (v <= value ? ' on' : '')}
            style={{ height: h + '%' }}
            onClick={() => onChange(v)}
            title={String(v)}
          />
        );
      })}
    </div>
  );
}

export function CreateParty({
  onOpen,
  onBack,
  busy,
}: {
  onOpen: (c: CreateConfig) => void;
  onBack: () => void;
  busy?: boolean;
}) {
  const [name, setName] = useState('');
  const [hostName, setHostName] = useState('');
  const [lane, setLane] = useState('Anything goes');
  const [maxSongs, setMaxSongs] = useState(5);
  const [chills, setChills] = useState(3);
  const [touched, setTouched] = useState(false);

  const namesDone = name.trim().length > 0 && hostName.trim().length > 0;
  const nameErr = touched && !name.trim();
  const hostErr = touched && !hostName.trim();

  // keep the rest mounted through its exit animation when names are cleared
  const [renderRest, setRenderRest] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (namesDone) {
      setRenderRest(true);
      setClosing(false);
    } else if (renderRest) {
      setClosing(true);
      const t = setTimeout(() => setRenderRest(false), 360);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesDone]);

  return (
    <div className="create-wrap">
      <button className="back-btn" onClick={onBack}>
        ← back
      </button>
      <div className="create-card rise">
        <Eyebrow>new party</Eyebrow>
        <h2 className="create-title">Set the rules</h2>

        <div className="fld-pair">
          <label className="fld">
            <span className="fld-label">party name</span>
            <input
              className={'fld-input' + (nameErr ? ' fld-err' : '')}
              value={name}
              placeholder="your session name here…"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={36}
            />
            {nameErr && <span className="fld-reminder">give your party a name to continue</span>}
          </label>
          <label className="fld">
            <span className="fld-label">your name (host)</span>
            <input
              className={'fld-input' + (hostErr ? ' fld-err' : '')}
              value={hostName}
              placeholder="who's hosting?"
              onChange={(e) => setHostName(e.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={24}
            />
            {hostErr && <span className="fld-reminder">add your name so guests know the host</span>}
          </label>
        </div>

        {!namesDone && (
          <p className="create-hint mono">enter both names to set the rest of the rules ↓</p>
        )}

        {renderRest && (
          <>
            <div
              className={'fld fld-reveal' + (closing ? ' closing' : '')}
              style={{ animationDelay: closing ? '0s' : '0s' }}
            >
              <span className="fld-label">
                genre lane <i className="fld-note">· songs compete against equals</i>
              </span>
              <div className="lane-row">
                {LANES.map((l) => (
                  <button
                    key={l}
                    className={'lane-chip' + (l === lane ? ' lane-on' : '')}
                    onClick={() => setLane(l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={'fld-pair fld-reveal' + (closing ? ' closing' : '')}
              style={{ animationDelay: closing ? '0s' : '0.13s' }}
            >
              <div className="fld">
                <span className="fld-label">
                  song limit <b className="fld-val">{maxSongs}</b>
                </span>
                <WaveSelect
                  min={3}
                  max={12}
                  value={maxSongs}
                  onChange={setMaxSongs}
                  label="Song limit"
                />
              </div>
              <div className="fld">
                <span className="fld-label">
                  chills tokens <b className="fld-val">{chills} each</b>
                </span>
                <WaveSelect
                  min={1}
                  max={5}
                  value={chills}
                  onChange={setChills}
                  label="Chills tokens per person"
                />
                <i className="fld-note">rare on purpose. spending one means something.</i>
              </div>
            </div>

            <div
              className={'create-actions fld-reveal' + (closing ? ' closing' : '')}
              style={{ animationDelay: closing ? '0s' : '0.26s' }}
            >
              <Btn
                big
                disabled={busy}
                onClick={() =>
                  onOpen({
                    name: name.trim(),
                    hostName: hostName.trim(),
                    lane,
                    maxSongs,
                    chillsBudget: chills,
                  })
                }
              >
                {busy ? 'Opening…' : 'Open the lobby'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
