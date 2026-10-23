/**
 * Performance rating estimation based on move accuracy, game outcome, and blunder count.
 * Calibrated against typical player Elo ratings in the range [350, 2900].
 */

export interface PerformanceRatingParams {
  accuracy: number;
  totalMoves: number;
  blunderCount: number;
  missedCount?: number;
  isWin: boolean;
  isDraw: boolean;
}

/**
 * Accuracy to base Elo calibration anchor points.
 */
const CALIBRATION: readonly [number, number][] = [
  [0, 350],
  [25, 430],
  [40, 620],
  [42, 660],
  [58, 920],
  [60, 960],
  [75, 1380],
  [85, 1850],
  [90, 2200],
  [92, 2375],
  [98, 2800],
  [100, 2900],
];

/**
 * Estimates player performance rating for a game.
 * Returns null if the sample size is too small (< 6 moves for the side).
 */
export function estimatePerformanceRating(params: PerformanceRatingParams): number | null {
  const { accuracy, totalMoves, blunderCount, missedCount = 0, isWin } = params;

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
  // Blunders and missed wins are mutually exclusive review classes.
  // Penalize both explicitly, including missed wins that are absent from blunderCount.
  let rating = baseRating - blunderCount * 80 - missedCount * 100;

  // - Bonus of 50 points for victory
  if (isWin) {
    rating += 50;
  }

  // Clamping to [350, 2900]
  const clampedRating = Math.max(350, Math.min(2900, rating));

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
      white: { blunder: number; missed?: number };
      black: { blunder: number; missed?: number };
    };
    moves: readonly { color: 'white' | 'black' }[];
  },
  side: 'white' | 'black',
  winner: 'white' | 'black' | 'draw' = 'draw',
): number | null {
  const sideMoves = review.moves.filter((m) => m.color === side).length;
  const accuracy = review.accuracy[side];
  const blunderCount = review.counts[side]?.blunder ?? 0;
  const isWin = winner === side;
  const isDraw = winner === 'draw';

  return estimatePerformanceRating({
    accuracy,
    totalMoves: sideMoves,
    blunderCount,
    missedCount: review.counts[side]?.missed ?? 0,
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

