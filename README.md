# Nero Party

A listening party where each second counts. Friends join with the link, queue songs +
react live. Instead of rating a whole song with a number, you tap emotions
the exact second they happen. After, the top moments battle 1v1 and a song gets crowned.

> Built on the provided stack (Express + Prisma + Socket.IO, React + Vite + Tailwind / Custom CSS, SQLite).
> Real music from **iTunes Search API**, up to 3 simulated guests for demo.

## The one big idea

Music happens over time, so judgement should too. A song is not an object you score once. It's a
shape of moments. Nero Party captures that.

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

- **State** - SQLite/Prisma (config, participants, queue, reaction log, results); an in-memory `Room` for live state (heat, position, bots).
- **Heat** - projection of the reaction log, marked to `Result` at the end.
- **Playback** - 150ms server tick; on each song change it broadcasts `{ streamUrl, serverTime, positionMs }` and clients seek to match. Play/pause/skip are host actions broadcast to everyone.
- **Late joiners** - get a full snapshot and land on right song + second.
- **Bots** - up to 3 fake participants, reactions seeded near song peaks to create syncs.
- **Music** - **iTunes Search API** (huge catalog, no auth). The backend proxies search; the preview URL plays directly in `<audio>` element.
- **Waveforms** - synthesized deterministically per track id (the API ships none); same seed drives bot timing.

## Formatting

```bash
npm run cleanup        # format with Prettier
npm run cleanup:check  # verify
```

## Tech stack

- **Backend** - Express, Prisma, Socket.IO, TypeScript
- **Frontend** - React, Vite, Custom CSS, TypeScript
- **DB** - SQLite (zero setup)
- **Music** - iTunes Search API (open, no key)

## Notes + tradeoffs

- **30s previews** - iTunes Search API only gives 30s preview clips, each track plays as a 30s preview. This is tradeoff for a massive, no-auth, no-account catalog. The whole app treats the 30s preview as the song. As spoke about, decided better option for demo.
- **Desktop-first** - built for a wide layout (leaderboard sidebar + party room). No responsiveness.
- **Best-effort sync** - clients trust the server clock and seek on song change; no sub-second drift correction (1x playback, negligible within a 30s clip).
- **Audio Accessibility** - Could implement in future.
