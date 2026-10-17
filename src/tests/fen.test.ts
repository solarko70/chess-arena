import { describe, it, expect } from 'vitest';
import { parseFEN, serializeFEN } from '@/core/notation/fen';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('FEN round-trip', () => {
  it('serializes parseFEN(START_FEN) back to START_FEN', () => {
    const state = parseFEN(START_FEN);
    expect(serializeFEN(state)).toBe(START_FEN);
  });

  it('round-trips after 1.e4', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const state = parseFEN(fen);
    expect(serializeFEN(state)).toBe(fen);
  });

  it('round-trips after 1.d4', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1';
    const state = parseFEN(fen);
    expect(serializeFEN(state)).toBe(fen);
  });

  it('round-trips Kiwipete position', () => {
    const fen = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
    const state = parseFEN(fen);
    expect(serializeFEN(state)).toBe(fen);
  });

  it('round-trips a position with no castling rights', () => {
    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    const state = parseFEN(fen);
    expect(serializeFEN(state)).toBe(fen);
  });

  it('parses black to move', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const state = parseFEN(fen);
    expect(state.turn).toBe('black');
  });

  it('parses empty board', () => {
    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    const state = parseFEN(fen);
    for (const sq of state.board.pieces) {
      expect(sq).toBeNull();
    }
  });

  it('round-trips en passant square present', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 3';
    const state = parseFEN(fen);
    expect(state.enPassantSquare).not.toBeNull();
    expect(serializeFEN(state)).toBe(fen);
  });

  it('round-trips halfmove clock', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const state = parseFEN(fen);
    expect(state.halfMoveClock).toBe(0);
    expect(state.fullMoveNumber).toBe(1);
  });
});
