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
  isSameMove,
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
  type UCIWorkerLike,
} from '@/analysis';

const VALID_CLASSES: MoveClass[] = ['opening', 'stellar', 'superb', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'missed'];

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

  it('sets onlyMove flag for gap > 15 points and caps decided positions at good', () => {
    expect(THRESHOLDS.onlyMoveGap).toBe(15);
    expect(classifyMove({ winBefore: 50, winAfter: 50, secondBestGap: 15.1 }).onlyMove).toBe(true);
    expect(classifyMove({ winBefore: 50, winAfter: 50, secondBestGap: 15.0 }).onlyMove).toBe(false);

    // Already lost (winBefore < 3) or already won (winBefore > 97): not stricter than 'good'
    expect(classifyMove({ winBefore: 2.5, winAfter: 0.1 }).moveClass).toBe('good');
    expect(classifyMove({ winBefore: 98.5, winAfter: 91.0 }).moveClass).toBe('good');
  });

  it('never classifies walking into forced mate as best when non-mating move exists', () => {
    // When the position before the move was already decided (winBefore <= 3%), walking into mate cannot be 'best',
    // but the minimum class 'mistake' is NOT enforced — the move is classified normally by loss.
    const resFromDecided = classifyMove({
      winBefore: 1.8,
      winAfter: 0,
      matchedBestMove: true,
      moverColor: 'black',
      evalBefore: { type: 'cp', value: 1090 },
      evalAfter: { type: 'mate', value: 3 },
    });
    expect(resFromDecided.moveClass).not.toBe('best');
    expect(['excellent', 'good']).toContain(resFromDecided.moveClass);

    // In an undecided position (winBefore > 3%), walking into a forced mate must be at least mistake/blunder
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
    expect(res1.reanalyzed).toBe(0);
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

  it('Morphy 15.Bxd7+: 15...Nxd7 not blunder, 15...Qxd7 at least good, queen blunder', async () => {
    // Position after 15.Bxd7+ (ply 29) in Morphy's Opera Game:
    // Black can recapture 15...Qxd7 (staying in the game without being mated) or 15...Nxd7?? (allowing 16.Qb8+! Nxb8 17.Rd8#)
    const afterBxd7 = parseFEN('4kb1r/p2B1ppp/4qn2/4p1B1/4P3/1Q6/PPP2PPP/2KR4 b k - 0 15');
    const moveNxd7 = sanToMove(afterBxd7, 'Nxd7')!;
    const moveQxd7 = sanToMove(afterBxd7, 'Qxd7')!;
    const afterNxd7 = applyMove(afterBxd7, moveNxd7);
    const afterQxd7 = applyMove(afterBxd7, moveQxd7);

    const engine: AnalysisEngine = hasStockfishFiles ? new StockfishEngine() : new OwnEngine();
    const depth = hasStockfishFiles ? 15 : 8;

    try {
      const reviewNxd7 = await reviewGame([afterBxd7, afterNxd7], engine, { depth });
      expect(reviewNxd7.moves.length).toBe(1);
      expect(reviewNxd7.moves[0].san).toBe('Nxd7');
      expect(reviewNxd7.moves[0].class).not.toBe('best');
      expect(['excellent', 'good']).toContain(reviewNxd7.moves[0].class);

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

  it('StockfishEngine ignores delayed info lines from a prior search and binds results to request IDs', async () => {
    let messageHandler: ((ev: { data: string }) => void) | null = null;
    const stubWorker: UCIWorkerLike = {
      set onmessage(fn: ((ev: { data: string }) => void) | null) {
        messageHandler = fn;
      },
      get onmessage() {
        return messageHandler;
      },
      onerror: null,
      postMessage(cmd: string) {
        if (cmd === 'uci') {
          setTimeout(() => {
            messageHandler?.({ data: 'id name MockDelayedEngine' });
            messageHandler?.({ data: 'uciok' });
          }, 0);
        } else if (cmd === 'isready') {
          setTimeout(() => {
            messageHandler?.({ data: 'readyok' });
          }, 5);
        } else if (cmd.startsWith('go depth 6')) {
          setTimeout(() => {
            messageHandler?.({ data: 'info depth 6 multipv 1 score cp 50 pv e2e4 e7e5' });
            messageHandler?.({ data: 'bestmove e2e4' });
            // Send delayed stale info after bestmove has been emitted
            setTimeout(() => {
              messageHandler?.({ data: 'info depth 14 multipv 1 score cp 999 pv h2h4' });
            }, 1);
          }, 2);
        } else if (cmd.startsWith('go depth 8')) {
          setTimeout(() => {
            messageHandler?.({ data: 'info depth 8 multipv 1 score cp 30 pv d2d4 d7d5' });
            messageHandler?.({ data: 'bestmove d2d4' });
          }, 15);
        }
      },
      terminate() {},
    };

    const engine = new StockfishEngine({
      workerFactory: () => stubWorker,
    });

    try {
      const startState = classicalRuleSet.getInitialState();
      const res1 = await engine.analyze(startState, { depth: 6 });
      expect(res1.score).toEqual({ type: 'cp', value: 50 });
      expect(moveToSAN(startState, res1.bestMove!)).toBe('e4');

      const res2 = await engine.analyze(startState, { depth: 8 });
      // The delayed line with score cp 999 must NOT leak into res2
      expect(res2.score).toEqual({ type: 'cp', value: 30 });
      expect(moveToSAN(startState, res2.bestMove!)).toBe('d4');
    } finally {
      engine.dispose();
    }
  });

  it('test (a): stub with false eval at d=14 and true eval at d=18 triggers re-analysis', async () => {
    const state28 = buildGameFromSan(MORPHY_SAN_MOVES.slice(0, 28));
    const state29 = applyMove(state28, sanToMove(state28, 'Bxd7+')!);
    const state30 = applyMove(state29, sanToMove(state29, 'Nxd7')!);

    const stubEngine: AnalysisEngine = {
      name: 'StockfishStub',
      async analyze(st: GameState, opts: EngineAnalyzeOptions): Promise<AnalysisEngineResult> {
        // State 28 (White to move before 15.Bxd7+): White is winning +1115 cp, bestMove is Bxd7+
        if (st.history.length === 28) {
          const best = sanToMove(st, 'Bxd7+')!;
          return {
            bestMove: best,
            score: { type: 'cp', value: 1115 },
            depth: opts.depth ?? 14,
            nodes: 1000,
            timeMs: 5,
            pv: [best],
            lines: [{ move: best, san: 'Bxd7+', score: { type: 'cp', value: 1115 }, pv: [best], pvSan: ['Bxd7+'] }],
            engineName: 'StockfishStub',
          };
        }
        // State 29 (Black to move after 15.Bxd7+):
        // At depth 14: false shallow horizon eval (+360 cp, bestMove Nxd7)
        // At depth 18: true eval (+1090 cp, bestMove Qxd7)
        if (st.history.length === 29) {
          if ((opts.depth ?? 14) < 18) {
            const best = sanToMove(st, 'Nxd7')!;
            return {
              bestMove: best,
              score: { type: 'cp', value: 360 },
              depth: opts.depth ?? 14,
              nodes: 1000,
              timeMs: 5,
              pv: [best],
              lines: [{ move: best, san: 'Nxd7', score: { type: 'cp', value: 360 }, pv: [best], pvSan: ['Nxd7'] }],
              engineName: 'StockfishStub',
            };
          } else {
            const best = sanToMove(st, 'Qxd7')!;
            return {
              bestMove: best,
              score: { type: 'cp', value: 1090 },
              depth: opts.depth ?? 18,
              nodes: 5000,
              timeMs: 15,
              pv: [best],
              lines: [{ move: best, san: 'Qxd7', score: { type: 'cp', value: 1090 }, pv: [best], pvSan: ['Qxd7'] }],
              engineName: 'StockfishStub',
            };
          }
        }
        // State 30 (White to move after 15...Nxd7): White has M3
        const best = sanToMove(st, 'Qb8+')!;
        return {
          bestMove: best,
          score: { type: 'mate', value: 3 },
          depth: opts.depth ?? 14,
          nodes: 1000,
          timeMs: 5,
          pv: [best],
          lines: [{ move: best, san: 'Qb8+', score: { type: 'mate', value: 3 }, pv: [best], pvSan: ['Qb8+'] }],
          engineName: 'StockfishStub',
        };
      },
      dispose() {},
    };

    const review = await reviewGame([state28, state29, state30], stubEngine, { depth: 14 });
    expect(review.moves.length).toBe(2);
    // 15.Bxd7+ gets class 'best'
    expect(review.moves[0].san).toBe('Bxd7+');
    expect(review.moves[0].class).toBe('best');
    // Best move after 15.Bxd7+ is Qxd7
    expect(review.moves[1].san).toBe('Nxd7');
    expect(review.moves[1].bestSan).toBe('Qxd7');
    // Reanalyzed count > 0
    expect(review.reanalyzed).toBeGreaterThan(0);
    expect(review.reanalyzed).toBe(1);
    // Cascading eval: evalAfter of move 1 equals evalBefore of move 2
    expect(review.moves[0].evalAfter).toEqual(review.moves[1].evalBefore);
    expect(review.moves[0].evalAfter).toEqual({ type: 'cp', value: 1090 });
  });

  it('test (c): invariant: move with class mistake/blunder never has bestMove == playedMove', async () => {
    const startState = classicalRuleSet.getInitialState();
    const badMove = sanToMove(startState, 'f3')!;
    const goodMove = sanToMove(startState, 'e4')!;
    const stateAfterBad = applyMove(startState, badMove);

    // Stub engine that insists on recommending the bad move as bestMove in line 1, but has a 2nd line
    const stubPersistentBlunder: AnalysisEngine = {
      name: 'StubPersistentBlunder',
      async analyze(st: GameState): Promise<AnalysisEngineResult> {
        if (st.history.length === 0) {
          return {
            bestMove: badMove,
            score: { type: 'cp', value: 50 },
            depth: 6,
            nodes: 100,
            timeMs: 2,
            pv: [badMove],
            lines: [
              { move: badMove, san: 'f3', score: { type: 'cp', value: 50 }, pv: [badMove], pvSan: ['f3'] },
              { move: goodMove, san: 'e4', score: { type: 'cp', value: 45 }, pv: [goodMove], pvSan: ['e4'] },
            ],
            engineName: 'StubPersistentBlunder',
          };
        }
        return {
          bestMove: null,
          score: { type: 'cp', value: -300 },
          depth: 6,
          nodes: 100,
          timeMs: 2,
          pv: [],
          lines: [],
          engineName: 'StubPersistentBlunder',
        };
      },
      dispose() {},
    };

    const review = await reviewGame([startState, stateAfterBad], stubPersistentBlunder, {
      depth: 6,
      autoReanalyze: false,
    });
    expect(review.moves.length).toBe(1);
    const m = review.moves[0];
    expect(m.san).toBe('f3');
    expect(['mistake', 'blunder']).toContain(m.class);
    // Invariant check: playedMove and bestMove must NOT be the same
    expect(isSameMove(m.move, m.bestMove)).toBe(false);
    expect(m.bestSan).toBe('e4');
  });

  it('test (e): Stockfish: 15.Bxd7+ is best, 15...Nxd7 has bestMove Qxd7 and class good/excellent', async (ctx) => {
    if (!hasStockfishFiles) {
      ctx.skip();
      return;
    }

    const state28 = buildGameFromSan(MORPHY_SAN_MOVES.slice(0, 28));
    const state29 = applyMove(state28, sanToMove(state28, 'Bxd7+')!);
    const state30 = applyMove(state29, sanToMove(state29, 'Nxd7')!);

    const sf = new StockfishEngine();
    try {
      const review = await reviewGame([state28, state29, state30], sf, { depth: 14 });
      expect(review.moves.length).toBe(2);

      // 15.Bxd7+ gets 'best'
      const move29 = review.moves[0];
      expect(move29.san).toBe('Bxd7+');
      expect(move29.class).toBe('best');

      // 15...Nxd7 has bestMove 'Qxd7' and class excellent or good (not blunder)
      const move30 = review.moves[1];
      expect(move30.san).toBe('Nxd7');
      expect(move30.bestSan).toBe('Qxd7');
      expect(['excellent', 'good']).toContain(move30.class);
      expect(move30.class).not.toBe('blunder');

      // Re-analysis was triggered
      expect(review.reanalyzed).toBeGreaterThan(0);
    } finally {
      sf.dispose();
    }
  }, 30000);
});
