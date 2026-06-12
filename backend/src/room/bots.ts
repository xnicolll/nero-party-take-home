// ============================================================
// NERO PARTY - bot helpers (pure)
// bots cluster reactions near peaks so real "syncs" happen at the drop.
// the engine owns the join timers + DB writes.
// ============================================================
import { mulberry32 } from '../lib/prng.js';
import type { Peak } from '../lib/waveform.js';
import type { ReactionType } from '../constants.js';
import type { BotScheduleEvent, MomentRuntime } from './state.js';

// Build a per-song schedule (window-space fracs) for the given bots. Bots mostly
// "like", clustering near peaks so genuine "syncs" happen at the drop, and spend
// the occasional scarce "hype". `peaks` are window fractions (0..1).
// `chillsBudget` (the per-bot hype allowance) is mutated as hype is spent.
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
      if (rnd() < 0.72 && peaks.length) {
        const p = peaks[Math.floor(rnd() * peaks.length)];
        t = p.c + (rnd() - 0.5) * p.w * 2.2;
      } else {
        t = 0.08 + rnd() * 0.84;
      }
      let type: ReactionType = 'like';
      if (rnd() < 0.1 && chillsBudget[fid] > 0) {
        type = 'hype';
        chillsBudget[fid]--;
      }
      evts.push({ t: Math.max(0.04, Math.min(0.97, t)), participantId: fid, type });
    }
  });
  evts.sort((a, b) => a.t - b.t);
  return evts;
}

// which side a bot votes, weighted by the two moments' heat. r is a 0..1 random.
export function botVoteSide(pair: [MomentRuntime, MomentRuntime], r: number): 0 | 1 {
  const ha = pair[0].heat;
  const hb = pair[1].heat;
  const pHot = ha / (ha + hb || 1);
  // bias slightly toward the hotter moment but keep it lively
  return r < pHot * 0.7 + 0.15 ? 0 : 1;
}
