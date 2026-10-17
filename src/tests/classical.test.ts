import { describe, it, expect } from 'vitest';
import { parseFEN, serializeFEN } from '@/core/notation/fen';
import { classicalRuleSet, isInsufficientMaterial, isThreefoldRepetition, isFiftyMoveRule } from '@/core/rules/classical';
import { isInCheck, isCheckmate, isStalemate } from '@/core/moves/legal';
import type { GameState } from '@/core/types';

describe('Classical rules - checkmate, stalemate, check', () => {
  it("Scholar's Mate (детский мат)", () => {
    // 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
    // Final position after 4. Qxf7#
    const fen = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
    const state = parseFEN(fen);

    expect(isInCheck(state.board, 'black')).toBe(true);
    expect(isInCheck(state.board, 'white')).toBe(false);
    expect(isCheckmate(state)).toBe(true);
    expect(isStalemate(state)).toBe(false);

    const result = classicalRuleSet.getGameResult(state);
    expect(result.type).toBe('checkmate');
    expect(result.winner).toBe('white');
  });

  it("Boden's Mate (мат Бодена)", () => {
    // Classic Boden's mate: White bishops checkmating black king trapped by own pieces
    // Diagonal a6-c8 is clear when b7 pawn is removed
    const mateFen = '2kr3r/p2n1pp1/B1p1p3/8/3P1B2/8/PPP2PP1/R4RK1 b - - 0 1';
    const state = parseFEN(mateFen);

    expect(isInCheck(state.board, 'black')).toBe(true);
    expect(isCheckmate(state)).toBe(true);

    const result = classicalRuleSet.getGameResult(state);
    expect(result.type).toBe('checkmate');
    expect(result.winner).toBe('white');
  });

  it('Stalemate (пат)', () => {
    // White king at h6, white queen at g6, black king at h8, black turn
    const fen = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
    const state = parseFEN(fen);

    expect(isInCheck(state.board, 'black')).toBe(false);
    expect(isCheckmate(state)).toBe(false);
    expect(isStalemate(state)).toBe(true);

    const result = classicalRuleSet.getGameResult(state);
    expect(result.type).toBe('stalemate');
  });

  it('Check without mate (шах без мата)', () => {
    // Black Queen on e4 checking White King on e1, White can block or move king
    const checkFen = 'rnb1kbnr/pppp1ppp/8/8/4q3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
    const state = parseFEN(checkFen);

    expect(isInCheck(state.board, 'white')).toBe(true);
    expect(isInCheck(state.board, 'black')).toBe(false);
    expect(isCheckmate(state)).toBe(false);
    expect(isStalemate(state)).toBe(false);

    const result = classicalRuleSet.getGameResult(state);
    expect(result.type).toBe('ongoing');
  });
});

