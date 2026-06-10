// ============================================================
// NERO PARTY - finale playoff state machine
// Port of nero-finale.jsx's bracket logic. Top heat-moments battle 1v1;
// humans vote via castVote, bots vote on a stagger; majority advances.
// Engine owns timers + crowning; this file owns the pure transitions.
// ============================================================
import type { FinaleRuntime, MomentRuntime, Room } from './room/state.js';

// [[m0,m3],[m1,m2]] semis then a final; or a single match; or none.
export function buildBracket(moments: MomentRuntime[]): [MomentRuntime, MomentRuntime][] {
  if (moments.length >= 4) {
    return [
      [moments[0], moments[3]],
      [moments[1], moments[2]],
    ];
  }
  if (moments.length >= 2) return [[moments[0], moments[1]]];
  return [];
}

export function activePair(finale: FinaleRuntime): [MomentRuntime, MomentRuntime] | null {
  if (finale.stage === 'final') {
    return finale.finalists.length >= 2 ? [finale.finalists[0], finale.finalists[1]] : null;
  }
  return finale.bracket[finale.round] ?? null;
}

export function recordVote(finale: FinaleRuntime, participantId: string, side: 0 | 1): void {
  if (finale.decided !== null) return;
  finale.votes.set(participantId, side);
}

export function tally(finale: FinaleRuntime): [number, number] {
  let a = 0;
  let b = 0;
  for (const side of finale.votes.values()) side === 0 ? a++ : b++;
  return [a, b];
}

// How many voters we expect: every bot + every connected human.
export function expectedVoters(room: Room): number {
  let n = 0;
  for (const p of room.participants.values()) if (p.isBot || p.connected) n++;
  return n;
}

// Decide the winning side. Tie breaks toward higher moment heat (objective).
export function decideSide(finale: FinaleRuntime): 0 | 1 {
  const pair = activePair(finale);
  const [a, b] = tally(finale);
  if (a !== b) return a > b ? 0 : 1;
  if (pair) return pair[0].heat >= pair[1].heat ? 0 : 1;
  return 0;
}

// Advance the bracket after a match is decided. Returns the crowned moment when
// the playoff is over (engine then runs the coronation), else null.
export function advance(finale: FinaleRuntime): { crowned: MomentRuntime | null } {
  const pair = activePair(finale);
  if (!pair || finale.decided === null) return { crowned: null };
  const winner = pair[finale.decided];

  if (finale.stage === 'semi') {
    finale.finalists.push(winner);
    if (finale.round + 1 < finale.bracket.length) {
      finale.round += 1;
    } else if (finale.finalists.length >= 2) {
      finale.stage = 'final';
    } else {
      finale.stage = 'done';
      return { crowned: winner };
    }
    finale.votes = new Map();
    finale.decided = null;
    return { crowned: null };
  }

  // final
  finale.stage = 'done';
  return { crowned: winner };
}
