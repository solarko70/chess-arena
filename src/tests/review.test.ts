// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  classicalRuleSet,
  parseFEN,
  sanToMove,
  applyMove,
  generateLegal,
  moveToSAN,
} from '@/core';
import type { GameState } from '@/core';
import type { Score } from '@/ai';
import {
  winChance,
  scoreToCp,
  moveAccuracy,
  gameAccuracy,
  THRESHOLDS,
  classifyMove,
  parseUCIInfoLine,
  parseUCIBestMove,
  parseUCIIdName,
  findStockfishLiteSingleInDir,
  OwnEngine,
  StockfishEngine,
  createEngine,
  reviewGame,
  type AnalysisEngine,
  type AnalysisEngineResult,
  type EngineAnalyzeOptions,
  type MoveClass,
} from '@/analysis';

const VALID_CLASSES: MoveClass[] = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];

function buildGameFromSan(sans: readonly string[]): GameState {
  let state = classicalRuleSet.getInitialState();
  for (const san of sans) {
    const move = sanToMove(state, san);
    if (!move) throw new Error(`Illegal SAN move in test fixture: ${san}`);
    state = classicalRuleSet.applyMove(state, move);
  }
  return state;
}

describe('winChance & scoreToCp', () => {
  it('win(0) = 50, symmetry win(cp) + win(-cp) = 100, and strict monotonicity', () => {
    expect(winChance(0)).toBe(50);
    expect(winChance({ type: 'cp', value: 0 })).toBe(50);

    for (const cp of [10, 50, 120, 300, 600, 1200, 3000]) {
      const wPos = winChance(cp);
      const wNeg = winChance(-cp);
      expect(wPos + wNeg).toBeCloseTo(100, 9);
      expect(wPos).toBeGreaterThan(50);
      expect(wNeg).toBeLessThan(50);
    }

    const cps = [-1500, -500, -150, -30, 0, 30, 150, 500, 1500];
    for (let i = 1; i < cps.length; i++) {
      expect(winChance(cps[i])).toBeGreaterThan(winChance(cps[i - 1]));
    }
  });

  it('mate in 1 is strictly better than mate in 5 (both in scoreToCp and winChance)', () => {
    const mate1White: Score = { type: 'mate', value: 1 };
    const mate5White: Score = { type: 'mate', value: 9 };
    expect(scoreToCp(mate1White)).toBeGreaterThan(scoreToCp(mate5White));
    expect(winChance(mate1White)).toBeGreaterThan(winChance(mate5White));

    const mate1Black: Score = { type: 'mate', value: -1 };
    const mate5Black: Score = { type: 'mate', value: -9 };
    expect(scoreToCp(mate1Black)).toBeLessThan(scoreToCp(mate5Black));
    expect(winChance(mate1Black)).toBeLessThan(winChance(mate5Black));
  });
});

describe('moveAccuracy & gameAccuracy', () => {
  it('accuracy(0 loss) ≈ 100, decreases monotonically with loss, and is clamped to 0..100', () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 2);
    expect(moveAccuracy(-5)).toBe(100);

    const losses = [0, 1, 3, 7, 15, 25, 50, 80, 100];
    for (let i = 1; i < losses.length; i++) {
      const prev = moveAccuracy(losses[i - 1]);
      const curr = moveAccuracy(losses[i]);
      expect(curr).toBeLessThanOrEqual(prev);
      expect(curr).toBeGreaterThanOrEqual(0);
      expect(curr).toBeLessThanOrEqual(100);
    }
    expect(moveAccuracy(1000)).toBe(0);
  });

  it('gameAccuracy combines arithmetic and harmonic means', () => {
    expect(gameAccuracy([100, 100, 100])).toBeCloseTo(100, 5);
    const mixed = gameAccuracy([100, 50]);
    expect(mixed).toBeCloseTo((75 + 200 / 3) / 2, 4);
  });
});

