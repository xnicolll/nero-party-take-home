# Nero Party

A listening party app where friends join, add songs, listen together, and crown a winning song.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A music API for search/playback (your choice — see PROMPT.md)

### Installation

```bash
# Install all dependencies
npm install

# Set up environment variables (no API keys required by default)
cp .env.example .env

# Set up the database
cd backend && npx prisma migrate dev && cd ..

# Start the development servers
npm run dev
```

This will start:

- Backend on `http://localhost:3000`
- Frontend on `http://localhost:5173`

## Formatting

```bash
# Format the whole codebase with Prettier
npm run cleanup
```

## Project Structure

```
nero-party/
├── backend/          # Express + Socket.IO server
│   ├── prisma/       # Database schema & migrations
│   └── src/          # Server source code
└── frontend/         # React + Vite client
    └── src/          # Client source code
```

## Tech Stack

- **Backend:** Express.js, Prisma, Socket.IO
- **Frontend:** React, Vite, TailwindCSS
- **Database:** SQLite (local)
- **External API:** Music API of your choice (for song search and playback)
