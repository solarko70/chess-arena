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
const KIWIPETE_FEN = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
const POS3_FEN = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';
const POS4_FEN = 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1';
const POS5_FEN = 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8';

describe('perft – start position', () => {
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

describe('perft – Kiwipete', () => {
  it('depth 1 = 48', () => {
    const state = parseFEN(KIWIPETE_FEN);
    expect(perft(state, 1)).toBe(48);
  });

  it('depth 2 = 2039', () => {
    const state = parseFEN(KIWIPETE_FEN);
    expect(perft(state, 2)).toBe(2039);
  });

  it(
    'depth 3 = 97862',
    () => {
      const state = parseFEN(KIWIPETE_FEN);
      expect(perft(state, 3)).toBe(97862);
    },
    60000,
  );
});

describe('perft – Position 3', () => {
  it('depth 1 = 14', () => {
    const state = parseFEN(POS3_FEN);
    expect(perft(state, 1)).toBe(14);
  });

  it('depth 2 = 191', () => {
    const state = parseFEN(POS3_FEN);
    expect(perft(state, 2)).toBe(191);
  });

  it('depth 3 = 2812', () => {
    const state = parseFEN(POS3_FEN);
    expect(perft(state, 3)).toBe(2812);
  });

  it(
    'depth 4 = 43238',
    () => {
      const state = parseFEN(POS3_FEN);
      expect(perft(state, 4)).toBe(43238);
    },
    60000,
  );
});

describe('perft – Position 4', () => {
  it('depth 1 = 6', () => {
    const state = parseFEN(POS4_FEN);
    expect(perft(state, 1)).toBe(6);
  });

  it('depth 2 = 264', () => {
    const state = parseFEN(POS4_FEN);
    expect(perft(state, 2)).toBe(264);
  });

  it('depth 3 = 9467', () => {
    const state = parseFEN(POS4_FEN);
    expect(perft(state, 3)).toBe(9467);
  });

  it(
    'depth 4 = 422333',
    () => {
      const state = parseFEN(POS4_FEN);
      expect(perft(state, 4)).toBe(422333);
    },
    60000,
  );
});

describe('perft – Position 5', () => {
  it('depth 1 = 44', () => {
    const state = parseFEN(POS5_FEN);
    expect(perft(state, 1)).toBe(44);
  });

  it('depth 2 = 1486', () => {
    const state = parseFEN(POS5_FEN);
    expect(perft(state, 2)).toBe(1486);
  });

  it(
    'depth 3 = 62379',
    () => {
      const state = parseFEN(POS5_FEN);
      expect(perft(state, 3)).toBe(62379);
    },
    60000,
  );
});

