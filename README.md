# Nero Party

A listening party where every second counts. Friends join one link, queue real songs, and
react live as they play. Instead of rating a whole song with one number, you tap what you feel at
the exact second it happens (the drop, the bridge, that bit). At the end, the hottest moments
battle 1v1 and one song gets crowned.

> Built on the provided stack (Express + Prisma + Socket.IO, React + Vite + Tailwind, SQLite) with
> real music from **Audius** (no API key needed). It runs great solo: up to 3 simulated guests
> auto-join and react in real time, so you can see the whole thing without rounding up four friends.

## The one big idea

Music happens over time, so judgement should too. A song is not one object you score once. It is a
shape of moments. Nero captures that:

- **Moment reactions.** Five curated reactions (`▲ drop`, `◆ groove`, `● feels`, `✶ wtf`,
  `◎ chills`), keys `1`–`5`. Each tap pins to the exact playback second and builds a heat shape per song.
- **Syncs.** When 3+ people react within ~2 seconds, that is a "sync": worth bonus heat and a visual
  burst. It rewards genuine collective moments, not one person spamming.
- **Scarce chills.** Everyone gets only a few `◎ CHILLS` tokens for the whole party. Scarcity makes
  them mean something.
- **Live F1 leaderboard.** Songs race in real time, ranked by **heat per minute** (normalized so a
  6-minute epic does not auto-beat a 2-minute banger).
- **The finale.** The top heat-moments go head to head in a playoff bracket. The room votes. This
  mixes live energy with pairwise rigor, so the winner feels earned, not just "highest tally".
- **Two crowns + superlatives.** Song of the Night (sustained heat) and Moment of the Night (the
  playoff winner), plus Best Drop / Most Synced / Most Divisive / Slow Burner.

## Getting started

### Prerequisites

- Node.js 18+ (uses the global `fetch`)
- npm

### Install + run

```bash
# 1. Install all dependencies (root installs backend + frontend)
npm install

# 2. Environment (no API keys required — Audius is open)
cp .env.example .env

# 3. Create the SQLite database
cd backend && npx prisma migrate dev && cd ..

# 4. Start both dev servers
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

To stop everything after testing (frees both ports):

```bash
npm run kill   # or: lsof -ti:3000,5173 | xargs kill -9
```

### Try it (solo, ~2 minutes)

1. Open `http://localhost:5173`, scroll the landing to read the six-step ritual, then hit
   **start the party**.
2. Set the rules. Leave **45s clip** on for a quick demo (each song plays a ~45s slice around its
   hottest moment, then advances). Switch to **full track** if you want whole songs.
3. In the lobby, watch three guests orbit in around the central orb. Optionally **＋ queue songs**
   to search Audius and add your own (otherwise the party auto-seeds from trending). Hit **start**.
4. In the party room, music plays. React with the chips or keys `1`–`5`. Watch pins land on the
   waveform, syncs burst, and the leaderboard race. Use **SKIP** / **END PARTY** as host.
5. Vote in the finale, then watch the coronation.

### Try it (real multiplayer)

Copy the invite link from the lobby (or party) and open it in another tab/phone/browser. Enter a
name to join. Queue changes, reactions, the current song + position, the leaderboard, and the
finale all sync live across everyone.

## Architecture

The single most important decision: **the server is the source of truth.** The reaction/heat/sync/
ranking logic and the playback clock all live on the backend, so every device and every bot agrees.
Clients only render and play `<audio>`.

- **Durable vs live state.** SQLite (via Prisma) stores durable facts: party config, participants,
  the queue, an append-only `Reaction` log, and the final `Result`. The hot path (live heat,
  buckets, playback position, the sync window, bot schedules) lives in an in-memory `Room` object,
  one per party. Heat is a projection of the reaction log, kept in memory for speed and snapshotted
  to `Result` at the end.
- **Server-clock playback.** A 150ms tick loop advances position from a server timestamp. On each
  song change the server broadcasts `{ streamUrl, serverTime, positionMs, clipStartMs }`; clients
  seek their `<audio>` to match. A late joiner or a refreshed tab gets a full snapshot and lands on
  the right song and second.
- **Bots.** Up to three guests are real `Participant` rows (with no socket) that flow through the
  exact same reaction path as humans, so they affect heat, syncs, and the leaderboard identically.
  Their reactions are seeded to cluster near song peaks, which is what produces natural syncs.
- **Music: Audius.** Chosen for free, open, full-track streaming with no per-user OAuth (Spotify's
  preview URLs are dead and playback is Premium-gated). The backend proxies search/trending; the
  stream URL plays directly in the browser (Audius serves it with `Access-Control-Allow-Origin: *`).
  Real tracks ship no waveform peaks, so peaks are synthesized deterministically per track id, which
  also drives bot clustering and the clip-start point.

```
backend/src
├── index.ts            # express + socket.io wiring
├── room/               # in-memory state, the tick engine, bots
├── ranking.ts          # heat / sync / results algorithm (authoritative)
├── finale.ts           # playoff bracket
├── services/audius.ts  # music search / trending / stream
├── sockets/            # event handlers + DTO mappers
└── lib/                # seeded prng, waveform, join codes

frontend/src
├── App.tsx             # phase machine (landing → … → coronation)
├── hooks/useRoom.ts    # socket-driven state (replaces the design's local sim)
├── hooks/usePlayback   # one <audio>, server-anchored seek + autoplay gating
├── components/         # every screen + the shared visual atoms
└── index.css           # the design system (warm "after-hours" theme)
```

## Formatting

```bash
npm run cleanup        # format everything with Prettier
npm run cleanup:check  # verify formatting
```

## Tech stack

- **Backend:** Express.js, Prisma, Socket.IO, TypeScript
- **Frontend:** React, Vite, TailwindCSS, TypeScript
- **Database:** SQLite (local, zero setup)
- **Music:** Audius (open API, full-track streaming, no key)

## Notes + tradeoffs

- **Desktop-first.** The layout (leaderboard sidebar, wide party room) is designed for desktop.
- **Best-effort sync.** Clients trust the server clock and seek on song changes; there is no
  sub-second drift correction (audio plays at 1x, so within a song drift is negligible).
- **Audius catalog** skews indie/electronic/underground rather than Top-40, which is part of the
  charm for a demo. Anyone can listen with no account.
