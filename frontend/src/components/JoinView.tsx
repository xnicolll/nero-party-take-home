// ============================================================
// NERO PARTY - join via share link (/j/:code)
// ============================================================
import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/nero';
import { Btn, Eyebrow, StarField } from './atoms';

export function JoinView({
  code,
  onJoin,
  onBail,
}: {
  code: string;
  onJoin: (name: string) => Promise<{ ok: boolean; reason?: string }>;
  onBail: () => void;
}) {
  const [name, setName] = useState('');
  const [party, setParty] = useState<{ name: string; phase: string } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/parties/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!alive) return;
        if (d.exists) {
          setParty({ name: d.name, phase: d.phase });
          setStatus('ok');
        } else setStatus('missing');
      })
      .catch(() => alive && setStatus('missing'));
    return () => {
      alive = false;
    };
  }, [code]);

  const join = async () => {
    setBusy(true);
    setErr(null);
    const r = await onJoin(name.trim() || 'Guest');
    setBusy(false);
    if (!r.ok) setErr(r.reason ?? 'Could not join');
  };

  return (
    <div className="create-wrap">
      <StarField />
      <div className="create-card" style={{ maxWidth: 460, alignItems: 'stretch' }}>
        <Eyebrow>join · {code}</Eyebrow>
        {status === 'loading' && <h2 className="create-title">Finding the party…</h2>}
        {status === 'missing' && (
          <>
            <h2 className="create-title">No party here</h2>
            <p className="hero-sub">That link looks expired or wrong.</p>
            <Btn onClick={onBail}>Go home</Btn>
          </>
        )}
        {status === 'ok' && party && (
          <>
            <h2 className="create-title">{party.name}</h2>
            <p className="hero-sub">
              {party.phase === 'lobby'
                ? 'The lobby is open. Add your name and step in.'
                : party.phase === 'coronation'
                  ? 'This party has already crowned its winner.'
                  : 'The party is live. Jump in.'}
            </p>
            {party.phase !== 'coronation' && (
              <>
                <label className="fld">
                  <span className="fld-label">your name</span>
                  <input
                    className="fld-input"
                    value={name}
                    placeholder="who's joining?"
                    maxLength={24}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && join()}
                    autoFocus
                  />
                </label>
                {err && <span className="lobby-wait mono">{err}</span>}
                <div className="create-actions">
                  <Btn ghost onClick={onBail}>
                    Back
                  </Btn>
                  <Btn big disabled={busy} onClick={join}>
                    {busy ? 'Joining…' : 'Join the party'}
                  </Btn>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
