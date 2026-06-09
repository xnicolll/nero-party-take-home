// ============================================================
// NERO PARTY — create party (ported from nero-lobby.jsx) + song-length toggle
// ============================================================
import { useState } from 'react';
import { LANES } from '../lib/nero';
import type { SongLengthMode } from '../lib/types';
import { Btn, Eyebrow } from './atoms';

export interface CreateConfig {
  name: string;
  lane: string;
  maxSongs: number;
  chillsBudget: number;
  songLengthMode: SongLengthMode;
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
  const [name, setName] = useState('Tuesday After Hours');
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

        <label className="fld">
          <span className="fld-label">party name</span>
          <input
            className="fld-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={36}
          />
        </label>

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
          <label className="fld">
            <span className="fld-label">
              song limit <b className="fld-val">{maxSongs}</b>
            </span>
            <input
              type="range"
              min={3}
              max={12}
              value={maxSongs}
              onChange={(e) => setMaxSongs(+e.target.value)}
              className="fld-range"
            />
          </label>
          <label className="fld">
            <span className="fld-label">
              chills tokens <b className="fld-val">{chills} each</b>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              value={chills}
              onChange={(e) => setChills(+e.target.value)}
              className="fld-range"
            />
            <i className="fld-note">rare on purpose. spending one means something.</i>
          </label>
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
                name: name || 'Untitled Party',
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
