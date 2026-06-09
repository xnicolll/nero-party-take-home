// ============================================================
// NERO PARTY — create party (content on the surface, no hero card)
// Soundwave selectors, host name, less-"AI" pills.
// ============================================================
import { useState } from 'react';
import { LANES } from '../lib/nero';
import type { SongLengthMode } from '../lib/types';
import { Btn, Eyebrow } from './atoms';

export interface CreateConfig {
  name: string;
  hostName: string;
  lane: string;
  maxSongs: number;
  chillsBudget: number;
  songLengthMode: SongLengthMode;
}

// soundwave-style stepped selector
function WaveSelect({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const n = max - min + 1;
  return (
    <div
      className="wavesel"
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
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
  const [mode, setMode] = useState<SongLengthMode>('clip');

  return (
    <div className="create-wrap">
      <button className="back-btn" onClick={onBack}>
        ← back
      </button>
      <div className="create-card rise">
        <Eyebrow>~/new_party · step 1 of 2</Eyebrow>
        <h2 className="create-title">Set the rules</h2>

        <div className="fld-pair">
          <label className="fld">
            <span className="fld-label">party name</span>
            <input
              className="fld-input"
              value={name}
              placeholder="your session name here…"
              onChange={(e) => setName(e.target.value)}
              maxLength={36}
            />
          </label>
          <label className="fld">
            <span className="fld-label">your name (host)</span>
            <input
              className="fld-input"
              value={hostName}
              placeholder="who's hosting?"
              onChange={(e) => setHostName(e.target.value)}
              maxLength={24}
            />
          </label>
        </div>

        <div className="fld">
          <span className="fld-label">
            genre lane <i className="fld-note">— songs compete against equals</i>
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

        <div className="fld">
          <span className="fld-label">
            song length <i className="fld-note">— clip keeps the party moving</i>
          </span>
          <div className="lane-row">
            <button
              className={'lane-chip' + (mode === 'clip' ? ' lane-on' : '')}
              onClick={() => setMode('clip')}
            >
              45s clip
            </button>
            <button
              className={'lane-chip' + (mode === 'full' ? ' lane-on' : '')}
              onClick={() => setMode('full')}
            >
              full track
            </button>
          </div>
        </div>

        <div className="fld-pair">
          <div className="fld">
            <span className="fld-label">
              song limit <b className="fld-val">{maxSongs}</b>
            </span>
            <WaveSelect min={3} max={12} value={maxSongs} onChange={setMaxSongs} />
          </div>
          <div className="fld">
            <span className="fld-label">
              chills tokens <b className="fld-val">{chills} each</b>
            </span>
            <WaveSelect min={1} max={5} value={chills} onChange={setChills} />
            <i className="fld-note">rare on purpose. spending one means something.</i>
          </div>
        </div>

        <div className="create-actions">
          <Btn ghost onClick={onBack}>
            Back
          </Btn>
          <Btn
            big
            disabled={busy}
            onClick={() =>
              onOpen({
                name: name.trim() || 'Untitled Party',
                hostName: hostName.trim() || 'You',
                lane,
                maxSongs,
                chillsBudget: chills,
                songLengthMode: mode,
              })
            }
          >
            {busy ? 'Opening…' : 'Open the lobby'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
