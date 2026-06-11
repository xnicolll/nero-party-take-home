import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { env } from './env.js';
import { tracksRouter } from './routes/tracks.js';
import { partiesRouter } from './routes/parties.js';
import { registerSocketHandlers } from './sockets/handlers.js';
import { startRoomSweep } from './room/engine.js';

// never let a stray rejection take the whole party server down
process.on('unhandledRejection', (err) => console.error('unhandledRejection', err));
process.on('uncaughtException', (err) => console.error('uncaughtException', err));

const app = express();
const server = createServer(app);

// allow the configured origin plus any localhost port - vite hops to 5174+
// when 5173 is busy, and a CORS-blocked client just looks like a blank wall
const corsOrigin = (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
) => {
  const ok =
    !origin ||
    origin === env.CLIENT_ORIGIN ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  cb(null, ok);
};

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// REST: iTunes proxy + party lookup
app.use('/api/tracks', tracksRouter);
app.use('/api/parties', partiesRouter);

// Real-time: all the live party events
registerSocketHandlers(io);
startRoomSweep(); // drop abandoned rooms + their timers

server.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});
