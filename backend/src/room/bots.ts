// ============================================================
// NERO PARTY - bot helpers (pure)
// Ported from the design's buildSchedule. Bots cluster reactions near peaks so
// real "syncs" happen at the drop. The engine owns the join timers + DB writes.
// ============================================================
import { mulberry32 } from '../lib/prng.js';
import type { Peak } from '../lib/waveform.js';
import type { ReactionType } from '../constants.js';
import type { BotScheduleEvent, MomentRuntime } from './state.js';

const TYPES: ReactionType[] = ['drop', 'drop', 'groove', 'groove', 'feels', 'wtf'];

// Build a per-song reaction schedule (window-space fracs) for the given bots.
// `peaks` are expressed in window fractions (0..1 over the playable window).
// `chillsBudget` is mutated as scarce chills are spent.
export function buildSchedule(
  seedDur: number,
  peaks: Peak[],
  botIds: string[],
  seedOffset: number,
  chillsBudget: Record<string, number>,
): BotScheduleEvent[] {
  const rnd = mulberry32(seedDur * 131 + seedOffset);
  const evts: BotScheduleEvent[] = [];
  botIds.forEach((fid) => {
    const count = 1 + Math.floor(rnd() * 2); // 1-2 reactions, so humans drive the result
    for (let k = 0; k < count; k++) {
      let t: number;
      let type: ReactionType;
      if (rnd() < 0.72 && peaks.length) {
        const p = peaks[Math.floor(rnd() * peaks.length)];
        t = p.c + (rnd() - 0.5) * p.w * 2.2;
        type = rnd() < 0.5 ? 'drop' : TYPES[Math.floor(rnd() * TYPES.length)];
      } else {
        t = 0.08 + rnd() * 0.84;
        type = TYPES[Math.floor(rnd() * TYPES.length)];
      }
      if (rnd() < 0.1 && chillsBudget[fid] > 0) {
        type = 'chills';
        chillsBudget[fid]--;
      }
      evts.push({ t: Math.max(0.04, Math.min(0.97, t)), participantId: fid, type });
    }
  });
  evts.sort((a, b) => a.t - b.t);
  return evts;
}

// Re-express full-song peaks into a playable window [startFrac, endFrac].
// Peaks outside the window are dropped; survivors are remapped to 0..1.
export function windowPeaks(peaks: Peak[], startFrac: number, endFrac: number): Peak[] {
  const span = Math.max(1e-6, endFrac - startFrac);
  const out: Peak[] = [];
  for (const p of peaks) {
    if (p.c >= startFrac && p.c <= endFrac) {
      out.push({ c: (p.c - startFrac) / span, w: p.w / span });
    }
  }
  // Always give bots something to cluster on.
  if (out.length === 0) out.push({ c: 0.5, w: 0.08 });
  return out;
}

// Which side a bot votes, weighted by the two moments' heat (port of the
// design's fake-vote streaming). `r` is a 0..1 random.
export function botVoteSide(pair: [MomentRuntime, MomentRuntime], r: number): 0 | 1 {
  const ha = pair[0].heat;
  const hb = pair[1].heat;
  const pHot = ha / (ha + hb || 1);
  // bias slightly toward the hotter moment but keep it lively
  return r < pHot * 0.7 + 0.15 ? 0 : 1;
}
