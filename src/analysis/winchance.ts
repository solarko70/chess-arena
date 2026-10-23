/**
 * Converts a White-perspective Score (centipawns or mate) into White's win
 * probability in percent [0, 100] using the Lichess logistic formula:
 *
 *   win = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
 *
 * Mate scores are mapped to saturated centipawns (±10000 adjusted by mate
 * distance) so that mate in 1 is strictly preferred over mate in 5.
 */
import type { Score } from '@/ai';

export const LICHESS_WIN_MULTIPLIER = -0.00368208;
export const MATE_CP_BASE = 10000;
export const MATE_CP_STEP = 100;

/**
 * Convert a Score (from White's perspective) into a centipawn equivalent
 * with saturation for mates so that faster mates have larger magnitude.
 */
export function scoreToCp(score: Score): number {
  if (score.type === 'cp') {
    return score.value;
  }
  if (score.value === 0) {
    return 0;
  }
  const sign = score.value > 0 ? 1 : -1;
  const distance = Math.abs(score.value);
  // Mate in 1 -> 9900 cp, Mate in 5 -> 9500 cp, clamped above 4000 cp
  const mag = Math.max(4000, MATE_CP_BASE - distance * MATE_CP_STEP);
  return sign * mag;
}

/**
 * Compute White's win probability in percent [0, 100] from centipawns or a Score.
 * When a number is passed, it is treated as centipawns from White's perspective;
 * for mate differentiation where exp() saturates in IEEE-754 float64, passing
 * a `Score` object preserves strict ordering (mate in 1 > mate in 5).
 */
export function winChance(scoreOrCp: number | Score): number {
  const cp = typeof scoreOrCp === 'number' ? scoreOrCp : scoreToCp(scoreOrCp);
  if (cp === 0) return 50;

  const raw = 50 + 50 * (2 / (1 + Math.exp(LICHESS_WIN_MULTIPLIER * cp)) - 1);
  // In IEEE-754 float64, exp(-0.00368208 * cp) underflows to 0 for |cp| >= 4000,
  // making raw equal to 100 or 0. Keep a tiny monotonic offset in the saturated
  // region [4000..10000] so mate in 1 (9900 cp) > mate in 5 (9500 cp) while win(cp) + win(-cp) = 100.
  const absCp = Math.abs(cp);
  if (absCp >= 4000) {
    const gap = Math.max(0, MATE_CP_BASE - absCp);
    const eps = gap * 1e-7;
    return cp > 0 ? 100 - eps : eps;
  }
  return raw;
}

/**
 * Compute win probability in percent [0, 100] from the given side's perspective.
 */
export function povWinChance(scoreOrCp: number | Score, color: 'white' | 'black'): number {
  const whiteWin = winChance(scoreOrCp);
  return color === 'white' ? whiteWin : 100 - whiteWin;
}

/**
 * Computes dynamic Elo penalty for a single move based on win probability impact (Delta WinChance).
 *
 * Rules (Stage 8f):
 * 1. Overwhelming advantage (+15 -> +10, winBefore > 0.95 and winAfter > 0.90, delta < 0.05):
 *    Symbolic penalty in range [5, 15] Elo.
 * 2. Game-deciding blunder (delta >= 0.30):
 *    Full penalty in range [80, 140] Elo.
 * 3. Normal errors (inaccuracy, mistake):
 *    Proportional to deltaWinChance (delta * 180).
 * 4. Best, excellent, stellar, superb, opening moves with delta < 0.05 receive 0 penalty.
 */
export function computeMoveWinChancePenalty(move: {
  winBefore?: number;
  winAfter?: number;
  class?: string;
}): number {
  if (move.winBefore === undefined || move.winAfter === undefined) {
    return 0;
  }
  const wb = move.winBefore > 1 ? move.winBefore / 100 : move.winBefore;
  const wa = move.winAfter > 1 ? move.winAfter / 100 : move.winAfter;
  const delta = Math.max(0, wb - wa);

  const cls = move.class;
  if (cls && ['best', 'excellent', 'stellar', 'superb', 'good', 'opening'].includes(cls) && delta < 0.05) {
    return 0;
  }

  // 1. Blunders in overwhelming winning positions (+15 -> +10)
  if (wb > 0.95 && wa > 0.90) {
    return Math.min(15, Math.max(5, Math.round(delta * 200 + 5)));
  }

  // 2. Game-deciding blunder (delta >= 0.30)
  if (delta >= 0.30) {
    const p = 80 + ((delta - 0.30) / 0.70) * 60;
    return Math.min(140, Math.max(80, Math.round(p)));
  }

  // 3. Normal errors
  return Math.round(delta * 180);
}

/**
 * Compute the virtual win-probability loss (in percentage points [0, 100])
 * when a player prolongs a forced checkmate or drops from forced mate to non-mate.
 *
 * Rules:
 * - If checkmate is delivered on the board (mateInAfter === 0): loss = 0.
 * - If best move delivers mate in 1 (mateInBefore === 1):
 *   - Missed for mate in 2 or 3: virtual loss = 10% (classified as 'good', never 'best'/'excellent').
 *   - Delayed to mate in 4+ or dropped to non-mate: virtual loss = 25% (classified as 'miss').
 * - If best move delivers mate in N <= 3:
 *   - Delayed by 3+ moves (M >= N + 3) or dropped to non-mate: virtual loss = 25% (classified as 'miss').
 *   - Delayed by 1-2 moves: virtual loss = 4-8% (never 'best').
 * - If distant mate (N >= 8) and delayed by <= 1 move: virtual loss = 0 ('best').
 */
export function computeMateProlongationLoss(mateInBefore: number, mateInAfter: number | null): number {
  if (mateInBefore <= 0) return 0;
  // Delivering checkmate on the board is always optimal
  if (mateInAfter === 0) return 0;

  // Case 1: Missed mate in 1
  if (mateInBefore === 1) {
    if (mateInAfter === null || mateInAfter >= 4) {
      return 25.0;
    }
    if (mateInAfter === 2 || mateInAfter === 3) {
      return 10.0;
    }
    return 0;
  }

  // Case 2: Short mate (N <= 3)
  if (mateInBefore <= 3) {
    if (mateInAfter === null || mateInAfter >= mateInBefore + 3) {
      return 25.0;
    }
    if (mateInAfter > mateInBefore) {
      const diff = mateInAfter - mateInBefore;
      return diff === 1 ? 4.0 : 8.0;
    }
    return 0;
  }

  // Case 3: Distant mate (N >= 8) allows 1-move slack
  if (mateInBefore >= 8 && mateInAfter !== null && mateInAfter <= mateInBefore + 1) {
    return 0;
  }

  // Case 4: Mate N >= 4 dropped to non-mate or prolonged
  if (mateInAfter === null) {
    return 20.0;
  }

  if (mateInAfter > mateInBefore) {
    const diff = mateInAfter - mateInBefore;
    return Math.min(20.0, diff * 3.0);
  }

  return 0;
}

