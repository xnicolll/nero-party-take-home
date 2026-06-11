# nero.party

A listening party where each second counts. Pick an album art off the wall - that IS the setup.
Music plays instantly, friends join mid-song with the link, and instead of rating a whole song
with a number, you stamp emotions onto it the exact second they happen. After, the top moments
battle 1v1 and a song gets crowned.

> Built on the provided stack (Express + Prisma + Socket.IO, React + Vite + Custom CSS, SQLite).
> Real music from **iTunes Search API**, up to 3 simulated guests for demo.

## The one big idea

Music happens over time, so judgement should too. A song is not an object you score once. It's a
shape of moments. Nero Party captures that.

## The design - paper, one ink line, one neon

- **Browsing is paper, the party is neon.** The landing is a calm paper wall of album art drifting
  in genre columns (hover holds a column still). Clicking one floods the page neon orange - paint
  blooming out of the art you picked - and you land in `your.party` with the song already playing.
  No lobby, no forms.
- **One continuous ink line.** It underlines the wordmark, then becomes the song's timeline,
  drawing itself in real time as the song plays. Every reaction is stamped onto it at the second it
  landed. Three people feel the same second? The line does a loop. At the end it draws the winner's
  crown in one stroke.
- **The line is also the data.** On tonight's chart each song is a hand-drawn stroke whose
  thickness is the room's heat, second by second. The boldest line wins the night.
- **Everything else stays quiet** - Author type, a whisper of print grain, jelly buttons that
  squish, album art as the only imagery.

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
- **Instant start** - there is no lobby. Picking an art creates the party and starts playback in
  one click (the click also unlocks audio); bots and friends drop in mid-song.
- **Host view shines on desktop** - guests on phones get a tuned narrow layout (art, line, marks).
- **Best-effort sync** - clients trust the server clock and seek on song change; no sub-second drift correction (1x playback, negligible within a 30s clip).
- **Audio Accessibility** - Could implement in future.
- **Defensive design** - done as best as possible with limited QA, to keep users on the intended flow + scope.
- **Join link** - works locally via the shared link, just not shown in the demo video.

## With more time

- Only one QA pass so far. More time means more polish + refinement.
- Linking music + location integration.
- Motion control or voice commands for hands-free reacting.
