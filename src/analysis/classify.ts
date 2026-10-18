/**
 * Move classification based on win-probability loss from the mover's perspective.
 *
 * Classes:
 * - 'best'       («лучший»):     winLoss <= 0.5 (whether or not it matched the engine's best move)
 * - 'excellent'  («отличный»):   winLoss < 2
 * - 'good'       («хороший»):    winLoss < 5
 * - 'inaccuracy' («неточность»): winLoss < 10
 * - 'mistake'    («ошибка»):     winLoss < 20
 * - 'blunder'    («зевок»):      winLoss >= 20
 *
 * Note: Opening book moves and brilliant moves are intentionally omitted in step 4c-1.
 */
import type { Color, Move } from '@/core';
import type { AnalysisLine, Score } from '@/ai';
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
  /** Maximum win-probability loss (<=) to be classified as 'best' */
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
  /** Whether the move played is a checkmate on the board */
  isCheckmateMove?: boolean;
  /** Engine score before the move (White's perspective, optional) */
  evalBefore?: Score;
  /** Engine score after the move (White's perspective, optional) */
  evalAfter?: Score;
  /** Multi-PV lines from the position before the move (optional, used for `onlyMove` and non-mating alternatives) */
  linesBefore?: readonly AnalysisLine[];
  /** Side that played the move (optional, used with `linesBefore` / `evalAfter`) */
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

/** Check whether `score` (White's perspective) is a forced mate against `moverColor`. */
export function isForcedMateAgainstMover(score: Score | undefined, moverColor: Color | undefined): boolean {
  if (!score || !moverColor || score.type !== 'mate' || score.value === 0) return false;
  return moverColor === 'white' ? score.value < 0 : score.value > 0;
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
 *
 * - A checkmate move is always 'best' with 0 loss.
 * - 'best' is assigned ONLY when `loss <= THRESHOLDS.bestMaxLoss` (even if `matchedBestMove` is true,
 *   a move with loss > `bestMaxLoss` is classified by its loss).
 * - If the move walks into a forced mate against the mover when a non-mating alternative existed
 *   before the move, it can never be 'best' (and is classified by its loss, or at least 'mistake'/'blunder').
 */
export function classifyMove(input: ClassifyMoveInput): ClassifyMoveResult {
  let onlyMove = false;
  if (input.secondBestGap !== undefined) {
    onlyMove = input.secondBestGap > THRESHOLDS.onlyMoveGap;
  } else if (input.linesBefore && input.moverColor) {
    onlyMove = isOnlyMove(input.linesBefore, input.moverColor);
  }

  // Delivering checkmate is always the best move with zero loss
  if (input.isCheckmateMove) {
    return {
      moveClass: 'best',
      label: MOVE_CLASS_LABELS.best,
      loss: 0,
      onlyMove,
    };
  }

  const loss = Math.max(0, input.winBefore - input.winAfter);

  let rawClass: MoveClass;
  if (loss <= THRESHOLDS.bestMaxLoss) {
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

  // Check whether the move walks into a forced mate against the mover while a non-mating defence existed
  const walkedIntoMate = isForcedMateAgainstMover(input.evalAfter, input.moverColor);
  const hadNonMatingReply =
    walkedIntoMate &&
    ((input.evalBefore !== undefined && !isForcedMateAgainstMover(input.evalBefore, input.moverColor)) ||
      (input.linesBefore !== undefined &&
        input.moverColor !== undefined &&
        input.linesBefore.some((l) => !isForcedMateAgainstMover(l.score, input.moverColor))) ||
      input.winBefore >= THRESHOLDS.decidedLowWin);

  // A move leading into a forced mate against the mover can never be 'best'
  if (walkedIntoMate && rawClass === 'best') {
    rawClass = 'excellent';
  }

  // Minimum class 'mistake' applies only if the position before the move was not already decided
  // (winBefore for the mover > 3%); otherwise classify normally by loss.
  const isDecidedLost = input.winBefore <= THRESHOLDS.decidedLowWin;
  if (walkedIntoMate && hadNonMatingReply && !isDecidedLost) {
    if (SEVERITY_ORDER[rawClass] < SEVERITY_ORDER.mistake) {
      rawClass = loss >= THRESHOLDS.mistakeLoss ? 'blunder' : 'mistake';
    }
  }

  // In an already decided position (winBefore < 3, or winBefore > 97 unless the win is thrown away below 50%),
  // a move is not classified stricter than 'good'
  const isAlreadyLost = input.winBefore < THRESHOLDS.decidedLowWin;
  const isAlreadyWon = input.winBefore > THRESHOLDS.decidedHighWin && input.winAfter >= 50;
  let moveClass = rawClass;
  if ((isAlreadyLost || isAlreadyWon) && SEVERITY_ORDER[moveClass] > SEVERITY_ORDER.good) {
    moveClass = 'good';
  }

  return {
    moveClass,
    label: MOVE_CLASS_LABELS[moveClass],
    loss,
    onlyMove,
  };
}
