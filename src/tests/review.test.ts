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
  OwnEngine,
  StockfishEngine,
  createEngine,
  reviewGame,
  type AnalysisEngine,
  type AnalysisEngineResult,
  type EngineAnalyzeOptions,
} from '@/analysis';

const MORPHY_SAN_MOVES = [
  'e4', 'e5',
  'Nf3', 'd6',
  'd4', 'Bg4',
  'dxe5', 'Bxf3',
  'Qxf3', 'dxe5',
  'Bc4', 'Nf6',
  'Qb3', 'Qe7',
  'Nc3', 'c6',
  'Bg5', 'b5',
  'Nxb5', 'cxb5',
  'Bxb5+', 'Nbd7',
  'O-O-O', 'Rd8',
  'Rxd7', 'Rxd7',
  'Rd1', 'Qe6',
  'Bxd7+', 'Nxd7',
  'Qb8+', 'Nxb8',
  'Rd8#',
];

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
    // Arithmetic = 75, Harmonic = 2 / (1/100 + 1/50) = 66.666..., average = 70.833...
    expect(mixed).toBeCloseTo((75 + 200 / 3) / 2, 4);
  });
});

describe('classifyMove boundaries & special flags', () => {
  it('classifies best move (matchedBestMove or loss <= 0.5)', () => {
    expect(classifyMove({ winBefore: 50, winAfter: 50, matchedBestMove: false }).moveClass).toBe('best');
    expect(classifyMove({ winBefore: 50, winAfter: 49.5, matchedBestMove: false }).moveClass).toBe('best');
    expect(classifyMove({ winBefore: 50, winAfter: 40, matchedBestMove: true }).moveClass).toBe('best');
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
});

describe('UCI line parsers (pure, without starting an engine)', () => {
  it('parses info lines with cp, negative cp, mate, negative mate, and multipv from White and Black perspective', () => {
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
  it('is deterministic, classifies moves, computes accuracy, reports onProgress, and supports AbortSignal', async () => {
    // Build a 4-ply game: 1. e4 e5 2. Nf3 Nc6
    const game = buildGameFromSan(['e4', 'e5', 'Nf3', 'Nc6']);

    // Predefined White-perspective cp evaluations for the 5 positions (plies 0..4):
    // ply 0 (start, White to move): +20 cp, bestMove = e4 (played e4 -> best)
    // ply 1 (after e4, Black to move): +20 cp, bestMove = e5 (played e5 -> best)
    // ply 2 (after e5, White to move): +20 cp, bestMove = d4 (played Nf3, eval drops to -50 -> inaccuracy)
    // ply 3 (after Nf3, Black to move): -50 cp, bestMove = d6 (played Nc6, eval jumps to +260 for White -> blunder by Black)
    // ply 4 (after Nc6): +260 cp
    const predefinedScores: Score[] = [
      { type: 'cp', value: 20 },
      { type: 'cp', value: 20 },
      { type: 'cp', value: 20 },
      { type: 'cp', value: -50 },
      { type: 'cp', value: 260 },
    ];
    const preferredBestSan = ['e4', 'e5', 'd4', 'd6', 'd4'];

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
          depth: options?.depth ?? 6,
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
    const res1 = await reviewGame(game, stubEngine, {
      onProgress: (p) => progressEvents.push(p),
    });
    callIdx = 0;
    const res2 = await reviewGame(game, stubEngine);

    // Determinism check
    expect(res1).toEqual(res2);
    expect(res1.engineName).toBe('StubEngine');
    expect(progressEvents.length).toBe(5);
    expect(progressEvents[0]).toEqual({ completed: 1, total: 5, ply: 0 });
    expect(progressEvents[4]).toEqual({ completed: 5, total: 5, ply: 4 });

    // Classifications:
    // Move 1 (White e4): matched best move -> 'best'
    expect(res1.moves[0].class).toBe('best');
    // Move 2 (Black e5): matched best move -> 'best'
    expect(res1.moves[1].class).toBe('best');
    // Move 3 (White Nf3): +20 cp -> -50 cp (~6.4% win loss) -> 'inaccuracy'
    expect(res1.moves[2].class).toBe('inaccuracy');
    // Move 4 (Black Nc6): -50 cp -> +260 cp (~27% win loss for Black) -> 'blunder'
    expect(res1.moves[3].class).toBe('blunder');

    expect(res1.counts.white.best).toBe(1);
    expect(res1.counts.white.inaccuracy).toBe(1);
    expect(res1.counts.black.best).toBe(1);
    expect(res1.counts.black.blunder).toBe(1);
    expect(res1.accuracy.white).toBeGreaterThan(res1.accuracy.black);

    // Cancellation via AbortController
    const abortController = new AbortController();
    callIdx = 0;
    const abortingPromise = reviewGame(game, stubEngine, {
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
    engine.dispose();
  });
});

describe('StockfishEngine integration & Morphy Opera Game review', () => {
  const publicDir = path.resolve(process.cwd(), 'public', 'stockfish');
  const publicJs = path.join(publicDir, 'stockfish-18-lite-single.js');
  const publicWasm = path.join(publicDir, 'stockfish-18-lite-single.wasm');
  const hasStockfishFiles = fs.existsSync(publicJs) && fs.existsSync(publicWasm);

  it('StockfishEngine evaluates start position in [-80, +80] cp and finds mate in 1', async (ctx) => {
    if (!hasStockfishFiles) {
      console.warn('Skipping Stockfish integration test: Stockfish lite-single files are not available in public/stockfish/');
      ctx.skip();
      return;
    }

    const sf = new StockfishEngine();
    try {
      const startState = classicalRuleSet.getInitialState();
      const startRes = await sf.analyze(startState, { depth: 8, multiPV: 2 });
      expect(startRes.engineName).toBe('Stockfish');
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
  }, 30000);

  it('reviews Morphy Opera Game with OwnEngine (depth 6): Rd8# is not an error, and injected queen blunder is classified as blunder', async () => {
    const operaGame = buildGameFromSan(MORPHY_SAN_MOVES);
    const own = new OwnEngine();

    const t0 = Date.now();
    const operaReview = await reviewGame(operaGame, own, { depth: 6 });
    const ownMs = Date.now() - t0;

    expect(operaReview.engineName).toBe('OwnEngine');
    expect(operaReview.moves.length).toBe(33);

    const finalMove = operaReview.moves[operaReview.moves.length - 1];
    expect(finalMove.san).toBe('Rd8#');
    expect(finalMove.class).toBe('best');

    console.log(
      `[opera-own] 33 plies (34 positions) reviewed in ${ownMs} ms | ` +
        `White acc=${operaReview.accuracy.white.toFixed(1)}%, Black acc=${operaReview.accuracy.black.toFixed(1)}%`,
    );

    // Inject an artificial queen blunder directly into Morphy's Opera Game:
    // After 7. Qb3 Qe7, play 8. Qb6?? axb6 (losing the queen for nothing)
    const stateBefore8 = buildGameFromSan(MORPHY_SAN_MOVES.slice(0, 14));
    const blunderMove = sanToMove(stateBefore8, 'Qb6')!;
    const stateAfter8 = applyMove(stateBefore8, blunderMove);
    const blunderReview = await reviewGame([stateBefore8, stateAfter8], own, { depth: 6 });
    const queenBlunderMove = blunderReview.moves[0];
    expect(queenBlunderMove.san).toBe('Qb6');
    expect(queenBlunderMove.class).toBe('blunder');

    if (hasStockfishFiles) {
      const sf = new StockfishEngine();
      try {
        const sfStart = Date.now();
        const sfOpera = await reviewGame(operaGame, sf, { depth: 14 });
        const sfMs = Date.now() - sfStart;
        expect(sfOpera.moves[sfOpera.moves.length - 1].san).toBe('Rd8#');
        expect(sfOpera.moves[sfOpera.moves.length - 1].class).toBe('best');
        console.log(
          `[opera-sf] 33 plies (34 positions) reviewed in ${sfMs} ms | ` +
            `White acc=${sfOpera.accuracy.white.toFixed(1)}%, Black acc=${sfOpera.accuracy.black.toFixed(1)}%`,
        );
      } finally {
        sf.dispose();
      }
    }
  }, 90000);
});
