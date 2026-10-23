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
  inaccuracyCount?: number;
  isWin: boolean;
  isDraw: boolean;
}

/**
 * Accuracy to base Elo calibration anchor points (Stage 8d strict calibration).
 * High accuracy (95%+) requires flawless play to reach 2200-2550+.
 * Intermediate accuracy (90-93%) maps to 1750-1900 Elo.
 */
const CALIBRATION: readonly [number, number][] = [
  [0, 180],
  [25, 300],
  [40, 500],
  [50, 650],
  [58, 760],
  [60, 800],
  [65, 950],
  [70, 1050],
  [75, 1200],
  [80, 1350],
  [85, 1500],
  [90, 1750],
  [93, 1900],
  [95, 2200],
  [98, 2550],
  [100, 2850],
];

export const BLUNDER_PENALTY = 140;
export const MISSED_PENALTY = 110;
export const MISTAKE_PENALTY = 60;
export const INACCURACY_PENALTY = 15;

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
    inaccuracyCount = 0,
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
  // Blunders (-140), missed wins (-110), mistakes (-60), and inaccuracies (-15) penalized explicitly.
  let rating =
    baseRating -
    blunderCount * BLUNDER_PENALTY -
    missedCount * MISSED_PENALTY -
    mistakeCount * MISTAKE_PENALTY -
    inaccuracyCount * INACCURACY_PENALTY;

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
      white: { blunder: number; missed?: number; mistake?: number; inaccuracy?: number };
      black: { blunder: number; missed?: number; mistake?: number; inaccuracy?: number };
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
  const inaccuracyCount = review.counts[side]?.inaccuracy ?? 0;
  const isWin = winner === side;
  const isDraw = winner === 'draw';

  return estimatePerformanceRating({
    accuracy,
    totalMoves: sideMoves,
    blunderCount,
    missedCount,
    mistakeCount,
    inaccuracyCount,
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

