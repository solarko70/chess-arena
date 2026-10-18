/**
 * Move classification based on win-probability loss from the mover's perspective.
 *
 * Classes:
 * - 'best'       («лучший»):     move matches engine's best move OR winLoss <= 0.5
 * - 'excellent'  («отличный»):   winLoss < 2
 * - 'good'       («хороший»):    winLoss < 5
 * - 'inaccuracy' («неточность»): winLoss < 10
 * - 'mistake'    («ошибка»):     winLoss < 20
 * - 'blunder'    («зевок»):      winLoss >= 20
 *
 * Note: Opening book moves and brilliant moves are intentionally omitted in step 4c-1.
 */
import type { Color, Move } from '@/core';
import type { AnalysisLine } from '@/ai';
import { povWinChance } from './winchance';

export type MoveClass = 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export const MOVE_CLASS_LABELS: Record<MoveClass, string> = {
  best: 'лучший',
  excellent: 'отличный',
  good: 'хороший',
  inaccuracy: 'неточность',
  mistake: 'ошибка',
  blunder: 'зевок',
};

/**
 * Thresholds for move classification (in percentage points of win-probability).
 * NOTE: These thresholds are approximate and subject to tuning.
 */
export const THRESHOLDS = {
  /** Maximum win-probability loss (<=) to still be classified as 'best' even if not the top PV move */
  bestMaxLoss: 0.5,
  /** Strict upper bound (<) for 'excellent' */
  excellentLoss: 2,
  /** Strict upper bound (<) for 'good' */
  goodLoss: 5,
  /** Strict upper bound (<) for 'inaccuracy' */
  inaccuracyLoss: 10,
  /** Strict upper bound (<) for 'mistake'; >= mistakeLoss is 'blunder' */
  mistakeLoss: 20,
  /** Minimum win-probability gap (>) between 1st and 2nd multiPV lines to mark `onlyMove` */
  onlyMoveGap: 15,
  /** Win probability (<) below which the position is considered already lost (decided) */
  decidedLowWin: 3,
  /** Win probability (>) above which the position is considered already won (decided) */
  decidedHighWin: 97,
} as const;

export interface ClassifyMoveInput {
  /** Win probability [0, 100] from the mover's perspective BEFORE the move */
  winBefore: number;
  /** Win probability [0, 100] from the mover's perspective AFTER the move */
  winAfter: number;
  /** Whether the played move matches the engine's top choice */
  matchedBestMove?: boolean;
  /** Multi-PV lines from the position before the move (optional, used to compute `onlyMove`) */
  linesBefore?: readonly AnalysisLine[];
  /** Side that played the move (optional, used with `linesBefore` to compute `onlyMove`) */
  moverColor?: Color;
  /** Explicit win-probability gap between best and second-best move (optional override) */
  secondBestGap?: number;
}

export interface ClassifyMoveResult {
  moveClass: MoveClass;
  label: string;
  loss: number;
  onlyMove: boolean;
}

const SEVERITY_ORDER: Record<MoveClass, number> = {
  best: 0,
  excellent: 1,
  good: 2,
  inaccuracy: 3,
  mistake: 4,
  blunder: 5,
};

/** Check whether two Move objects represent the same chess move (origin, target, promotion). */
export function isSameMove(a: Move | null | undefined, b: Move | null | undefined): boolean {
  if (!a || !b) return false;
  return a.from === b.from && a.to === b.to && (a.promotion ?? undefined) === (b.promotion ?? undefined);
}

/**
 * Determine whether the best move in `lines` is an "only move" (the gap in
 * mover win probability between the 1st and 2nd multiPV candidate exceeds
 * `THRESHOLDS.onlyMoveGap`).
 */
export function isOnlyMove(lines: readonly AnalysisLine[], moverColor: Color): boolean {
  if (lines.length < 2) return false;
  const firstWin = povWinChance(lines[0].score, moverColor);
  const secondWin = povWinChance(lines[1].score, moverColor);
  return firstWin - secondWin > THRESHOLDS.onlyMoveGap;
}

/**
 * Classify a move based on win-probability before and after the move (from the mover's perspective).
 */
export function classifyMove(input: ClassifyMoveInput): ClassifyMoveResult {
  const loss = Math.max(0, input.winBefore - input.winAfter);

  let rawClass: MoveClass;
  if (input.matchedBestMove || loss <= THRESHOLDS.bestMaxLoss) {
    rawClass = 'best';
  } else if (loss < THRESHOLDS.excellentLoss) {
    rawClass = 'excellent';
  } else if (loss < THRESHOLDS.goodLoss) {
    rawClass = 'good';
  } else if (loss < THRESHOLDS.inaccuracyLoss) {
    rawClass = 'inaccuracy';
  } else if (loss < THRESHOLDS.mistakeLoss) {
    rawClass = 'mistake';
  } else {
    rawClass = 'blunder';
  }

  // In an already decided position (winBefore < 3, or winBefore > 97 unless the win is thrown away below 50%),
  // a move is not classified stricter than 'good'.
  const isAlreadyLost = input.winBefore < THRESHOLDS.decidedLowWin;
  const isAlreadyWon = input.winBefore > THRESHOLDS.decidedHighWin && input.winAfter >= 50;
  let moveClass = rawClass;
  if ((isAlreadyLost || isAlreadyWon) && SEVERITY_ORDER[moveClass] > SEVERITY_ORDER.good) {
    moveClass = 'good';
  }

  let onlyMove = false;
  if (input.secondBestGap !== undefined) {
    onlyMove = input.secondBestGap > THRESHOLDS.onlyMoveGap;
  } else if (input.linesBefore && input.moverColor) {
    onlyMove = isOnlyMove(input.linesBefore, input.moverColor);
  }

  return {
    moveClass,
    label: MOVE_CLASS_LABELS[moveClass],
    loss,
    onlyMove,
  };
}
