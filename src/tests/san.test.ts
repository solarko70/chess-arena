import { describe, it, expect } from 'vitest';
import { parseFEN } from '@/core/notation/fen';
import { moveToSAN } from '@/core/notation/san';
import { exportPGN } from '@/core/notation/pgn';
import { classicalRuleSet } from '@/core/rules/classical';

describe('SAN and PGN Export', () => {
  it('exports scholar s mate sequence to SAN correctly', () => {
    // 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
    let state = classicalRuleSet.getInitialState();
    const sanList: string[] = [];

    const movesNotation = [
      { from: 'e2', to: 'e4' },
      { from: 'e7', to: 'e5' },
      { from: 'd1', to: 'h5' },
      { from: 'b8', to: 'c6' },
      { from: 'f1', to: 'c4' },
      { from: 'g8', to: 'f6' },
      { from: 'h5', to: 'f7' },
    ];

    for (const alg of movesNotation) {
      const fromFile = alg.from.charCodeAt(0) - 97;
      const fromRank = parseInt(alg.from[1], 10);
      const fromSq = (8 - fromRank) * 8 + fromFile;

      const toFile = alg.to.charCodeAt(0) - 97;
      const toRank = parseInt(alg.to[1], 10);
      const toSq = (8 - toRank) * 8 + toFile;

      const legal = classicalRuleSet.generateLegalMoves(state);
      const move = legal.find((m) => m.from === fromSq && m.to === toSq);
      if (!move) throw new Error(`Move ${alg.from}-${alg.to} not found`);

      sanList.push(moveToSAN(state, move));
      state = classicalRuleSet.applyMove(state, move);
    }

    expect(sanList).toEqual(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#']);

    const pgn = exportPGN(state, { Result: '1-0' });
    expect(pgn).toContain('1. e4 e5');
    expect(pgn).toContain('4. Qxf7#');
    expect(pgn).toContain('1-0');
  });

  it('handles castling and check notation', () => {
    // Position with castling available
    const state = parseFEN('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    const legal = classicalRuleSet.generateLegalMoves(state);
    const kingsideCastle = legal.find((m) => m.castling === 'kingside');
    if (kingsideCastle) {
      expect(moveToSAN(state, kingsideCastle)).toBe('O-O');
    }
  });
});
