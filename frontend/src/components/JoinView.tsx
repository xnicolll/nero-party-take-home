// ============================================================
// NERO PARTY - join via share link (/j/:code)
// Same paper language as the picker: wordmark, the orange rule,
// the party name big, one input, one button. One screen.
// ============================================================
import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/nero';
import { InkRule } from './ink';
import { Wordmark } from './Wordmark';

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
    <div className="sp-join">
      <header className="sp-pick-top">
        <div className="sp-pick-head">
          <Wordmark owner="nero" />
        </div>
      </header>
      <div className="sp-pick-horizon">
        <InkRule color="var(--sp-neon)" height={18} stroke={2.5} delay={300} />
      </div>

      <main className="sp-join-core">
        {status === 'loading' && <h1 className="sp-join-title sp-dim sp-in">finding the party…</h1>}
        {status === 'missing' && (
          <>
            <h1 className="sp-join-title sp-in">No party here</h1>
            <p className="sp-sub sp-in" style={{ animationDelay: '0.08s' }}>
              that link looks expired or wrong.
            </p>
            <div className="sp-actions sp-in" style={{ animationDelay: '0.16s' }}>
              <button className="sp-btn" onClick={onBail}>
                go home
              </button>
            </div>
          </>
        )}
        {status === 'ok' && party && (
          <>
            <p className="sp-label sp-in">you're invited to</p>
            <h1 className="sp-join-title sp-in" style={{ animationDelay: '0.08s' }}>
              {party.name}
            </h1>
            <p className="sp-sub sp-in" style={{ animationDelay: '0.16s' }}>
              {party.phase === 'coronation'
                ? 'this party has already crowned its winner.'
                : 'the party is live right now. add your name and jump in.'}
            </p>
            {party.phase !== 'coronation' && (
              <>
                <label className="sp-fld sp-join-fld sp-in" style={{ animationDelay: '0.24s' }}>
                  <span className="sp-label">your name</span>
                  <input
                    className="sp-input"
                    value={name}
                    placeholder="who's joining?"
                    maxLength={24}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && join()}
                    autoFocus
                  />
                </label>
                {err && <span className="sp-fld-err">{err}</span>}
                <div className="sp-actions sp-in" style={{ animationDelay: '0.32s' }}>
                  <button className="sp-btn sp-btn-quiet" onClick={onBail}>
                    back
                  </button>
                  <button className="sp-btn sp-btn-solid" disabled={busy} onClick={join}>
                    {busy ? 'joining…' : 'join the party'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
