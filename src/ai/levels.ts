/**
 * Difficulty levels and the AI move picker. No DOM access.
 */
import type { GameState, Move } from '@/core';
import { analyzePosition, type Score } from './api';
import { MAX_DEPTH } from './search';

export type LevelId = 'novice' | 'amateur' | 'club' | 'expert' | 'master';

export interface LevelConfig {
  id: LevelId;
  /** Display name (UI label) */
  name: string;
  /** Maximum search depth in plies */
  depth: number;
  /** Hard time limit per move in milliseconds */
  timeMs: number;
  /** Amplitude of uniform random noise added to candidate scores (centipawns) */
  noise: number;
  /** Probability of playing a random candidate instead of the best one */
  blunderChance: number;
  /** Number of candidate moves considered by noise/blunders */
  candidates: number;
}

export const LEVELS: Record<LevelId, LevelConfig> = {
  novice: { id: 'novice', name: 'Новичок', depth: 1, timeMs: 300, noise: 150, blunderChance: 0.25, candidates: 6 },
  amateur: { id: 'amateur', name: 'Любитель', depth: 2, timeMs: 500, noise: 60, blunderChance: 0.1, candidates: 4 },
  club: { id: 'club', name: 'Клубный', depth: 4, timeMs: 1000, noise: 20, blunderChance: 0.02, candidates: 3 },
  expert: { id: 'expert', name: 'Эксперт', depth: 6, timeMs: 2000, noise: 5, blunderChance: 0, candidates: 2 },
  master: { id: 'master', name: 'Мастер', depth: MAX_DEPTH, timeMs: 3000, noise: 0, blunderChance: 0, candidates: 1 },
};

export const LEVEL_ORDER: LevelId[] = ['novice', 'amateur', 'club', 'expert', 'master'];

export interface FindMoveOptions {
  /** Random source in [0, 1); defaults to Math.random */
  rng?: () => number;
}

/** Deterministic PRNG (mulberry32), handy for reproducible AI games. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Score converted to the mover's perspective on a single numeric scale. */
function moverValue(score: Score, whiteToMove: boolean): number {
  const v = score.type === 'mate' ? (score.value > 0 ? 1e6 - score.value : -1e6 - score.value) : score.value;
  return whiteToMove ? v : -v;
}

/**
 * Pick a move for the given level. Returns null if there are no legal moves.
 * Weak levels add noise / occasional blunders, but never miss a forced mate.
 */
export function findBestMove(state: GameState, level: LevelId | LevelConfig, options: FindMoveOptions = {}): Move | null {
  const cfg = typeof level === 'string' ? LEVELS[level] : level;
  const rng = options.rng ?? Math.random;
  const res = analyzePosition(state, { depth: cfg.depth, timeMs: cfg.timeMs, multiPV: cfg.candidates });
  if (!res.bestMove) return null;
  if (cfg.noise === 0 && cfg.blunderChance === 0) return res.bestMove;

  const whiteToMove = state.turn === 'white';
  // A forced mate for the side to move is always played
  if (res.score.type === 'mate' && moverValue(res.score, whiteToMove) > 0) return res.bestMove;

  const lines = res.lines;
  if (lines.length > 1 && rng() < cfg.blunderChance) {
    return lines[Math.floor(rng() * lines.length)].move;
  }

  let bestMove = lines[0].move;
  let bestVal = -Infinity;
  for (const line of lines) {
    const v = moverValue(line.score, whiteToMove) + (rng() * 2 - 1) * cfg.noise;
    if (v > bestVal) {
      bestVal = v;
      bestMove = line.move;
    }
  }
  return bestMove;
}