describe('classifyMove boundaries & special rules', () => {
  it('classifies best move ONLY when loss <= 0.5 (or checkmate), even if matchedBestMove is true', () => {
    expect(classifyMove({ winBefore: 50, winAfter: 50, matchedBestMove: false }).moveClass).toBe('best');
    expect(classifyMove({ winBefore: 50, winAfter: 49.5, matchedBestMove: false }).moveClass).toBe('best');
    expect(classifyMove({ winBefore: 50, winAfter: 49.5, matchedBestMove: true }).moveClass).toBe('best');
    // If matchedBestMove is true but loss > 0.5, it must NOT be classified as 'best'
    expect(classifyMove({ winBefore: 50, winAfter: 40, matchedBestMove: true }).moveClass).toBe('mistake');
    expect(classifyMove({ winBefore: 50, winAfter: 25, matchedBestMove: true }).moveClass).toBe('blunder');
    // Checkmate move is always 'best'
    expect(classifyMove({ winBefore: 99, winAfter: 100, isCheckmateMove: true }).moveClass).toBe('best');
  });

  it('classifies excellent move (0.5 < loss < 2)', () => {
    expect(classifyMove({ winBefore: 50, winAfter: 49.49 }).moveClass).toBe('excellent');
    expect(classifyMove({ winBefore: 50, winAfter: 48.01 }).moveClass).toBe('excellent');
  });

  it('classifies good move (2 <= loss < 5)', () => {
    expect(classifyMove({ winBefore: 50, winAfter: 48 }).moveClass).toBe('good');
    expect(classifyMove({ winBefore: 50, winAfter: 45.01 }).moveClass).toBe('good');
  });

  it('classifies inaccuracy (5 <= loss < 10)', () => {
    expect(classifyMove({ winBefore: 50, winAfter: 45 }).moveClass).toBe('inaccuracy');
    expect(classifyMove({ winBefore: 50, winAfter: 40.01 }).moveClass).toBe('inaccuracy');
  });

  it('classifies mistake (10 <= loss < 20)', () => {
    expect(classifyMove({ winBefore: 50, winAfter: 40 }).moveClass).toBe('mistake');
    expect(classifyMove({ winBefore: 50, winAfter: 30.01 }).moveClass).toBe('mistake');
  });

  it('classifies blunder (loss >= 20)', () => {
    expect(classifyMove({ winBefore: 50, winAfter: 30 }).moveClass).toBe('blunder');
    expect(classifyMove({ winBefore: 60, winAfter: 10 }).moveClass).toBe('blunder');
  });

  it('sets onlyMove flag when gap between 1st and 2nd multiPV exceeds 15 points and caps decided positions at good', () => {
    expect(THRESHOLDS.onlyMoveGap).toBe(15);
    expect(classifyMove({ winBefore: 50, winAfter: 50, secondBestGap: 15.1 }).onlyMove).toBe(true);
    expect(classifyMove({ winBefore: 50, winAfter: 50, secondBestGap: 15.0 }).onlyMove).toBe(false);

    // Already lost (winBefore < 3) or already won (winBefore > 97): not stricter than 'good'
    expect(classifyMove({ winBefore: 2.5, winAfter: 0.1 }).moveClass).toBe('good');
    expect(classifyMove({ winBefore: 98.5, winAfter: 91.0 }).moveClass).toBe('good');
  });

  it('never classifies a move that leads to forced mate against the mover as best when a non-mating reply exists', () => {
    // Even if winBefore was low (< 3%) or matchedBestMove was true, walking into mate when a non-mating line existed cannot be 'best'
    const resFromDecided = classifyMove({
      winBefore: 1.8,
      winAfter: 0,
      matchedBestMove: true,
      moverColor: 'black',
      evalBefore: { type: 'cp', value: 1090 },
      evalAfter: { type: 'mate', value: 3 },
    });
    expect(resFromDecided.moveClass).not.toBe('best');
    expect(['mistake', 'blunder']).toContain(resFromDecided.moveClass);

    const resFromEqual = classifyMove({
      winBefore: 28.9,
      winAfter: 0,
      matchedBestMove: true,
      moverColor: 'black',
      evalBefore: { type: 'cp', value: 244 },
      evalAfter: { type: 'mate', value: 3 },
    });
    expect(resFromEqual.moveClass).toBe('blunder');
  });
});

