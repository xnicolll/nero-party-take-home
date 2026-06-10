import { Router } from 'express';
import { laneToGenre, searchTracks, trending } from '../services/itunes.js';

export const tracksRouter = Router();

// GET /api/tracks/search?q=...
tracksRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ tracks: [] });
  const tracks = await searchTracks(q, 12);
  res.json({ tracks });
});

// GET /api/tracks/trending?lane=Electronic
tracksRouter.get('/trending', async (req, res) => {
  const lane = req.query.lane ? String(req.query.lane) : undefined;
  const tracks = await trending(lane ? laneToGenre(lane) : undefined, 12);
  res.json({ tracks });
});
