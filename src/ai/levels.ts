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
  /** Maximum main search depth in plies */
  depth: number;
  /** Maximum search nodes (undefined = unlimited, used for strength control independent of CPU speed) */
  maxNodes?: number;
  /** Quiescence search control: false = disabled, number = max q-plies, true = full quiescence */
  quiescence: boolean | number;
  /** Number of top candidate moves (multiPV) considered by softmax sampling */
  topMoves: number;
  /** Softmax temperature in centipawns (0 = deterministic best move) */
  temperature: number;
  /** Probability of making a deliberate blunder (picking a weaker move from top-10) */
  blunderChance: number;
  /** Time budget in ms (used by Master level and as a UI/clock reference) */
  timeMs: number;
}

/**
 * Tunable difficulty table:
 * - novice   (~600-800):  1 ply, no quiescence, tight node cap, high softmax temperature + frequent blunders
 * - amateur  (~1000-1200): 2 plies, 1-ply quiescence, moderate node cap, medium temperature + occasional blunders
 * - club     (~1500):     3 plies, full quiescence, node-capped, mild softmax temperature, no deliberate blunders
 * - expert   (~1900):     4 plies, full quiescence, higher node cap, low softmax temperature
 * - master   (full):      unlimited nodes & full quiescence up to MAX_DEPTH within timeMs, zero noise
 */
export const LEVELS: Record<LevelId, LevelConfig> = {
  novice: {
    id: 'novice',
    name: 'Новичок',
    depth: 1,
    maxNodes: 60,
    quiescence: false,
    topMoves: 6,
    temperature: 180,
    blunderChance: 0.38,
    timeMs: 300,
  },
  amateur: {
    id: 'amateur',
    name: 'Любитель',
    depth: 2,
    maxNodes: 250,
    quiescence: 1,
    topMoves: 5,
    temperature: 75,
    blunderChance: 0.16,
    timeMs: 500,
  },
  club: {
    id: 'club',
    name: 'Клубный',
    depth: 3,
    maxNodes: 1000,
    quiescence: true,
    topMoves: 3,
    temperature: 32,
    blunderChance: 0,
    timeMs: 1000,
  },
  expert: {
    id: 'expert',
    name: 'Эксперт',
    depth: 4,
    maxNodes: 3200,
    quiescence: true,
    topMoves: 2,
    temperature: 15,
    blunderChance: 0,
    timeMs: 2000,
  },
  master: {
    id: 'master',
    name: 'Мастер',
    depth: MAX_DEPTH,
    maxNodes: undefined,
    quiescence: true,
    topMoves: 1,
    temperature: 0,
    blunderChance: 0,
    timeMs: 3000,
  },
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

/** Score converted to the mover's perspective in centipawn-like units. */
function moverValue(score: Score, whiteToMove: boolean): number {
  const v =
    score.type === 'mate'
      ? score.value > 0
        ? 10000 - score.value * 100
        : -10000 - score.value * 100
      : score.value;
  return whiteToMove ? v : -v;
}

/**
 * Pick a move for the given level. Returns null if there are no legal moves.
 * Weak levels are bounded by depth + maxNodes and sample via softmax + blunders.
 */
export function findBestMove(state: GameState, level: LevelId | LevelConfig, options: FindMoveOptions = {}): Move | null {
  const cfg = typeof level === 'string' ? LEVELS[level] : level;
  const rng = options.rng ?? Math.random;

  // Request up to 10 lines when blunderChance > 0 so blunders can pick from weaker moves in top-10
  const multiPV = cfg.blunderChance > 0 ? Math.max(cfg.topMoves, 10) : Math.max(1, cfg.topMoves);
  // Levels with maxNodes rely on node & depth limits, not wall-clock CPU speed
  const timeMs = cfg.maxNodes !== undefined ? undefined : cfg.timeMs;

  const res = analyzePosition(state, {
    depth: cfg.depth,
    nodes: cfg.maxNodes,
    timeMs,
    multiPV,
    quiescence: cfg.quiescence,
  });

  if (!res.bestMove) return null;
  if (cfg.temperature <= 0 && cfg.blunderChance <= 0) return res.bestMove;

  const whiteToMove = state.turn === 'white';
  const lines = res.lines;
  const bestScore = lines[0].score;
  const bestMoverVal = moverValue(bestScore, whiteToMove);
  const matePlies = bestScore.type === 'mate' ? Math.abs(bestScore.value) : Infinity;
  const hasWinningMate = bestScore.type === 'mate' && bestMoverVal > 0;

  // Levels above Novice always play mate in 1; Club and above always play any forced mate they find
  if (cfg.id !== 'novice' && hasWinningMate) {
    if (matePlies === 1 || cfg.id === 'club' || cfg.id === 'expert' || cfg.id === 'master') {
      return res.bestMove;
    }
  }

  // Roll for a deliberate blunder (Novice and Amateur)
  const isBlunder = lines.length > 1 && rng() < cfg.blunderChance;

  // Even Novice plays mate in 1 when it exists and a blunder did not trigger
  if (!isBlunder && hasWinningMate && matePlies === 1) {
    return res.bestMove;
  }

  if (isBlunder) {
    // Pick a weaker move from the bottom half of the up-to-10 candidate moves
    const startIdx = Math.max(1, Math.floor(lines.length / 2));
    const count = lines.length - startIdx;
    const idx = startIdx + Math.floor(rng() * count);
    return lines[idx].move;
  }

  // Softmax sampling over the top `cfg.topMoves` candidates
  const pool = lines.slice(0, Math.min(Math.max(1, cfg.topMoves), lines.length));
  if (pool.length === 1 || cfg.temperature <= 0) {
    return pool[0].move;
  }

  const temp = cfg.temperature;
  const values = pool.map((l) => moverValue(l.score, whiteToMove));
  const maxVal = Math.max(...values);
  const weights = values.map((v) => Math.exp(Math.max(-50, (v - maxVal) / temp)));
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  let r = rng() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      return pool[i].move;
    }
  }
  return pool[pool.length - 1].move;
}