describe('UCI line parsers (pure, without starting an engine)', () => {
  it('parses info lines with cp, negative cp, mate, negative mate, multipv, and id name', () => {
    expect(parseUCIIdName('id name Stockfish 19 Lite WASM')).toBe('Stockfish 19 Lite WASM');
    expect(parseUCIIdName('id author the Stockfish developers')).toBeNull();

    const infoWhiteCp = parseUCIInfoLine(
      'info depth 14 seldepth 20 multipv 1 score cp 45 nodes 25400 time 42 pv e2e4 e7e5 g1f3',
      true,
    );
    expect(infoWhiteCp).not.toBeNull();
    expect(infoWhiteCp!.depth).toBe(14);
    expect(infoWhiteCp!.multipv).toBe(1);
    expect(infoWhiteCp!.score).toEqual({ type: 'cp', value: 45 });
    expect(infoWhiteCp!.pv).toEqual(['e2e4', 'e7e5', 'g1f3']);

    // Black to move: negative cp (-120 for Black) means +120 for White
    const infoBlackNegCp = parseUCIInfoLine(
      'info depth 12 multipv 2 score cp -120 nodes 10000 time 20 pv b8c6 d2d4',
      false,
    );
    expect(infoBlackNegCp).not.toBeNull();
    expect(infoBlackNegCp!.multipv).toBe(2);
    expect(infoBlackNegCp!.score).toEqual({ type: 'cp', value: 120 });

    // White to move: mate 2 (White mates in 2 moves = 3 plies) -> +3
    const infoWhiteMate = parseUCIInfoLine(
      'info depth 18 multipv 1 score mate 2 nodes 500 pv c4f7 e8e7 c3d5',
      true,
    );
    expect(infoWhiteMate!.score).toEqual({ type: 'mate', value: 3 });

    // Black to move: mate 1 (Black mates in 1 move = 1 ply) -> -1 from White's perspective
    const infoBlackMate = parseUCIInfoLine(
      'info depth 10 multipv 1 score mate 1 nodes 100 pv b8b1',
      false,
    );
    expect(infoBlackMate!.score).toEqual({ type: 'mate', value: -1 });

    // Black to move: mate -1 (Black gets mated in 1 move = 2 plies) -> +2 from White's perspective
    const infoBlackMated = parseUCIInfoLine(
      'info depth 10 multipv 1 score mate -1 nodes 100 pv e8e7 c3d5',
      false,
    );
    expect(infoBlackMated!.score).toEqual({ type: 'mate', value: 2 });
  });

  it('parses bestmove lines with and without ponder or (none)', () => {
    expect(parseUCIBestMove('bestmove e2e4 ponder e7e5')).toEqual({
      bestMove: 'e2e4',
      ponder: 'e7e5',
    });
    expect(parseUCIBestMove('bestmove a7a8q')).toEqual({
      bestMove: 'a7a8q',
      ponder: undefined,
    });
    expect(parseUCIBestMove('bestmove (none)')).toEqual({
      bestMove: null,
      ponder: undefined,
    });
  });
});

