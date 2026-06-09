import { Router } from 'express';
import { prisma } from '../db.js';
import { getRoomByCode } from '../room/state.js';

export const partiesRouter = Router();

// GET /api/parties/:code — does this party exist + what phase? (share-link landing)
partiesRouter.get('/:code', async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const room = getRoomByCode(code);
  if (room) {
    return res.json({ exists: true, name: room.name, phase: room.phase, joinCode: room.joinCode });
  }
  const party = await prisma.party.findUnique({ where: { joinCode: code } });
  if (!party) return res.status(404).json({ exists: false });
  res.json({ exists: true, name: party.name, phase: party.phase, joinCode: party.joinCode });
});
