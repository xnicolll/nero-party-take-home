# Nero Party

A listening party where every second counts. Friends join one link, queue real songs, and
react live as they play. Instead of rating a whole song with one number, you tap what you feel at
the exact second it happens. At the end, the hottest moments battle 1v1 and one song gets crowned.

> Built on the provided stack (Express + Prisma + Socket.IO, React + Vite + Tailwind, SQLite).
> Real music from the **iTunes Search API**, with up to 3 simulated guests so it demos solo.

## The one big idea

Music happens over time, so judgement should too. A song is not one object you score once. It is a
shape of moments. Nero Party captures that:

- **Moment reactions** - five curated taps (drop, groove, feels, wtf, chills) that pin to the exact second.
- **Syncs** - 3+ people within ~2s = bonus heat + a visual burst.
- **Scarce chills** - only a few all night, so spending one means something.
- **Live F1 leaderboard** - songs race in real time on heat.
- **Finale** - top moments go head to head, the room votes.
- **Two crowns + superlatives** - Song of the Night, Moment of the Night, plus Best Drop / Most Synced / etc.

## Getting started

### Prerequisites

- Node.js 18+ (uses the global `fetch`)
- npm

### Install + run

```bash
# 1. Install all dependencies (root installs backend + frontend)
npm install

# 2. Environment (no API keys required - iTunes Search is open)
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

**Server is the source of truth** - heat, ranking, sync, and the playback clock all live on the
backend. Clients just render and play audio.

- **State** - SQLite/Prisma for durable facts (config, participants, queue, reaction log, results); an in-memory `Room` for live state (heat, position, bots).
- **Heat** - a projection of the reaction log, snapshotted to `Result` at the end.
- **Playback** - a 150ms server tick; on each song change it broadcasts `{ streamUrl, serverTime, positionMs }` and clients seek to match. Play/pause/skip are host actions broadcast to everyone.
- **Late joiners** - get a full snapshot and land on the right song + second.
- **Bots** - up to 3 fake participants on the same reaction path as humans, seeded near song peaks to create syncs.
- **Music** - the **iTunes Search API** (huge catalog, no auth). The backend proxies search; the preview URL plays directly in an `<audio>` element (Apple serves it with open CORS + range support).
- **Waveforms** - synthesized deterministically per track id (the API ships none); the same seed drives bot timing.

## Formatting

```bash
npm run cleanup        # format with Prettier
npm run cleanup:check  # verify
```

## Tech stack

- **Backend** - Express, Prisma, Socket.IO, TypeScript
- **Frontend** - React, Vite, Tailwind, TypeScript
- **DB** - SQLite (zero setup)
- **Music** - iTunes Search API (open, no key)

## Notes + tradeoffs

- **30s previews** - the iTunes Search API only serves 30-second preview clips, so every song plays as a 30s preview. That is the tradeoff for a massive, no-auth, no-account catalog: way more songs, shorter clips. The whole app treats the 30s preview as the song.
- **Desktop-first** - built for a wide layout (leaderboard sidebar + party room).
- **Best-effort sync** - clients trust the server clock and seek on song change; no sub-second drift correction (1x playback, negligible within a 30s clip).
