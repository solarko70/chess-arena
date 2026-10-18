/**
 * Public analysis API (used by the AI opponent and, later, by game review).
 * No DOM access.
 */
import type { GameState, Move } from '@/core';
import { applyMove, generateLegal, moveToSAN, isInCheck } from '@/core';
import { Position, sameMove } from './position';
import { searchPosition, MATE, MATE_BOUND, MAX_DEPTH } from './search';

export interface Score {
  type: 'cp' | 'mate';
  /** cp: centipawns; mate: signed number of plies until mate (positive = White mates) */
  value: number;
}

export interface AnalysisOptions {
  depth?: number;
  timeMs?: number;
  nodes?: number;
  multiPV?: number;
}

export interface AnalysisLine {
  move: Move;
  san: string;
  /** Score from White's point of view */
  score: Score;
  pv: Move[];
  pvSan: string[];
}

export interface AnalysisResult {
  bestMove: Move | null;
  /** Score from White's point of view */
  score: Score;
  pv: Move[];
  depth: number;
  nodes: number;
  lines: AnalysisLine[];
  /** Wall-clock time spent (not deterministic, informational only) */
  timeMs: number;
}

/** Default depth when neither depth, time nor node limit is given. */
export const DEFAULT_ANALYSIS_DEPTH = 4;

/** Convert an internal side-to-move score into a White-perspective Score. */
export function toWhiteScore(score: number, whiteToMove: boolean): Score {
  const s = whiteToMove ? score : -score;
  if (Math.abs(s) >= MATE_BOUND) {
    const plies = MATE - Math.abs(s);
    return { type: 'mate', value: s > 0 ? plies : -plies };
  }
  return { type: 'cp', value: s };
}

/** Map an internal PV to core Move objects (stops at the first unmatched move). */
function convertPV(state: GameState, pv: number[]): { moves: Move[]; sans: string[] } {
  const moves: Move[] = [];
  const sans: string[] = [];
  let st = state;
  for (const m of pv) {
    const legal = generateLegal(st);
    const mv = legal.find((x) => sameMove(m, x));
    if (!mv) break;
    moves.push(mv);
    sans.push(moveToSAN(st, mv));
    st = applyMove(st, mv);
  }
  return { moves, sans };
}

/**
 * Analyse a position. Deterministic when only `depth` and/or `nodes` are limited.
 */
export function analyzePosition(state: GameState, options: AnalysisOptions = {}): AnalysisResult {
  const start = Date.now();
  const whiteToMove = state.turn === 'white';
  const legal = generateLegal(state);

  if (legal.length === 0) {
    const mated = isInCheck(state.board, state.turn);
    return {
      bestMove: null,
      score: mated ? { type: 'mate', value: 0 } : { type: 'cp', value: 0 },
      pv: [],
      depth: 0,
      nodes: 0,
      lines: [],
      timeMs: Date.now() - start,
    };
  }

  const noLimit = options.depth === undefined && options.timeMs === undefined && options.nodes === undefined;
  const depth = options.depth ?? (noLimit ? DEFAULT_ANALYSIS_DEPTH : MAX_DEPTH);
  const multiPV = Math.min(Math.max(1, options.multiPV ?? 1), legal.length);

  const pos = Position.fromState(state);
  // Keep a small reserve for converting the PV back to core moves
  const timeMs =
    options.timeMs === undefined ? undefined : Math.max(1, options.timeMs * 0.95 - (Date.now() - start));
  const res = searchPosition(pos, { depth, timeMs, nodes: options.nodes, multiPV });

  const lines: AnalysisLine[] = [];
  for (const line of res.lines) {
    const { moves, sans } = convertPV(state, line.pv);
    if (moves.length === 0) continue;
    lines.push({
      move: moves[0],
      san: sans[0],
      score: toWhiteScore(line.score, whiteToMove),
      pv: moves,
      pvSan: sans,
    });
  }

  // Fallback (should not happen): search produced nothing usable
  if (lines.length === 0) {
    lines.push({ move: legal[0], san: moveToSAN(state, legal[0]), score: { type: 'cp', value: 0 }, pv: [legal[0]], pvSan: [moveToSAN(state, legal[0])] });
  }

  return {
    bestMove: lines[0].move,
    score: lines[0].score,
    pv: lines[0].pv,
    depth: res.depth,
    nodes: res.nodes,
    lines,
    timeMs: Date.now() - start,
  };
}