describe('Classical rules - draw conditions', () => {
  it('Threefold repetition (троекратное повторение)', () => {
    // Play knights back and forth:
    // 1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8
    let state = classicalRuleSet.getInitialState();

    function findAndApply(fromAlg: string, toAlg: string): void {
      const fromFile = fromAlg.charCodeAt(0) - 97;
      const fromRank = parseInt(fromAlg[1], 10);
      const fromSq = (8 - fromRank) * 8 + fromFile;

      const toFile = toAlg.charCodeAt(0) - 97;
      const toRank = parseInt(toAlg[1], 10);
      const toSq = (8 - toRank) * 8 + toFile;

      const moves = classicalRuleSet.generateLegalMoves(state);
      const move = moves.find((m) => m.from === fromSq && m.to === toSq);
      if (!move) throw new Error(`Move ${fromAlg}-${toAlg} not found!`);
      state = classicalRuleSet.applyMove(state, move);
    }

    // 1. Nf3 Nf6
    findAndApply('g1', 'f3');
    findAndApply('g8', 'f6');
    // 2. Ng1 Ng8 (position 2)
    findAndApply('f3', 'g1');
    findAndApply('f6', 'g8');
    expect(isThreefoldRepetition(state)).toBe(false);

    // 3. Nf3 Nf6
    findAndApply('g1', 'f3');
    findAndApply('g8', 'f6');
    // 4. Ng1 Ng8 (position 3 -> threefold repetition reached!)
    findAndApply('f3', 'g1');
    findAndApply('f6', 'g8');

    expect(isThreefoldRepetition(state)).toBe(true);
    expect(classicalRuleSet.getGameResult(state).type).toBe('threefoldRepetition');
  });

  it('Fifty-move rule (правило 50 ходов)', () => {
    // 100 half-moves without pawn moves or captures
    const fen = '8/8/8/4k3/8/4K3/8/8 w - - 99 50';
    let state = parseFEN(fen);
    expect(isFiftyMoveRule(state)).toBe(false);

    // King moves -> halfmove becomes 100
    const moves = classicalRuleSet.generateLegalMoves(state);
    state = classicalRuleSet.applyMove(state, moves[0]);

    expect(state.halfMoveClock).toBe(100);
    expect(isFiftyMoveRule(state)).toBe(true);
    expect(classicalRuleSet.getGameResult(state).type).toBe('fiftyMoveRule');
  });

  describe('Insufficient material (недостаточный материал)', () => {
    it('K vs K', () => {
      const state = parseFEN('8/8/8/4k3/8/4K3/8/8 w - - 0 1');
      expect(isInsufficientMaterial(state)).toBe(true);
      expect(classicalRuleSet.getGameResult(state).type).toBe('insufficientMaterial');
    });

    it('K+B vs K', () => {
      const state = parseFEN('8/8/8/4k3/8/4K3/5B2/8 w - - 0 1');
      expect(isInsufficientMaterial(state)).toBe(true);
      expect(classicalRuleSet.getGameResult(state).type).toBe('insufficientMaterial');
    });

    it('K+N vs K', () => {
      const state = parseFEN('8/8/8/4k3/8/4K3/5n2/8 w - - 0 1');
      expect(isInsufficientMaterial(state)).toBe(true);
      expect(classicalRuleSet.getGameResult(state).type).toBe('insufficientMaterial');
    });

    it('K+B vs K+B same color bishops', () => {
      // White bishop on c1 (dark square: (2+7)%2=1)
      // Black bishop on f8 (dark square: (5+0)%2=1)
      const sameColor = parseFEN('5b2/8/8/4k3/8/4K3/8/2B5 w - - 0 1');
      expect(isInsufficientMaterial(sameColor)).toBe(true);
      expect(classicalRuleSet.getGameResult(sameColor).type).toBe('insufficientMaterial');
    });

    it('K+B vs K+B opposite color bishops (sufficient)', () => {
      // White bishop on c1 (dark square)
      // Black bishop on c8 (light square: (2+0)%2=0)
      const oppositeColor = parseFEN('2b5/8/8/4k3/8/4K3/8/2B5 w - - 0 1');
      expect(isInsufficientMaterial(oppositeColor)).toBe(false);
      expect(classicalRuleSet.getGameResult(oppositeColor).type).toBe('ongoing');
    });

    it('K+P vs K (sufficient)', () => {
      const pawnState = parseFEN('8/8/8/4k3/8/4K3/4P3/8 w - - 0 1');
      expect(isInsufficientMaterial(pawnState)).toBe(false);
      expect(classicalRuleSet.getGameResult(pawnState).type).toBe('ongoing');
    });
  });
});