describe('reviewGame with stub engine & fallback behavior', () => {
  it('is deterministic, classifies every move (including checkmate), computes accuracy, reports onProgress, and supports AbortSignal', async () => {
    // Fool's mate (4 plies: 1. f3 e5 2. g4 Qh4#) so the last move is a checkmate
    const game = buildGameFromSan(['f3', 'e5', 'g4', 'Qh4#']);

    const predefinedScores: Score[] = [
      { type: 'cp', value: 20 },
      { type: 'cp', value: -60 },
      { type: 'cp', value: -55 },
      { type: 'mate', value: -1 },
      { type: 'mate', value: 0 },
    ];
    const preferredBestSan = ['e4', 'd5', 'Nc3', 'Qh4#', ''];

    let callIdx = 0;
    const stubEngine: AnalysisEngine = {
      name: 'StubEngine',
      async analyze(state: GameState, options?: EngineAnalyzeOptions): Promise<AnalysisEngineResult> {
        if (options?.signal?.aborted) {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          throw err;
        }
        const idx = callIdx++;
        const legal = generateLegal(state);
        const wantedSan = preferredBestSan[idx];
        const chosen =
          legal.find((m) => moveToSAN(state, m) === wantedSan) ?? legal[0] ?? null;
        const chosenSan = chosen ? moveToSAN(state, chosen) : '';
        const score = predefinedScores[idx] ?? { type: 'cp', value: 0 };
        return {
          bestMove: chosen,
          score,
          pv: chosen ? [chosen] : [],
          depth: options?.depth ?? 5,
          nodes: 100,
          lines: chosen
            ? [
                {
                  move: chosen,
                  san: chosenSan,
                  score,
                  pv: [chosen],
                  pvSan: [chosenSan],
                },
              ]
            : [],
          timeMs: 1,
          engineName: 'StubEngine',
        };
      },
      dispose() {},
    };

    const progressEvents: { completed: number; total: number; ply: number }[] = [];
    // Use depth 5 so consistency re-analysis does not add extra stub calls
    const res1 = await reviewGame(game, stubEngine, {
      depth: 5,
      onProgress: (p) => progressEvents.push(p),
    });
    callIdx = 0;
    const res2 = await reviewGame(game, stubEngine, { depth: 5 });

    expect(res1).toEqual(res2);
    expect(res1.engineName).toBe('StubEngine');
    expect(progressEvents.length).toBe(5);
    expect(progressEvents[0]).toEqual({ completed: 1, total: 5, ply: 0 });
    expect(progressEvents[4]).toEqual({ completed: 5, total: 5, ply: 4 });

    // Every move in the game must have a valid class
    expect(res1.moves.length).toBe(4);
    for (const m of res1.moves) {
      expect(VALID_CLASSES).toContain(m.class);
    }

    // Move 1 (White f3): +20 -> -60 (~7.3% loss) -> 'inaccuracy'
    expect(res1.moves[0].class).toBe('inaccuracy');
    // Move 2 (Black e5): -60 -> -55 (< 0.5% loss) -> 'best'
    expect(res1.moves[1].class).toBe('best');
    // Move 3 (White g4): -55 -> mate -1 (walks into mate in 1) -> 'blunder'
    expect(res1.moves[2].class).toBe('blunder');
    // Move 4 (Black Qh4#): delivers checkmate -> always 'best' with 0 loss
    expect(res1.moves[3].san).toBe('Qh4#');
    expect(res1.moves[3].class).toBe('best');
    expect(res1.moves[3].loss).toBe(0);

    // Cancellation via AbortController
    const abortController = new AbortController();
    callIdx = 0;
    const abortingPromise = reviewGame(game, stubEngine, {
      depth: 5,
      signal: abortController.signal,
      onProgress: (p) => {
        if (p.completed === 2) abortController.abort();
      },
    });
    await expect(abortingPromise).rejects.toThrow(/abort/i);
  });

  it('falls back to OwnEngine when Stockfish fails to load and reports OwnEngine in engineName', async () => {
    const startState = classicalRuleSet.getInitialState();
    const engine = createEngine(startState, {
      workerFactory: () => {
        throw new Error('Simulated missing Stockfish WASM binary');
      },
    });

    const singleRes = await engine.analyze(startState, { depth: 3 });
    expect(singleRes.engineName).toBe('OwnEngine');
    expect(singleRes.bestMove).not.toBeNull();

    const shortGame = buildGameFromSan(['e4', 'e5']);
    const review = await reviewGame(shortGame, engine, { depth: 3 });
    expect(review.engineName).toBe('OwnEngine');
    expect(review.moves.length).toBe(2);
    for (const m of review.moves) {
      expect(VALID_CLASSES).toContain(m.class);
    }
    engine.dispose();
  });
});

