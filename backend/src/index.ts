import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { env } from './env.js';
import { tracksRouter } from './routes/tracks.js';
import { partiesRouter } from './routes/parties.js';
import { registerSocketHandlers } from './sockets/handlers.js';

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: env.CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
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

server.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});
