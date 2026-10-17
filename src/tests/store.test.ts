import { describe, it, expect, beforeEach } from 'vitest';
import { ChessStore } from '@/state/store';
import { parseFEN } from '@/core';

describe('ChessStore', () => {
  let store: ChessStore;

  beforeEach(() => {
    store = new ChessStore();
  });

  it('initializes with default starting position', () => {
    const state = store.getState();
    expect(state.turn).toBe('white');
    expect(state.history.length).toBe(0);
    expect(store.isFlipped()).toBe(false);
    expect(store.getSelectedSquare()).toBeNull();
  });

  it('executes moves through store and updates state and history', () => {
    // 1. e4 (from e2: x=4, y=6 -> 6*8+4 = 52 to e4: x=4, y=4 -> 4*8+4 = 36)
    const e2 = store.coordsToSquare(4, 6);
    const e4 = store.coordsToSquare(4, 4);

    const success = store.makeMove(e2, e4);
    expect(success).toBe(true);

    const state = store.getState();
    expect(state.turn).toBe('black');
    expect(state.history.length).toBe(1);
    expect(state.board.pieces[e4]?.type).toBe('pawn');
    expect(state.board.pieces[e2]).toBeNull();
  });

  it('supports undoing moves', () => {
    const e2 = store.coordsToSquare(4, 6);
    const e4 = store.coordsToSquare(4, 4);

    store.makeMove(e2, e4);
    expect(store.getState().history.length).toBe(1);

    const undoSuccess = store.undo();
    expect(undoSuccess).toBe(true);

    const state = store.getState();
    expect(state.turn).toBe('white');
    expect(state.history.length).toBe(0);
    expect(state.board.pieces[e2]?.type).toBe('pawn');
    expect(state.board.pieces[e4]).toBeNull();
  });

  it('handles pawn promotion and pending promotion state', () => {
    // White pawn on a7 ready to promote on a8
    // rank 8: 1k6, rank 7: P7, ...
    const promoFen = '1k6/P7/8/8/8/8/8/K7 w - - 0 1';
    store.newGame(parseFEN(promoFen));

    const a7 = store.coordsToSquare(0, 1);
    const a8 = store.coordsToSquare(0, 0);

    // Make move without specifying promotion piece -> pendingPromotion should be set
    const moveResult = store.makeMove(a7, a8);
    expect(moveResult).toBe(true);
    expect(store.getPendingPromotion()).toEqual({ from: a7, to: a8 });

    // Choose Queen promotion
    const finalResult = store.makeMove(a7, a8, 'queen');
    expect(finalResult).toBe(true);
    expect(store.getPendingPromotion()).toBeNull();

    const state = store.getState();
    expect(state.board.pieces[a8]?.type).toBe('queen');
    expect(state.board.pieces[a8]?.color).toBe('white');
  });

  it('reports checkmate properly', () => {
    // Scholar's Mate final position
    const scholarsMateFen = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
    store.newGame(parseFEN(scholarsMateFen));

    const result = store.getGameResult();
    expect(result.type).toBe('checkmate');
    expect(result.winner).toBe('white');
    expect(store.isInCheck()).toBe(true);
  });

  it('reports stalemate properly', () => {
    // Stalemate position: White king at h6, white queen at g6, black king at h8, black turn
    const stalemateFen = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
    store.newGame(parseFEN(stalemateFen));

    const result = store.getGameResult();
    expect(result.type).toBe('stalemate');
    expect(store.isInCheck()).toBe(false);
  });

  it('handles board flipping and square selection', () => {
    expect(store.isFlipped()).toBe(false);
    store.toggleFlip();
    expect(store.isFlipped()).toBe(true);

    store.selectSquare(12);
    expect(store.getSelectedSquare()).toBe(12);
  });
});
