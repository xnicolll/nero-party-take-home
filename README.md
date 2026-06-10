# Nero Party

A listening party where every second counts. Friends join one link, queue real songs, and
react live as they play. Instead of rating a whole song with one number, you tap what you feel at
the exact second it happens. At the end, the hottest moments battle 1v1 and one song gets crowned.

> Built on provided stack (Express + Prisma + Socket.IO, React + Vite + Tailwind, SQLite).
> Real music from **Audius** with 3 simulated guests.

## The one big idea

Music happens over time, so judgement should too. A song is not one object you score once. It is a
shape of moments. Nero Party captures that:

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

## Architecture

**Server is the source of truth** — heat, ranking, sync, playback clock all live on the backend. Clients just render + play audio.

- **State** - SQLite/Prisma for durable stuff (config, participants, queue, reaction log, results); in-memory `Room` for live stuff (heat, position, bots)
- **Heat** — projection of the reaction log, snapshotted to `Result` at the end
- **Playback** — 150ms server tick; on song change broadcasts `{ streamUrl, serverTime, positionMs, clipStartMs }`, clients seek to match
- **Late joiners** — get a full snapshot, land on the right song + second
- **Bots** — up to 3 fake participants, same reaction path as humans, seeded near song peaks to create syncs
- **Music** — Audius (free, full tracks, no OAuth); backend proxies search, stream plays direct (CORS open)
- **Waveforms** — synthesized deterministically per track id (Audius ships none); also drives bot timing + clip start

backend/src
├── index.ts            # express + socket.io
├── room/               # in-memory state, tick engine, bots
├── ranking.ts          # heat / sync / results
├── finale.ts           # playoff bracket
├── services/audius.ts  # search / trending / stream
├── sockets/            # handlers + DTO mappers
└── lib/                # prng, waveform, join codes
frontend/src
├── App.tsx             # phase machine
├── hooks/useRoom.ts    # socket-driven state
├── hooks/usePlayback   # one <audio>, server-anchored seek
├── components/         # screens + visual atoms
└── index.css           # design system

## Formatting

```bash
npm run cleanup        # format with Prettier
npm run cleanup:check  # verify
```

## Tech stack

- **Backend** — Express, Prisma, Socket.IO, TS
- **Frontend** — React, Vite, Tailwind, TS
- **DB** — SQLite (zero setup)
- **Music** — Audius (open API, full tracks, no key)

## Notes + tradeoffs

- **Desktop-first** — built for wide layout (sidebar + party room)
- **Best-effort sync** — clients trust server clock, seek on song change; no sub-second drift correction (1x playback, negligible within a song)
- **Audius catalog** — indie/electronic, not Top-40; part of the charm, anyone listens with no account