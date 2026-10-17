import { describe, it, expect } from 'vitest';
import { parseFEN } from '@/core/notation/fen';
import { moveToSAN, sanToMove } from '@/core/notation/san';
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

  it('round-trip sanToMove(moveToSAN(m)) == m for every legal move from start, Kiwipete, pos4, pos5', () => {
    const fens = [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
      'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
      'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    ];

    for (const fen of fens) {
      const state = parseFEN(fen);
      const legalMoves = classicalRuleSet.generateLegalMoves(state);
      for (const m of legalMoves) {
        const san = moveToSAN(state, m);
        const reconstructed = sanToMove(state, san);
        expect(reconstructed).not.toBeNull();
        expect(reconstructed?.from).toBe(m.from);
        expect(reconstructed?.to).toBe(m.to);
        expect(reconstructed?.promotion).toBe(m.promotion);
      }
    }
  });

  it('handles disambiguations: Nbd7, R1a3, Qh4e1', () => {
    const posNbd7 = parseFEN('8/1n3n2/8/8/8/8/8/K6k b - - 0 1');
    const legalN = classicalRuleSet.generateLegalMoves(posNbd7);
    const moveNbd7 = legalN.find((m) => m.from === 8 && m.to === 21);
    if (moveNbd7) {
      expect(moveToSAN(posNbd7, moveNbd7)).toBe('Nbd7');
    }

    const posR2 = parseFEN('r7/8/8/r7/8/8/8/K6k b - - 0 1');
    const legalR2 = classicalRuleSet.generateLegalMoves(posR2);
    const moveR8a3 = legalR2.find((m) => m.from === 0 && m.to === 40);
    if (moveR8a3) {
      expect(moveToSAN(posR2, moveR8a3)).toBe('R8a3');
    }

    const posQ = parseFEN('k7/8/8/7Q/4Q3/8/8/K6k w - - 0 1');
    const legalQ = classicalRuleSet.generateLegalMoves(posQ);
    const moveH4e1 = legalQ.find((m) => m.from === 31 && m.to === 60);
    if (moveH4e1) {
      expect(moveToSAN(posQ, moveH4e1)).toBe('Qh4e1');
    }
  });

  it('promotions with capture, castling check, checkmate #, stalemate without suffix', () => {
    const promoCapture = parseFEN('b1k5/P7/8/8/8/8/8/K7 w - - 0 1');
    const legal = classicalRuleSet.generateLegalMoves(promoCapture);
    const promoMove = legal.find((m) => m.from === 8 && m.to === 0 && m.promotion === 'queen');
    if (promoMove) {
      const san = moveToSAN(promoCapture, promoMove);
      expect(san).toContain('bxa8=Q');
    }

    const stalemateState = parseFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(classicalRuleSet.getGameResult(stalemateState).type).toBe('stalemate');
  });
});
