import { describe, it, expect } from 'vitest';
import { parseFEN } from '@/core/notation/fen';
import { generateLegal } from '@/core/moves/legal';
import { applyMove } from '@/core/moves/apply';
import type { GameState } from '@/core/types';

function perft(state: GameState, depth: number): number {
  if (depth === 0) return 1;
  const moves = generateLegal(state);
  if (depth === 1) return moves.length;
  let count = 0;
  for (const m of moves) {
    count += perft(applyMove(state, m), depth - 1);
  }
  return count;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('perft – start position (no castling/ep/promo yet)', () => {
  it('depth 1 = 20', () => {
    const state = parseFEN(START_FEN);
    expect(perft(state, 1)).toBe(20);
  });

  it('depth 2 = 400', () => {
    const state = parseFEN(START_FEN);
    expect(perft(state, 2)).toBe(400);
  });

  it('depth 3 = 8902', () => {
    const state = parseFEN(START_FEN);
    expect(perft(state, 3)).toBe(8902);
  });

  it(
    'depth 4 = 197281',
    () => {
      const state = parseFEN(START_FEN);
      expect(perft(state, 4)).toBe(197281);
    },
    60000,
  );
});
