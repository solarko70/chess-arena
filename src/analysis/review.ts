/**
 * Full-game review logic (`reviewGame`):
 * Evaluates each of the (n + 1) positions of a game exactly once, computes
 * win probabilities, move accuracies, move classifications, side accuracies,
 * class counts, key moments, and evaluation graph series.
 */
import type { Color, GameState, Move } from '@/core';
import { moveToSAN, undoMove } from '@/core';
import type { AnalysisResult, Score } from '@/ai';
import {
  createEngine,
  type AnalysisEngine,
  type AnalysisEngineResult,
} from './engine';
import { povWinChance, scoreToCp, winChance } from './winchance';
import { gameAccuracy, moveAccuracy } from './accuracy';
import { classifyMove, isSameMove, type MoveClass } from './classify';

export const DEFAULT_STOCKFISH_DEPTH = 14;
export const DEFAULT_OWN_ENGINE_DEPTH = 6;

export interface ReviewedMove {
  /** 1-based half-move (ply) index */
  ply: number;
  /** SAN notation of the move played */
  san: string;
  /** Side that played the move */
  color: Color;
  /** Played move object */
  move: Move;
  /** Engine evaluation before the move (White's perspective) */
  evalBefore: Score;
  /** Engine evaluation after the move (White's perspective) */
  evalAfter: Score;
  /** Best move found by the engine before the move */
  bestMove: Move | null;
  /** SAN of the engine's best move before the move */
  bestSan: string | null;
  /** Mover's win probability [0, 100] before the move */
  winBefore: number;
  /** Mover's win probability [0, 100] after the move */
  winAfter: number;
  /** Non-negative win-probability loss in percentage points (mover's perspective) */
  loss: number;
  /** Single-move accuracy in [0, 100] */
  accuracy: number;
  /** Move classification */
  class: MoveClass;
  /** True if the best move was the only good move (1st vs 2nd multiPV gap > 15%) */
  onlyMove: boolean;
}

export type MoveClassCounts = Record<MoveClass, number>;

export interface EvalPoint {
  /** 0 = initial position, 1..n = after each ply */
  ply: number;
  /** Raw Score from White's perspective */
  score: Score;
  /** Centipawn equivalent from White's perspective (saturated for mates) */
  cp: number;
  /** White's win probability [0, 100] */
  whiteWinChance: number;
}

export interface ReviewProgress {
  /** Number of positions analyzed so far (1..totalPositions) */
  completed: number;
  /** Total number of positions to analyze (n + 1) */
  total: number;
  /** Current 0-based position index that just finished */
  ply: number;
}

export interface ReviewOptions {
  /** Search depth (defaults to 14 for Stockfish, 6 for OwnEngine) */
  depth?: number;
  /** Multi-PV lines to request per position (defaults to 2 for `onlyMove` detection) */
  multiPV?: number;
  /** Progress callback invoked after each position is analyzed */
  onProgress?: (progress: ReviewProgress) => void;
  /** AbortSignal to cancel an ongoing review */
  signal?: AbortSignal;
}

export interface GameReviewResult {
  /** Reviewed moves (length = n) */
  moves: ReviewedMove[];
  /** Overall accuracy [0, 100] for White and Black */
  accuracy: {
    white: number;
    black: number;
  };
  /** Count of moves in each class for White and Black */
  counts: {
    white: MoveClassCounts;
    black: MoveClassCounts;
  };
  /** Key moments (inaccuracies, mistakes, blunders, or critical `onlyMove` turns) */
  keyMoments: ReviewedMove[];
  /** Evaluation series across all (n + 1) positions for plotting */
  evalHistory: EvalPoint[];
  /** Name of the engine that produced the review */
  engineName: string;
}

export type GameInput = GameState | readonly GameState[];

function emptyClassCounts(): MoveClassCounts {
  return {
    best: 0,
    excellent: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  };
}

