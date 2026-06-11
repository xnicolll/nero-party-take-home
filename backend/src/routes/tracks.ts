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

// GET /api/tracks/trending?lane=Electronic&limit=30
tracksRouter.get('/trending', async (req, res) => {
  const lane = req.query.lane ? String(req.query.lane) : undefined;
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 12));
  const tracks = await trending(lane ? laneToGenre(lane) : undefined, limit);
  res.json({ tracks });
});
