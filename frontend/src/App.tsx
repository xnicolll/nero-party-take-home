// ============================================================
// NERO PARTY — app shell + phase machine
// landing -> create -> lobby -> party -> finale -> coronation
// Phases after joining follow the server (room.phase); the share link
// (/j/:code) opens the join view.
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { loadCreds, useRoom } from './hooks/useRoom';
import { usePlayback } from './hooks/usePlayback';
import { Grain } from './components/atoms';
import { Landing } from './components/Landing';
import { CreateParty, type CreateConfig } from './components/CreateParty';
import { Lobby } from './components/Lobby';
import { PartyRoom } from './components/PartyRoom';
import { Playoff } from './components/Playoff';
import { Coronation } from './components/Coronation';
import { Tutorial } from './components/Tutorial';
import { JoinView } from './components/JoinView';

function parseJoinCode(): string | null {
  const m = window.location.pathname.match(/^\/j\/([^/]+)/);
  return m ? decodeURIComponent(m[1]).toUpperCase() : null;
}

function ThemeToggle() {
  const [dark, setDark] = useState(
    () => (localStorage.getItem('nero-theme') ?? 'light') === 'dark',
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('nero-theme', dark ? 'dark' : 'light');
  }, [dark]);
  return (
    <button className="theme-toggle" onClick={() => setDark((d) => !d)} title="toggle theme">
      {dark ? '☀' : '☾'}
    </button>
  );
}

export default function App() {
  const room = useRoom();
  const { needsGesture, prime } = usePlayback(room.current);
  const [uiPhase, setUiPhase] = useState<'landing' | 'create'>('landing');
  const [joinCode, setJoinCode] = useState<string | null>(parseJoinCode());
  const [creating, setCreating] = useState(false);
  const [showTut, setShowTut] = useState(false);
  const [tutShown, setTutShown] = useState(false);

  // resume an existing party on refresh (rejoin) unless we're on a join link
  useEffect(() => {
    if (!joinCode && loadCreds()) room.actions.resume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-open the tutorial once when the lobby first appears
  useEffect(() => {
    if (room.phase === 'lobby' && !tutShown) {
      setShowTut(true);
      setTutShown(true);
    }
  }, [room.phase, tutShown]);

  const goHome = useCallback(() => {
    room.actions.reset();
    window.history.replaceState(null, '', '/');
    setJoinCode(null);
    setUiPhase('landing');
  }, [room.actions]);

  const onCreate = useCallback(
    async (cfg: CreateConfig) => {
      setCreating(true);
      const r = await room.actions.createParty(cfg);
      setCreating(false);
      if (!r?.ok) alert(r?.reason ?? 'Could not create party');
    },
    [room.actions],
  );

  const onStart = useCallback(() => {
    prime(); // unlock audio inside the gesture
    room.actions.start();
  }, [prime, room.actions]);

  const onJoin = useCallback(
    async (name: string) => {
      prime();
      return room.actions.joinParty(joinCode!, name);
    },
    [prime, room.actions, joinCode],
  );

  // ---- render ----
  let screen: React.ReactNode;

  if (joinCode && !room.joined) {
    screen = <JoinView code={joinCode} onJoin={onJoin} onBail={goHome} />;
  } else if (!room.joined) {
    screen =
      uiPhase === 'landing' ? (
        <Landing onBegin={() => setUiPhase('create')} />
      ) : (
        <CreateParty onOpen={onCreate} onBack={() => setUiPhase('landing')} busy={creating} />
      );
  } else if (room.phase === 'lobby' && room.party) {
    screen = (
      <Lobby
        party={room.party}
        participants={room.participants}
        songs={room.songs}
        youId={room.you?.participantId ?? ''}
        isHost={room.isHost}
        onStart={onStart}
        onBack={goHome}
        search={room.actions.searchTracks}
        add={room.actions.addSong}
      />
    );
  } else if (room.phase === 'party' && room.party && room.current) {
    screen = (
      <PartyRoom
        party={room.party}
        participants={room.participants}
        songs={room.songs}
        current={room.current}
        liveFrac={room.liveFrac}
        pins={room.pins}
        bursts={room.bursts}
        chillsLeft={room.you?.chillsLeft ?? 0}
        youId={room.you?.participantId ?? ''}
        isHost={room.isHost}
        onReact={room.actions.react}
        onSkip={room.actions.skip}
        onEnd={room.actions.end}
        onHelp={() => setShowTut(true)}
        search={room.actions.searchTracks}
        add={room.actions.addSong}
      />
    );
  } else if (room.phase === 'finale' && room.finale) {
    screen = <Playoff finale={room.finale} onVote={room.actions.vote} />;
  } else if (room.phase === 'coronation' && room.results) {
    screen = <Coronation results={room.results} onRestart={goHome} />;
  } else {
    // transitional (waiting for the next bit of state)
    screen = (
      <div className="create-wrap">
        <div className="orb orb-md" />
      </div>
    );
  }

  const inParty = room.joined && room.phase !== 'lobby';

  return (
    <>
      {screen}
      {showTut && <Tutorial onClose={() => setShowTut(false)} />}
      {needsGesture && room.phase === 'party' && (
        <div className="audio-gate" onClick={prime}>
          <button className="audio-gate-btn" onClick={prime}>
            ▶ tap to listen together
          </button>
        </div>
      )}
      {!inParty && <ThemeToggle />}
      <Grain amount={4} />
    </>
  );
}