function createAbortError(): Error {
  const err = new Error('Game review aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * Reconstruct the sequence of (n + 1) states from the initial position to the
 * final position using `undoMove`.
 */
export function reconstructGameStates(game: GameInput): GameState[] {
  if (Array.isArray(game)) {
    return game.slice();
  }
  const finalState = game as GameState;
  const states: GameState[] = [finalState];
  let cur = finalState;
  while (cur.history.length > 0) {
    cur = undoMove(cur);
    states.push(cur);
  }
  states.reverse();
  return states;
}

/**
 * Review a completed or ongoing game by analyzing each of its (n + 1) positions once.
 */
export async function reviewGame(
  game: GameInput,
  engine?: AnalysisEngine,
  options: ReviewOptions = {},
): Promise<GameReviewResult> {
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  const states = reconstructGameStates(game);
  const totalPositions = states.length;
  const ownCreated = !engine;
  const activeEngine = engine ?? createEngine(states[0]);

  try {
    const positionResults: (AnalysisResult & { engineName?: string })[] = [];
    let resolvedEngineName = activeEngine.name;

    for (let i = 0; i < totalPositions; i++) {
      if (options.signal?.aborted) {
        throw createAbortError();
      }

      // Determine default depth dynamically based on the active engine (14 for Stockfish, 6 for OwnEngine)
      const currentEngineName = activeEngine.name.toLowerCase();
      const defaultDepth = currentEngineName.includes('stockfish')
        ? DEFAULT_STOCKFISH_DEPTH
        : DEFAULT_OWN_ENGINE_DEPTH;
      const depth = options.depth ?? defaultDepth;
      const multiPV = options.multiPV ?? 2;

      const res: AnalysisEngineResult = await activeEngine.analyze(states[i], {
        depth,
        multiPV,
        signal: options.signal,
      });

      if (options.signal?.aborted) {
        throw createAbortError();
      }

      if (res.engineName) {
        resolvedEngineName = res.engineName;
      }
      positionResults.push(res);

      options.onProgress?.({
        completed: i + 1,
        total: totalPositions,
        ply: i,
      });
    }

    const evalHistory: EvalPoint[] = positionResults.map((res, idx) => ({
      ply: idx,
      score: res.score,
      cp: scoreToCp(res.score),
      whiteWinChance: winChance(res.score),
    }));

    const moves: ReviewedMove[] = [];
    const whiteAccuracies: number[] = [];
    const blackAccuracies: number[] = [];
    const counts = {
      white: emptyClassCounts(),
      black: emptyClassCounts(),
    };
    const keyMoments: ReviewedMove[] = [];

    for (let i = 0; i < totalPositions - 1; i++) {
      const stateBefore = states[i];
      const stateAfter = states[i + 1];
      const playedMove = stateAfter.history[stateAfter.history.length - 1];
      const moverColor = stateBefore.turn;
      const san = moveToSAN(stateBefore, playedMove);

      const resBefore = positionResults[i];
      const resAfter = positionResults[i + 1];

      const evalBefore = resBefore.score;
      const evalAfter = resAfter.score;

      const bestMove = resBefore.bestMove;
      const bestSan =
        resBefore.lines[0]?.san ?? (bestMove ? moveToSAN(stateBefore, bestMove) : null);

      const winBefore = povWinChance(evalBefore, moverColor);
      const winAfter = povWinChance(evalAfter, moverColor);

      const matchedBestMove =
        isSameMove(playedMove, bestMove) ||
        (bestSan !== null && san === bestSan) ||
        (evalAfter.type === 'mate' && evalAfter.value === 0);

      const classification = classifyMove({
        winBefore,
        winAfter,
        matchedBestMove,
        linesBefore: resBefore.lines,
        moverColor,
      });

      const loss = matchedBestMove ? 0 : classification.loss;
      const acc = moveAccuracy(loss);

      const reviewedMove: ReviewedMove = {
        ply: i + 1,
        san,
        color: moverColor,
        move: playedMove,
        evalBefore,
        evalAfter,
        bestMove,
        bestSan,
        winBefore,
        winAfter,
        loss,
        accuracy: acc,
        class: classification.moveClass,
        onlyMove: classification.onlyMove,
      };

      moves.push(reviewedMove);
      counts[moverColor][classification.moveClass]++;

      if (moverColor === 'white') {
        whiteAccuracies.push(acc);
      } else {
        blackAccuracies.push(acc);
      }

      if (
        classification.moveClass === 'inaccuracy' ||
        classification.moveClass === 'mistake' ||
        classification.moveClass === 'blunder' ||
        classification.onlyMove
      ) {
        keyMoments.push(reviewedMove);
      }
    }

    return {
      moves,
      accuracy: {
        white: gameAccuracy(whiteAccuracies),
        black: gameAccuracy(blackAccuracies),
      },
      counts,
      keyMoments,
      evalHistory,
      engineName: resolvedEngineName,
    };
  } finally {
    if (ownCreated) {
      activeEngine.dispose();
    }
  }
}