describe('Round-trip applyMove + undoMove (depth 3)', () => {
  function testRoundTrip(initialFen: string, depth: number): void {
    const initialState = parseFEN(initialFen);
    const expectedFen = serializeFEN(initialState);
    const expectedPosHistory = [...initialState.positionHistory];

    function recurse(state: GameState, currentDepth: number): void {
      if (currentDepth === 0) return;
      const moves = classicalRuleSet.generateLegalMoves(state);

      for (const m of moves) {
        const fenBefore = serializeFEN(state);
        const posHistoryBefore = [...state.positionHistory];

        const next = classicalRuleSet.applyMove(state, m);
        recurse(next, currentDepth - 1);
        const undone = classicalRuleSet.undoMove(next);

        expect(serializeFEN(undone)).toBe(fenBefore);
        expect(undone.positionHistory).toEqual(posHistoryBefore);
      }
    }

    recurse(initialState, depth);
    expect(serializeFEN(initialState)).toBe(expectedFen);
    expect(initialState.positionHistory).toEqual(expectedPosHistory);
  }

  it(
    'Round-trip start position (depth 3)',
    () => {
      testRoundTrip('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 3);
    },
    60000,
  );

  it(
    'Round-trip Kiwipete (depth 3)',
    () => {
      testRoundTrip('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3);
    },
    60000,
  );
});

describe('Specific edge cases and rules validation', () => {
  it('pawn move and capture reset 50-move clock, normal move does not', () => {
    let state = parseFEN('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 50 25');
    expect(state.halfMoveClock).toBe(50);

    const moves = classicalRuleSet.generateLegalMoves(state);
    const knightMove = moves.find((m) => m.piece.type === 'knight');
    if (knightMove) {
      state = classicalRuleSet.applyMove(state, knightMove);
      expect(state.halfMoveClock).toBe(51);
      state = classicalRuleSet.undoMove(state);
    }

    const pawnMove = moves.find((m) => m.piece.type === 'pawn');
    if (pawnMove) {
      state = classicalRuleSet.applyMove(state, pawnMove);
      expect(state.halfMoveClock).toBe(0);
    }
  });

  it('same board setup with different castling rights is not a repetition', () => {
    const s1 = parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const s2 = parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w K - 0 1');
    expect(s1.positionHistory[0]).not.toBe(s2.positionHistory[0]);
  });

  it('repetition is reset across irreversible moves (capture or pawn move)', () => {
    let state = classicalRuleSet.getInitialState();

    function findAndApply(fromAlg: string, toAlg: string): void {
      const fromFile = fromAlg.charCodeAt(0) - 97;
      const fromRank = parseInt(fromAlg[1], 10);
      const fromSq = (8 - fromRank) * 8 + fromFile;

      const toFile = toAlg.charCodeAt(0) - 97;
      const toRank = parseInt(toAlg[1], 10);
      const toSq = (8 - toRank) * 8 + toFile;

      const moves = classicalRuleSet.generateLegalMoves(state);
      const move = moves.find((m) => m.from === fromSq && m.to === toSq);
      if (!move) throw new Error(`Move ${fromAlg}-${toAlg} not found!`);
      state = classicalRuleSet.applyMove(state, move);
    }

    findAndApply('g1', 'f3');
    findAndApply('g8', 'f6');
    findAndApply('f3', 'g1');
    findAndApply('f6', 'g8');

    const pawnMove = classicalRuleSet.generateLegalMoves(state).find((m) => m.piece.type === 'pawn');
    if (pawnMove) {
      state = classicalRuleSet.applyMove(state, pawnMove);
      expect(state.positionHistory.length).toBe(1);
    }
  });

  it('checkmate on 100th half-move takes precedence over fifty-move draw', () => {
    const fen = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 100 20';
    const state = parseFEN(fen);

    expect(isCheckmate(state)).toBe(true);
    const result = classicalRuleSet.getGameResult(state);
    expect(result.type).toBe('checkmate');
    expect(result.winner).toBe('white');
  });

  it('K+B vs K+N and K+N+N vs K are NOT insufficient material', () => {
    const kbKn = parseFEN('8/8/8/4k3/4b3/4K3/4n3/8 w - - 0 1');
    expect(isInsufficientMaterial(kbKn)).toBe(false);

    const knn = parseFEN('8/8/8/4k3/4nn2/4K3/8/8 w - - 0 1');
    expect(isInsufficientMaterial(knn)).toBe(false);
  });
});
