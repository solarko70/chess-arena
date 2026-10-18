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
