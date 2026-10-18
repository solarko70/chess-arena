import { describe, it, expect } from 'vitest';
import { parseFEN, applyMove, generateLegal, classicalRuleSet, isCheckmate, moveToSAN } from '@/core';
import type { GameState, Move } from '@/core';
import { analyzePosition, evaluate, findBestMove, LEVELS, LEVEL_ORDER, seededRandom } from '@/ai';
import type { LevelConfig } from '@/ai';
import { Position, perft } from '@/ai/position';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';

// Mate-in-1 positions (each verified by brute force over core legal moves)
const MATE_IN_1 = [
  { name: 'back-rank Ra8#', fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1' },
  { name: "scholar's mate Qxf7#", fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4' },
  { name: 'black back-rank Rb1#', fen: '1r4k1/8/8/8/8/8/5PPP/6K1 b - - 0 1' },
];

// Mate-in-2 positions (verified: forced mate in 2 exists, no mate in 1)
const MATE_IN_2 = [
  // Legal de Kermeur vs Saint Brie, 1750: 6.Bxf7+ Ke7 7.Nd5#
  { name: "Legal's mate", fen: 'rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6' },
  // K+R vs K: 1.Kb6 Kb8 2.Rh8# (or 1.Kc7 Ka7 2.Ra1#)
  { name: 'K+R vs K (white)', fen: 'k7/8/2K5/8/8/8/8/7R w - - 0 1' },
  // Same pattern for black: 1...Kb3 2.Kb1 Rh1#
  { name: 'K+R vs K (black)', fen: '7r/8/8/8/8/2k5/8/K7 b - - 0 1' },
];

function isLegal(state: GameState, move: Move): boolean {
  return generateLegal(state).some(
    (m) => m.from === move.from && m.to === move.to && m.promotion === move.promotion,
  );
}

/** Brute-force check used to validate the test positions themselves. */
function forcesMate(st: GameState, n: number): boolean {
  for (const m of generateLegal(st)) {
    const s1 = applyMove(st, m);
    if (isCheckmate(s1)) return true;
    if (n === 1) continue;
    const replies = generateLegal(s1);
    if (replies.length === 0) continue;
    if (replies.every((r) => forcesMate(applyMove(s1, r), n - 1))) return true;
  }
  return false;
}

describe('AI internals', () => {
  it('internal move generator matches perft reference values', () => {
    expect(perft(Position.fromState(parseFEN(START_FEN)), 4)).toBe(197281);
    expect(perft(Position.fromState(parseFEN(KIWIPETE)), 3)).toBe(97862);
    expect(perft(Position.fromState(parseFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1')), 5)).toBe(674624);
  });

  it('test positions are what they claim to be (brute force)', () => {
    for (const p of MATE_IN_1) expect(forcesMate(parseFEN(p.fen), 1), p.name).toBe(true);
    for (const p of MATE_IN_2) {
      const st = parseFEN(p.fen);
      expect(forcesMate(st, 1), p.name).toBe(false);
      expect(forcesMate(st, 2), p.name).toBe(true);
    }
  });
});

describe('AI: mates', () => {
  const aboveNovice = LEVEL_ORDER.filter((id) => id !== 'novice');

  for (const id of aboveNovice) {
    it(`finds mate in 1 on level ${LEVELS[id].name}`, () => {
      for (const p of MATE_IN_1) {
        const st = parseFEN(p.fen);
        const move = findBestMove(st, id, { rng: seededRandom(1) });
        expect(move, p.name).not.toBeNull();
        expect(isCheckmate(applyMove(st, move!)), `${p.name}: ${moveToSAN(st, move!)}`).toBe(true);
      }
    }, 30000);
  }

  for (const id of ['club', 'expert', 'master'] as const) {
    it(`finds mate in 2 on level ${LEVELS[id].name}`, () => {
      for (const p of MATE_IN_2) {
        const st = parseFEN(p.fen);
        const move = findBestMove(st, id, { rng: seededRandom(2) });
        expect(move, p.name).not.toBeNull();
        expect(isLegal(st, move!)).toBe(true);
        // After our move, every defence must allow mate in 1
        const after = applyMove(st, move!);
        for (const reply of generateLegal(after)) {
          expect(forcesMate(applyMove(after, reply), 1), `${p.name}: ${moveToSAN(st, move!)}`).toBe(true);
        }
        const res = analyzePosition(st, { depth: 4 });
        expect(res.score.type).toBe('mate');
        expect(Math.abs(res.score.value)).toBe(3);
        expect(Math.sign(res.score.value)).toBe(st.turn === 'white' ? 1 : -1);
      }
    }, 30000);
  }

  it('prefers the fastest mate when several mates exist', () => {
    // Q+R vs K: mate in 1 is available, many longer mates too
    const st = parseFEN('k7/8/8/8/8/8/1Q6/1R4K1 w - - 0 1');
    const res = analyzePosition(st, { depth: 6 });
    expect(res.score).toEqual({ type: 'mate', value: 1 });
    expect(isCheckmate(applyMove(st, res.bestMove!))).toBe(true);

    // K+R vs K: mate in 2 (3 plies) even when searched much deeper
    const kr = analyzePosition(parseFEN(MATE_IN_2[1].fen), { depth: 8 });
    expect(kr.score).toEqual({ type: 'mate', value: 3 });
    expect(kr.pv.length).toBe(3);
  });

  it('the losing side delays mate as long as possible', () => {
    // Black to move, White mates next move whatever happens: score = mate in 2 plies
    const st = parseFEN('k7/8/1K6/8/8/8/8/7R b - - 1 1');
    const res = analyzePosition(st, { depth: 6 });
    expect(res.score).toEqual({ type: 'mate', value: 2 });
  });
});

describe('AI: material sanity', () => {
  it('does not give the queen for a pawn', () => {
    // Qxd5?? exd5 loses the queen for a pawn
    const st = parseFEN('4k3/8/4p3/3p4/8/8/8/3QK3 w - - 0 1');
    for (const id of ['club', 'expert'] as const) {
      const move = findBestMove(st, id, { rng: seededRandom(3) })!;
      expect(moveToSAN(st, move)).not.toBe('Qxd5');
    }
    const res = analyzePosition(st, { depth: 4 });
    expect(moveToSAN(st, res.bestMove!)).not.toBe('Qxd5');
  }, 20000);

  it('evaluates the start position close to zero', () => {
    const st = parseFEN(START_FEN);
    expect(Math.abs(evaluate(st))).toBeLessThan(50);
    const res = analyzePosition(st, { depth: 4 });
    expect(res.score.type).toBe('cp');
    expect(Math.abs(res.score.value)).toBeLessThan(50);
  });

  it('a position without the black queen favours White', () => {
    const w = parseFEN('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(evaluate(w)).toBeGreaterThan(700);
    const b = parseFEN('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1');
    expect(evaluate(b)).toBeLessThan(-700); // side-to-move perspective
    const res = analyzePosition(b, { depth: 3 });
    expect(res.score.type).toBe('cp');
    expect(res.score.value).toBeGreaterThan(700); // White's perspective
  });

  it('evaluation does not crash on non-8x8 boards', () => {
    const st = parseFEN('rnbqk1/pppppp/6/6/PPPPPP/RNBQK1 w - - 0 1', 6, 6);
    expect(Number.isFinite(evaluate(st))).toBe(true);
    const res = analyzePosition(st, { depth: 3 });
    expect(res.bestMove).not.toBeNull();
    expect(isLegal(st, res.bestMove!)).toBe(true);
  });
});

describe('AI: limits and determinism', () => {
  it('respects the time limit (analyzePosition, 500 ms)', () => {
    const st = parseFEN(KIWIPETE);
    const t0 = performance.now();
    const res = analyzePosition(st, { timeMs: 500 });
    const elapsed = performance.now() - t0;
    expect(res.bestMove).not.toBeNull();
    expect(elapsed).toBeLessThanOrEqual(500 * 1.2);
  });

  it('respects the time limit of the Master level', () => {
    const st = parseFEN(KIWIPETE);
    const t0 = performance.now();
    const move = findBestMove(st, 'master');
    const elapsed = performance.now() - t0;
    expect(move).not.toBeNull();
    expect(isLegal(st, move!)).toBe(true);
    expect(elapsed).toBeLessThanOrEqual(LEVELS.master.timeMs * 1.2);
  }, 10000);

  it('analyzePosition is deterministic at a fixed depth', () => {
    const st = parseFEN('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
    const strip = (r: ReturnType<typeof analyzePosition>) => ({
      bestMove: r.bestMove && [r.bestMove.from, r.bestMove.to, r.bestMove.promotion],
      score: r.score,
      pv: r.pv.map((m) => [m.from, m.to, m.promotion]),
      depth: r.depth,
      nodes: r.nodes,
      lines: r.lines.map((l) => ({ san: l.san, score: l.score, pv: l.pvSan })),
    });
    const a = strip(analyzePosition(st, { depth: 5, multiPV: 3 }));
    const b = strip(analyzePosition(st, { depth: 5, multiPV: 3 }));
    expect(a).toEqual(b);
    expect(a.lines.length).toBe(3);
    expect(a.depth).toBe(5);
  });

  it('performance report: nodes per second at depth 4 and Master depth', () => {
    const st = parseFEN(START_FEN);
    let res = analyzePosition(st, { depth: 4 }); // warm-up (JIT)
    // A single depth-4 search takes only a few ms, so average over several runs
    const RUNS = 20;
    let totalNodes = 0;
    const t0 = performance.now();
    for (let i = 0; i < RUNS; i++) {
      res = analyzePosition(st, { depth: 4 });
      totalNodes += res.nodes;
    }
    const totalMs = performance.now() - t0;
    const nps = Math.round((totalNodes / totalMs) * 1000);
    const master = analyzePosition(st, { depth: LEVELS.master.depth, timeMs: LEVELS.master.timeMs });
    console.log(
      `[perf] start position depth 4: ${res.nodes} nodes/search, ${RUNS} searches in ${totalMs.toFixed(0)} ms = ${nps} nodes/s; ` +
        `Master (${LEVELS.master.timeMs} ms) reached depth ${master.depth} ` +
        `(${master.nodes} nodes in ${master.timeMs} ms, pv: ${master.lines[0].pvSan.join(' ')})`,
    );
    expect(res.depth).toBe(4);
    expect(master.depth).toBeGreaterThanOrEqual(4);
  }, 10000);
});

describe('AI vs AI (weak levels)', () => {
  it('10 games: every move is legal and every game finishes', () => {
    const fast = (base: LevelConfig): LevelConfig => ({ ...base, timeMs: 200 });
    const levels = [fast(LEVELS.novice), fast(LEVELS.amateur)];
    const results: string[] = [];
    for (let g = 0; g < 10; g++) {
      const rng = seededRandom(1000 + g);
      let st = classicalRuleSet.getInitialState();
      let result = classicalRuleSet.getGameResult(st);
      let plies = 0;
      while (result.type === 'ongoing') {
        // Alternate which level plays White between games
        const lvl = levels[(plies + g) % 2];
        const move = findBestMove(st, lvl, { rng });
        expect(move).not.toBeNull();
        expect(isLegal(st, move!)).toBe(true);
        st = applyMove(st, move!);
        plies++;
        result = classicalRuleSet.getGameResult(st);
        expect(plies).toBeLessThan(1500);
      }
      expect(['checkmate', 'stalemate', 'threefoldRepetition', 'fiftyMoveRule', 'insufficientMaterial']).toContain(
        result.type,
      );
      results.push(`${result.type}${result.winner ? `(${result.winner})` : ''} in ${plies} plies`);
    }
    console.log('[ai-vs-ai] ' + results.join('; '));
  }, 180000);
});
