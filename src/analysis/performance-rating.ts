/**
 * Performance rating estimation based on move accuracy, game outcome, and error counts.
 * Calibrated against typical player Elo ratings in the range [180, 2900].
 */

import { computeMoveWinChancePenalty } from './winchance';

export interface MovePerformanceInfo {
  winBefore?: number;
  winAfter?: number;
  class?: string;
  color?: 'white' | 'black';
}

export interface PerformanceRatingParams {
  accuracy: number;
  totalMoves: number;
  blunderCount?: number;
  missedCount?: number;
  mistakeCount?: number;
  inaccuracyCount?: number;
  moves?: readonly MovePerformanceInfo[];
  isWin: boolean;
  isDraw: boolean;
}

/**
 * Accuracy to base Elo calibration anchor points (Stage 8f Chess.com CAPS chart).
 * Anchored to official CAPS Projected Rating Estimate with comfortable casual smoothing.
 */
const CALIBRATION: readonly [number, number][] = [
  [0, 180],
  [25, 300],
  [40, 480],
  [50, 600],
  [65, 850],
  [72.0, 1050],
  [76.8, 1250],
  [80.7, 1500],
  [86.2, 1800],
  [88.7, 2000],
  [92.6, 2200],
  [94.5, 2300],
  [96.2, 2400],
  [98.0, 2600],
  [100.0, 2850],
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
    blunderCount = 0,
    missedCount = 0,
    mistakeCount = 0,
    inaccuracyCount = 0,
    moves,
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
  // If move-by-move win-chance data is available, compute dynamic context penalties.
  // Otherwise fall back to count-based penalties with long-game normalization.
  let totalPenalty = 0;
  if (moves && moves.some((m) => m.winBefore !== undefined)) {
    let sumPenalties = 0;
    for (const m of moves) {
      sumPenalties += computeMoveWinChancePenalty(m);
    }
    if (sumPenalties === 0 && (blunderCount > 0 || missedCount > 0 || mistakeCount > 0 || inaccuracyCount > 0)) {
      const rawPenalty =
        blunderCount * BLUNDER_PENALTY +
        missedCount * MISSED_PENALTY +
        mistakeCount * MISTAKE_PENALTY +
        inaccuracyCount * INACCURACY_PENALTY;
      const normalizer = Math.max(1, Math.sqrt(totalMoves / 20));
      totalPenalty = rawPenalty / normalizer;
      if (totalMoves > 20) {
        totalPenalty = Math.min(280, totalPenalty);
      }
    } else {
      const normalizer = Math.max(1, Math.sqrt(totalMoves / 20));
      totalPenalty = sumPenalties / normalizer;
      if (totalMoves > 20) {
        totalPenalty = Math.min(280, totalPenalty);
      }
    }
  } else {
    const rawPenalty =
      blunderCount * BLUNDER_PENALTY +
      missedCount * MISSED_PENALTY +
      mistakeCount * MISTAKE_PENALTY +
      inaccuracyCount * INACCURACY_PENALTY;
    const normalizer = Math.max(1, Math.sqrt(totalMoves / 20));
    totalPenalty = rawPenalty / normalizer;
    if (totalMoves > 20) {
      totalPenalty = Math.min(280, totalPenalty);
    }
  }

  let rating = baseRating - totalPenalty;

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
    moves: readonly {
      color: 'white' | 'black';
      winBefore?: number;
      winAfter?: number;
      class?: string;
    }[];
  },
  side: 'white' | 'black',
  winner: 'white' | 'black' | 'draw' = 'draw',
): number | null {
  const sideMoves = review.moves.filter((m) => m.color === side);
  const accuracy = review.accuracy[side];
  const blunderCount = review.counts[side]?.blunder ?? 0;
  const missedCount = review.counts[side]?.missed ?? 0;
  const mistakeCount = review.counts[side]?.mistake ?? 0;
  const inaccuracyCount = review.counts[side]?.inaccuracy ?? 0;
  const isWin = winner === side;
  const isDraw = winner === 'draw';

  return estimatePerformanceRating({
    accuracy,
    totalMoves: sideMoves.length,
    blunderCount,
    missedCount,
    mistakeCount,
    inaccuracyCount,
    moves: sideMoves,
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

