// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { classicalRuleSet, sanToMove, applyMove } from '@/core';
import type { GameState } from '@/core';
import type { Score } from '@/ai';
import {
  OwnEngine,
  StockfishEngine,
  reviewGame,
  findStockfishLiteSingleInDir,
  type MoveClass,
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

function fmtScore(s: Score): string {
  if (s.type === 'mate') {
    if (s.value === 0) return 'M0';
    return `M${s.value > 0 ? '+' : ''}${s.value}`;
  }
  return `${s.value >= 0 ? '+' : ''}${s.value}`;
}

describe('Morphy Opera Game (1858) full review with OwnEngine and StockfishEngine (slow)', () => {
  const publicDir = path.resolve(process.cwd(), 'public', 'stockfish');
  const hasStockfishFiles =
    fs.existsSync(publicDir) &&
    findStockfishLiteSingleInDir(fs.readdirSync(publicDir)) !== null;

  it('OwnEngine: reviews Morphy game, 15...Nxd7 is mistake, queen blunder is blunder', async () => {
    const operaGame = buildGameFromSan(MORPHY_SAN_MOVES);
    const own = new OwnEngine();

    const t0 = Date.now();
    const operaOwn = await reviewGame(operaGame, own, { depth: 6 });
    const ownMs = Date.now() - t0;

    expect(operaOwn.engineName).toBe('OwnEngine');
    expect(operaOwn.moves.length).toBe(33);
    for (const m of operaOwn.moves) {
      expect(VALID_CLASSES).toContain(m.class);
    }
    // 15...Nxd7 (ply 30) for OwnEngine is 'mistake'
    const move30Own = operaOwn.moves[29];
    expect(move30Own.san).toBe('Nxd7');
    expect(move30Own.class).toBe('mistake');

    // Final move 17.Rd8# is 'best'
    expect(operaOwn.moves[operaOwn.moves.length - 1].san).toBe('Rd8#');
    expect(operaOwn.moves[operaOwn.moves.length - 1].class).toBe('best');
    expect(operaOwn.reanalyzed).toBe(0);

    console.log(
      `[opera-own] engine="${operaOwn.engineName}" | 33 plies (34 positions) reviewed in ${ownMs} ms | ` +
        `White acc=${operaOwn.accuracy.white.toFixed(1)}%, Black acc=${operaOwn.accuracy.black.toFixed(1)}%`,
    );

    // Inject an artificial queen blunder directly into Morphy's Opera Game:
    // After 7. Qb3 Qe7, play 8. Qb6?? axb6 (losing the queen)
    const stateBefore8 = buildGameFromSan(MORPHY_SAN_MOVES.slice(0, 14));
    const blunderMove = sanToMove(stateBefore8, 'Qb6')!;
    const stateAfter8 = applyMove(stateBefore8, blunderMove);
    const blunderReview = await reviewGame([stateBefore8, stateAfter8], own, { depth: 6 });
    expect(blunderReview.moves[0].san).toBe('Qb6');
    expect(blunderReview.moves[0].class).toBe('blunder');
  }, 60000);

  it('Stockfish default (16): Morphy review, 15...Nxd7 not blunder, Rd8# is best', async () => {
    if (!hasStockfishFiles) return;

    const operaGame = buildGameFromSan(MORPHY_SAN_MOVES);
    const sf = new StockfishEngine();
    try {
      const sfStart = Date.now();
      const operaSf = await reviewGame(operaGame, sf);
      const sfMs = Date.now() - sfStart;

      expect(operaSf.engineName).toMatch(/Stockfish/i);
      expect(operaSf.moves.length).toBe(33);
      for (const m of operaSf.moves) {
        expect(VALID_CLASSES).toContain(m.class);
      }

      // 15.Bxd7+ (ply 29) is 'best'
      const move29 = operaSf.moves[28];
      expect(move29.ply).toBe(29);
      expect(move29.san).toBe('Bxd7+');
      expect(move29.class).toBe('best');

      // 15...Nxd7 (ply 30) for Stockfish is NOT blunder: bestMove is Qxd7, class is excellent/good
      const move30 = operaSf.moves[29];
      expect(move30.ply).toBe(30);
      expect(move30.san).toBe('Nxd7');
      expect(move30.bestSan).toBe('Qxd7');
      expect(['excellent', 'good']).toContain(move30.class);
      expect(move30.class).not.toBe('blunder');

      // Final move 17.Rd8# (ply 33) must have class 'best'
      const move33 = operaSf.moves[32];
      expect(move33.ply).toBe(33);
      expect(move33.san).toBe('Rd8#');
      expect(move33.class).toBe('best');

      console.log(
        `[opera-sf-default-16] time=${sfMs} ms | ` +
          `White acc=${operaSf.accuracy.white.toFixed(1)}%, Black acc=${operaSf.accuracy.black.toFixed(1)}% | ` +
          `reanalyzed=${operaSf.reanalyzed}`,
      );

      for (let i = 0; i < operaSf.moves.length; i++) {
        const sm = operaSf.moves[i];
        console.log(
          `[opera-table-sf-16] ${sm.ply} | ${sm.san} | ` +
            `SF(16): ${fmtScore(sm.evalBefore)} -> ${fmtScore(sm.evalAfter)} (best: ${sm.bestSan ?? '-'}, class: ${sm.class})`,
        );
      }
    } finally {
      sf.dispose();
    }
  }, 60000);

  it('Stockfish deep (20): Morphy review, 15...Nxd7 not blunder, Rd8# is best', async () => {
    if (!hasStockfishFiles) return;

    const operaGame = buildGameFromSan(MORPHY_SAN_MOVES);
    const sf = new StockfishEngine();
    try {
      const deepStart = Date.now();
      const operaSfDeep = await reviewGame(operaGame, sf, { mode: 'deep' });
      const deepMs = Date.now() - deepStart;

      console.log(
        `[opera-sf-deep-20] time=${deepMs} ms | ` +
          `White acc=${operaSfDeep.accuracy.white.toFixed(1)}%, Black acc=${operaSfDeep.accuracy.black.toFixed(1)}% | ` +
          `reanalyzed=${operaSfDeep.reanalyzed}`,
      );

      expect(operaSfDeep.engineName).toMatch(/Stockfish/i);
      expect(operaSfDeep.moves.length).toBe(33);
      for (const m of operaSfDeep.moves) {
        expect(VALID_CLASSES).toContain(m.class);
      }

      const move29Deep = operaSfDeep.moves[28];
      expect(move29Deep.san).toBe('Bxd7+');
      expect(['best', 'excellent']).toContain(move29Deep.class);

      const move30Deep = operaSfDeep.moves[29];
      expect(move30Deep.san).toBe('Nxd7');
      expect(move30Deep.bestSan).toBe('Qxd7');
      expect(['excellent', 'good']).toContain(move30Deep.class);
      expect(move30Deep.class).not.toBe('blunder');

      const move33Deep = operaSfDeep.moves[32];
      expect(move33Deep.san).toBe('Rd8#');
      expect(move33Deep.class).toBe('best');
    } finally {
      sf.dispose();
    }
  }, 300000);
});

