import { describe, it, expect } from 'vitest';
import { classicalRuleSet, parsePGN, exportPGN, sanToMove } from '@/core';

describe('Morphy Opera Game (1858) PGN Test', () => {
  it('parses, verifies checkmate, and round-trips Morphy Opera game', () => {
    const morphySanMoves = [
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
      'Rd8#'
    ];

    let state = classicalRuleSet.getInitialState();
    for (const san of morphySanMoves) {
      const move = sanToMove(state, san);
      if (!move) throw new Error(`Move ${san} not found`);
      state = classicalRuleSet.applyMove(state, move);
    }

    const result = classicalRuleSet.getGameResult(state);
    expect(result.type).toBe('checkmate');
    expect(result.winner).toBe('white');

    const pgn = exportPGN(state, {
      Event: 'Opera Game',
      Site: 'Paris Opera',
      Date: '1858.??.??',
      White: 'Paul Morphy',
      Black: 'Duke Karl / Count Isouard',
      Result: '1-0',
    });

    const parsed = parsePGN(pgn);
    expect(parsed.headers['White']).toBe('Paul Morphy');
    expect(parsed.state.history.length).toBe(morphySanMoves.length);
    expect(exportPGN(parsed.state)).toBe(exportPGN(state));
  });
});
