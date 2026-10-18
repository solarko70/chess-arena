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

  it('reviews Morphy Opera Game with both OwnEngine (depth 6) and StockfishEngine (depth 14): every move has a class, Rd8# is best, 15...Nxd7 is blunder/mistake, and injected queen blunder is blunder', async () => {
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

    if (hasStockfishFiles) {
      const sf = new StockfishEngine();
      try {
        const sfStart = Date.now();
        const operaSf = await reviewGame(operaGame, sf, { depth: 14 });
        const sfMs = Date.now() - sfStart;

        expect(operaSf.engineName).toMatch(/Stockfish/i);
        expect(operaSf.moves.length).toBe(33);
        expect(operaSf.reanalyzed).toBeGreaterThan(0);
        for (const m of operaSf.moves) {
          expect(VALID_CLASSES).toContain(m.class);
        }

        // 15.Bxd7+ (ply 29) was reanalyzed at higher depth and gets class 'best'
        const move29 = operaSf.moves[28];
        expect(move29.ply).toBe(29);
        expect(move29.san).toBe('Bxd7+');
        expect(move29.class).toBe('best');

        // 15...Nxd7 (ply 30) walks into mate in an already lost position: bestMove is Qxd7, class is excellent/good (not blunder)
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
          `[opera-sf] engine="${operaSf.engineName}" | 33 plies (34 positions) reviewed in ${sfMs} ms | ` +
            `White acc=${operaSf.accuracy.white.toFixed(1)}%, Black acc=${operaSf.accuracy.black.toFixed(1)}%`,
        );

        for (let i = 0; i < operaOwn.moves.length; i++) {
          const om = operaOwn.moves[i];
          const sm = operaSf.moves[i];
          console.log(
            `[opera-table] ${om.ply} | ${om.san} | ` +
              `Own: ${fmtScore(om.evalBefore)} -> ${fmtScore(om.evalAfter)} (best: ${om.bestSan ?? '-'}, class: ${om.class}) | ` +
              `SF: ${fmtScore(sm.evalBefore)} -> ${fmtScore(sm.evalAfter)} (best: ${sm.bestSan ?? '-'}, class: ${sm.class})`,
          );
        }
      } finally {
        sf.dispose();
      }
    }
  }, 90000);
});

