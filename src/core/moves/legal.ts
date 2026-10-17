import type { Board, Color, GameState, Move, Square } from '../types';
import { inBounds, toCoords, toSquare } from '../board';
import { PIECE_DEFS } from '../pieces';
import { generatePseudoLegal } from './generators';
import { applyMove } from './apply';

/**
 * Checks whether a given square is attacked by any piece of the specified color.
 */
export function isSquareAttacked(board: Board, sq: Square, byColor: Color): boolean {
  const { width, height, pieces } = board;
  const target = toCoords(sq, width);

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p === null || p.color !== byColor) continue;
    const c = toCoords(i, width);

    if (p.type === 'pawn') {
      const dir = byColor === 'white' ? -1 : 1;
      if (c.y + dir === target.y && Math.abs(c.x - target.x) === 1) return true;
      continue;
    }

    const def = PIECE_DEFS[p.type];
    if (def.slider) {
      for (const [dx, dy] of def.directions) {
        let cx = c.x + dx;
        let cy = c.y + dy;
        while (inBounds(cx, cy, width, height)) {
          if (cx === target.x && cy === target.y) return true;
          if (pieces[toSquare(cx, cy, width)] !== null) break;
          cx += dx;
          cy += dy;
        }
      }
    } else {
      for (const [dx, dy] of def.directions) {
        if (c.x + dx === target.x && c.y + dy === target.y) return true;
      }
    }
  }
  return false;
}

/**
 * Checks whether the king of the given color is currently in check.
 */
export function isInCheck(board: Board, color: Color): boolean {
  const { pieces } = board;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p !== null && p.type === 'king' && p.color === color) {
      return isSquareAttacked(board, i, color === 'white' ? 'black' : 'white');
    }
  }
  return false;
}

/**
 * Filters pseudo-legal moves ensuring that the moving side's king is not left in check.
 */
export function generateLegal(state: GameState): Move[] {
  const pseudoMoves = generatePseudoLegal(state);
  return pseudoMoves.filter((m) => {
    const nextState = applyMove(state, m);
    return !isInCheck(nextState.board, state.turn);
  });
}

/**
 * Checks whether the side whose turn it is has no legal moves and is in check.
 */
export function isCheckmate(state: GameState): boolean {
  return isInCheck(state.board, state.turn) && generateLegal(state).length === 0;
}

/**
 * Checks whether the side whose turn it is has no legal moves and is NOT in check.
 */
export function isStalemate(state: GameState): boolean {
  return !isInCheck(state.board, state.turn) && generateLegal(state).length === 0;
}