describe('StockfishEngine integration & Opera Game 15.Bxd7+ tactical test', () => {
  const publicDir = path.resolve(process.cwd(), 'public', 'stockfish');
  const hasStockfishFiles =
    fs.existsSync(publicDir) &&
    findStockfishLiteSingleInDir(fs.readdirSync(publicDir)) !== null;

  it('StockfishEngine evaluates start position in [-80, +80] cp, finds mate in 1, and reports UCI id name', async (ctx) => {
    if (!hasStockfishFiles) {
      console.warn('Skipping Stockfish integration test: Stockfish lite-single files are not available in public/stockfish/');
      ctx.skip();
      return;
    }

    const sf = new StockfishEngine();
    try {
      const startState = classicalRuleSet.getInitialState();
      const startRes = await sf.analyze(startState, { depth: 8, multiPV: 2 });
      expect(startRes.engineName).toMatch(/Stockfish/i);
      expect(startRes.score.type).toBe('cp');
      expect(startRes.score.value).toBeGreaterThanOrEqual(-80);
      expect(startRes.score.value).toBeLessThanOrEqual(80);
      expect(startRes.lines.length).toBe(2);

      const mate1State = parseFEN('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
      const mateRes = await sf.analyze(mate1State, { depth: 6, multiPV: 1 });
      expect(mateRes.score).toEqual({ type: 'mate', value: 1 });
      expect(moveToSAN(mate1State, mateRes.bestMove!)).toBe('Ra8#');
    } finally {
      sf.dispose();
    }
  }, 15000);

  it('after 15.Bxd7+ in Morphy Opera Game: 15...Nxd7 is blunder/mistake and 15...Qxd7 is at least good; injected queen blunder is blunder', async () => {
    // Position after 15.Bxd7+ (ply 29) in Morphy's Opera Game:
    // Black can recapture 15...Qxd7 (staying in the game without being mated) or 15...Nxd7?? (allowing 16.Qb8+! Nxb8 17.Rd8#)
    const afterBxd7 = parseFEN('4kb1r/p2B1ppp/4qn2/4p1B1/4P3/1Q6/PPP2PPP/2KR4 b k - 0 15');
    const moveNxd7 = sanToMove(afterBxd7, 'Nxd7')!;
    const moveQxd7 = sanToMove(afterBxd7, 'Qxd7')!;
    const afterNxd7 = applyMove(afterBxd7, moveNxd7);
    const afterQxd7 = applyMove(afterBxd7, moveQxd7);

    const engine: AnalysisEngine = hasStockfishFiles ? new StockfishEngine() : new OwnEngine();
    const depth = hasStockfishFiles ? 14 : 8;

    try {
      const reviewNxd7 = await reviewGame([afterBxd7, afterNxd7], engine, { depth });
      expect(reviewNxd7.moves.length).toBe(1);
      expect(reviewNxd7.moves[0].san).toBe('Nxd7');
      expect(['blunder', 'mistake']).toContain(reviewNxd7.moves[0].class);

      const reviewQxd7 = await reviewGame([afterBxd7, afterQxd7], engine, { depth });
      expect(reviewQxd7.moves.length).toBe(1);
      expect(reviewQxd7.moves[0].san).toBe('Qxd7');
      expect(['best', 'excellent', 'good']).toContain(reviewQxd7.moves[0].class);

      // Also verify an injected queen blunder on move 8 (8.Qb6?? axb6) is classified as 'blunder'
      const beforeMove8 = parseFEN('r3kb1r/ppp1qppp/2n2n2/4p3/2B1P3/1Q6/PPPP1PPP/RNB1K2R w KQkq - 3 8');
      const afterQb6 = applyMove(beforeMove8, sanToMove(beforeMove8, 'Qb6')!);
      const own = new OwnEngine();
      const blunderRev = await reviewGame([beforeMove8, afterQb6], own, { depth: 4 });
      expect(blunderRev.moves[0].san).toBe('Qb6');
      expect(blunderRev.moves[0].class).toBe('blunder');
    } finally {
      engine.dispose();
    }
  }, 15000);
});
