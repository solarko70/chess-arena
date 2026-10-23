/**
 * Performance rating estimation based on move accuracy, game outcome, and error counts.
 * Calibrated against typical player Elo ratings in the range [180, 2900].
 */

export interface PerformanceRatingParams {
  accuracy: number;
  totalMoves: number;
  blunderCount: number;
  missedCount?: number;
  mistakeCount?: number;
  isWin: boolean;
  isDraw: boolean;
}

/**
 * Accuracy to base Elo calibration anchor points.
 */
const CALIBRATION: readonly [number, number][] = [
  [0, 180],
  [25, 360],
  [40, 620],
  [42, 660],
  [50, 800],
  [58, 920],
  [60, 950],
  [70, 1220],
  [75, 1380],
  [80, 1520],
  [85, 1660],
  [87, 1730],
  [90, 1950],
  [92, 2080],
  [93, 2150],
  [95, 2380],
  [98, 2700],
  [100, 2900],
];

export const BLUNDER_PENALTY = 125;
export const MISSED_PENALTY = 100;
export const MISTAKE_PENALTY = 45;

/**
 * Estimates player performance rating for a game.
 * Returns null if the sample size is too small (< 6 moves for the side).
 */
export function estimatePerformanceRating(params: PerformanceRatingParams): number | null {
  const {
    accuracy,
    totalMoves,
    blunderCount,
    missedCount = 0,
    mistakeCount = 0,
    isWin,
  } = params;

  if (totalMoves < 6) {
    return null;
  }

  const clampedAcc = Math.max(0, Math.min(100, isNaN(accuracy) ? 0 : accuracy));

  let baseRating = CALIBRATION[0][1];
  for (let i = 0; i < CALIBRATION.length - 1; i++) {
    const [acc1, elo1] = CALIBRATION[i];
    const [acc2, elo2] = CALIBRATION[i + 1];
    if (clampedAcc >= acc1 && clampedAcc <= acc2) {
      const t = (clampedAcc - acc1) / (acc2 - acc1);
      baseRating = elo1 + t * (elo2 - elo1);
      break;
    }
  }

  // Adjustments:
  // Blunders, missed wins, and mistakes are penalized explicitly.
  let rating =
    baseRating -
    blunderCount * BLUNDER_PENALTY -
    missedCount * MISSED_PENALTY -
    mistakeCount * MISTAKE_PENALTY;

  // - Bonus of 50 points for victory
  if (isWin) {
    rating += 50;
  }

  // Clamping to [180, 2900] (floor 150-200)
  const clampedRating = Math.max(180, Math.min(2900, rating));

  // Round to nearest multiple of 10
  return Math.round(clampedRating / 10) * 10;
}

/**
 * Helper to compute performance rating for a specific color side from a GameReviewResult.
 */
export function getSidePerformanceRating(
  review: {
    accuracy: { white: number; black: number };
    counts: {
      white: { blunder: number; missed?: number; mistake?: number };
      black: { blunder: number; missed?: number; mistake?: number };
    };
    moves: readonly { color: 'white' | 'black' }[];
  },
  side: 'white' | 'black',
  winner: 'white' | 'black' | 'draw' = 'draw',
): number | null {
  const sideMoves = review.moves.filter((m) => m.color === side).length;
  const accuracy = review.accuracy[side];
  const blunderCount = review.counts[side]?.blunder ?? 0;
  const missedCount = review.counts[side]?.missed ?? 0;
  const mistakeCount = review.counts[side]?.mistake ?? 0;
  const isWin = winner === side;
  const isDraw = winner === 'draw';

  return estimatePerformanceRating({
    accuracy,
    totalMoves: sideMoves,
    blunderCount,
    missedCount,
    mistakeCount,
    isWin,
    isDraw,
  });
}

/**
 * Formats performance rating as a string (e.g. "~1850" or "мало ходов").
 */
export function formatPerformanceRating(rating: number | null): string {
  if (rating === null) {
    return 'мало ходов';
  }
  return `~${rating}`;
}

