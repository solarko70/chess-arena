/**
 * Move and game accuracy calculations calibrated to CAPS / Chess.com standard.
 *
 * Move accuracy from win-probability loss (percentage points [0, 100]):
 * - 0% loss: 100%
 * - 3–5% loss (micro-inaccuracy): ~85–90%
 * - 10% loss (inaccuracy): ~65–75%
 * - 20% loss (mistake): ~35–45%
 * - 30%+ loss (blunder): 0–10%
 *
 * Modeled via smooth polynomial decay in exponent:
 *   rate = ACC_BASE_RATE + ACC_QUAD_RATE * winLoss^2
 *   acc = 100 * exp(-rate * winLoss)
 */

export const ACC_BASE_RATE = 0.028;
export const ACC_QUAD_RATE = 0.000055;
const HARMONIC_FLOOR = 1e-6;

/**
 * Compute single-move accuracy in [0, 100] from `winLoss` (in percentage points).
 */
export function moveAccuracy(winLoss: number): number {
  if (winLoss <= 0) return 100;
  const rate = ACC_BASE_RATE + ACC_QUAD_RATE * winLoss * winLoss;
  const raw = 100 * Math.exp(-rate * winLoss);
  return Math.min(100, Math.max(0, raw));
}

/**
 * Compute overall game accuracy for one side as the average of the arithmetic
 * mean and harmonic mean of its move accuracies. Returns 100 if the side made no moves.
 */
export function gameAccuracy(moveAccuracies: readonly number[]): number {
  const n = moveAccuracies.length;
  if (n === 0) return 100;

  let sum = 0;
  let invSum = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.min(100, Math.max(0, moveAccuracies[i]));
    sum += a;
    invSum += 1 / Math.max(HARMONIC_FLOOR, a);
  }

  const arithmeticMean = sum / n;
  const harmonicMean = n / invSum;
  return Math.min(100, Math.max(0, (arithmeticMean + harmonicMean) / 2));
}

