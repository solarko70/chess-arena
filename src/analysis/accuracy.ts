/**
 * Move and game accuracy calculations using the Lichess accuracy formula:
 *
 *   acc = 103.1668 * exp(-0.04354 * winLoss) - 3.1669
 *
 * Clamped to [0, 100], where `winLoss` is the non-negative loss in win
 * probability percentage points from the perspective of the side that moved.
 * Game accuracy for each side is the average of the arithmetic mean and the
 * harmonic mean of that side's move accuracies.
 */

const ACC_SCALE = 103.1668;
const ACC_DECAY = -0.04354;
const ACC_OFFSET = -3.1669;
const HARMONIC_FLOOR = 1e-6;

/**
 * Compute single-move accuracy in [0, 100] from `winLoss` (in percentage points).
 */
export function moveAccuracy(winLoss: number): number {
  if (winLoss <= 0) return 100;
  const raw = ACC_SCALE * Math.exp(ACC_DECAY * winLoss) + ACC_OFFSET;
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

