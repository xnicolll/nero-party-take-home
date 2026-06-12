// ============================================================
// NERO PARTY - app shell + phase machine
// The landing IS the start: pick an album art, the paint floods,
// and you're in the party. No lobby. Phases after joining follow
// the server (room.phase); the share link (/j/:code) joins in.
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { loadCreds, useRoom } from './hooks/useRoom';
import { usePlayback } from './hooks/usePlayback';
import type { Track } from './lib/types';
import { Mark } from './components/marks';
import { Modal } from './components/Modal';
import { Landing } from './components/Landing';
import { Flood, type FloodOrigin } from './components/Flood';
import { PartyRoom } from './components/PartyRoom';
import { Playoff } from './components/Playoff';
import { Coronation } from './components/Coronation';
import { GhostTour } from './components/GhostTour';
import { JoinView } from './components/JoinView';

function parseJoinCode(): string | null {
  const m = window.location.pathname.match(/^\/j\/([^/]+)/);
  return m ? decodeURIComponent(m[1]).toUpperCase() : null;
}

export default function App() {
  const room = useRoom();
  // only feed audio while a song is actively playing (stops at skip/intermission/finale)
  const activeCurrent =
    room.phase === 'party' && !room.awaitingMore && !room.skipping ? room.current : null;
  const nextUrl = activeCurrent ? (room.songs[activeCurrent.idx + 1]?.streamUrl ?? null) : null;
  const { needsGesture, prime } = usePlayback(activeCurrent, nextUrl, room.paused);
  const [joinCode, setJoinCode] = useState<string | null>(parseJoinCode());
  const [creating, setCreating] = useState(false);
  const [showTour, setShowTour] = useState(false);
  // the paint transition between picking an art and landing in the party
  const [flood, setFlood] = useState<{ origin: FloodOrigin; art: string | null } | null>(null);
  // true from the moment the flood starts until onReveal fires (when the fade begins),
  // so the screen crossfades IN while the flood fades OUT rather than sequentially
  const [flooding, setFlooding] = useState(false);

  // first party ever: the ghost-ink tour draws itself over the real UI
  useEffect(() => {
    if (room.phase !== 'party') return;
    if (localStorage.getItem('nero-tour-done')) return;
    const t = setTimeout(() => setShowTour(true), 2200);
    return () => clearTimeout(t);
  }, [room.phase]);
  const closeTour = useCallback(() => {
    try {
      localStorage.setItem('nero-tour-done', '1');
    } catch {}
    setShowTour(false);
  }, []);

  // resume an existing party on refresh (rejoin) unless we're on a join link
  useEffect(() => {
    if (!joinCode && loadCreds()) room.actions.resume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a song was skipped -> top-center toast explaining why
  useEffect(() => {
    if (!room.skipEvent) return;
    const { title, reason } = room.skipEvent;
    toast.custom(
      () => (
        <div className="sp-toast">
          <span className="sp-toast-icon">
            <Mark name="skip" size={13} />
          </span>
          <div className="sp-toast-text">
            <b>skipped “{title}”</b>
            <span>{reason}</span>
          </div>
        </div>
      ),
      { duration: 5000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.skipEvent]);

  const goHome = useCallback(() => {
    room.actions.reset();
    window.history.replaceState(null, '', '/');
    setJoinCode(null);
    setFlooding(false);
    setFlood(null);
    window.scrollTo(0, 0);
  }, [room.actions]);

  // explicit "leave the party": confirm, then tell the server + go home
  const [confirmLeave, setConfirmLeave] = useState(false);
  const requestLeave = useCallback(() => setConfirmLeave(true), []);
  const doLeave = useCallback(() => {
    setConfirmLeave(false);
    room.actions.leave();
    goHome();
  }, [room.actions, goHome]);

  // picking an album art IS creating the party - the click unlocks audio,
  // the paint floods from the art, and the room is live underneath it
  const onPick = useCallback(
    async (track: Track, lane: string, rect: DOMRect) => {
      if (creating) return;
      setCreating(true);
      prime();
      setFlooding(true);
      setFlood({
        origin: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        art: track.artworkUrl,
      });
      const r = await room.actions.createParty({
        name: `${track.artist} & friends`.slice(0, 36),
        hostName: 'you',
        lane,
        maxSongs: 20,
        chillsBudget: 3,
        track,
      });
      setCreating(false);
      if (!r?.ok) {
        setFlooding(false);
        setFlood(null);
        toast.custom(() => (
          <div className="sp-toast sp-toast-warn">
            <span className="sp-toast-icon">
              <Mark name="close" size={13} />
            </span>
            <div className="sp-toast-text">
              <b>couldn't start the party</b>
              <span>{r?.reason ?? 'please try again'}</span>
            </div>
          </div>
        ));
      }
    },
    [creating, prime, room.actions],
  );

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
    screen = <Landing onPick={onPick} busy={creating} />;
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
        awaitingMore={room.awaitingMore}
        paused={room.paused}
        onTogglePlay={() =>
          room.paused ? room.actions.resumePlayback() : room.actions.pausePlayback()
        }
        onReact={room.actions.react}
        onSkip={room.actions.skip}
        onPlayNow={room.actions.playNow}
        onEnd={room.actions.end}
        onFinish={room.actions.finish}
        onLeave={requestLeave}
        onHelp={() => setShowTour(true)}
        search={room.actions.searchTracks}
        add={room.actions.addSong}
        onRemove={room.actions.removeSong}
        onDislike={room.actions.dislike}
        disliked={room.disliked}
        dislikeCount={room.dislikeCount}
        dislikeTotal={room.dislikeTotal}
        skipping={room.skipping}
      />
    );
  } else if (room.phase === 'finale' && room.finale) {
    screen = <Playoff finale={room.finale} onVote={room.actions.vote} />;
  } else if (room.phase === 'coronation' && room.results) {
    screen = (
      <Coronation results={room.results} onRestart={goHome} getRecs={room.actions.getRecs} />
    );
  } else {
    // transitional (waiting for the next bit of state)
    screen = <div className="sp-page" />;
  }

  // changes only when the actual screen changes, so the fade plays on navigation
  const screenKey =
    joinCode && !room.joined ? 'join' : !room.joined ? 'landing' : (room.phase ?? 'loading');

  return (
    <>
      {/* the wobble that gives every paper note its hand-drawn inked edge */}
      <svg width="0" height="0" className="sp-filters" aria-hidden focusable="false">
        <filter id="sp-sketch" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="1" seed="7" result="n" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="1.6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
      {/* neon bed under the screen while a party is starting / live, so the
          landing -> party swap under the flood never flashes the cream page */}
      {(flood || room.phase === 'party') && <div className="sp-flood-bg" aria-hidden />}
      <div
        className="screen"
        key={screenKey}
        style={{ opacity: flooding ? 0 : 1 }}
      >
        {screen}
      </div>
      {flood && (
        <Flood
          origin={flood.origin}
          art={flood.art}
          inviteUrl={room.party ? `${window.location.origin}/j/${room.party.joinCode}` : null}
          hostName={room.you?.name ?? 'you'}
          onRename={room.actions.rename}
          onReveal={() => setFlooding(false)}
          onDone={() => setFlood(null)}
        />
      )}
      {showTour && room.phase === 'party' && <GhostTour onClose={closeTour} />}
      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)}>
        <div className="sp-card">
          <h3 className="sp-card-title">Leave the party?</h3>
          <p className="sp-sub">You'll head back home. The party keeps going without you.</p>
          <div className="sp-actions">
            <button className="sp-btn" onClick={() => setConfirmLeave(false)}>
              stay
            </button>
            <button className="sp-btn sp-btn-solid" onClick={doLeave}>
              leave party
            </button>
          </div>
        </div>
      </Modal>
      {needsGesture && room.phase === 'party' && (
        <div className="sp-veil" onClick={prime}>
          <button className="sp-btn sp-btn-solid" onClick={prime}>
            <Mark name="play" size={12} /> tap to listen together
          </button>
        </div>
      )}
      <Toaster
        position="top-center"
        offset={24}
        toastOptions={{
          unstyled: true,
          style: {
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            padding: 0,
            left: '50%',
            transform: 'translateX(-50%)',
          },
        }}
      />
    </>
  );
}
