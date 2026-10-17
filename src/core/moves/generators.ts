import type { Color, GameState, Move, Piece } from '../types';
import { toCoords, toSquare, inBounds } from '../board';
import { PIECE_DEFS } from '../pieces';
import { copyCastling } from './apply';

/**
 * Generate pseudo-legal moves for the side to move.
 * Currently handles: slider/jumper pieces via PIECE_DEFS,
 * pawn pushes (single + double from start rank), pawn captures.
 * Does NOT yet handle: castling, en passant, promotion.
 */
export function generatePseudoLegal(state: GameState): Move[] {
  const moves: Move[] = [];
  const { board, castlingRights, enPassantSquare, halfMoveClock } = state;
  const { width, height, pieces } = board;
  const color = state.turn;
  const enemy: Color = color === 'white' ? 'black' : 'white';

  const pawnDir = color === 'white' ? -1 : 1;
  const startRank = color === 'white' ? height - 2 : 1;

  for (let sq = 0; sq < pieces.length; sq++) {
    const piece = pieces[sq];
    if (piece === null || piece.color !== color) continue;

    const { x, y } = toCoords(sq, width);

    // ── Pawn ──────────────────────────────────────────────────────────────
    if (piece.type === 'pawn') {
      // Single push
      const fy = y + pawnDir;
      if (inBounds(x, fy, width, height)) {
        const fSq = toSquare(x, fy, width);
        if (pieces[fSq] === null) {
          pushMove(moves, sq, fSq, piece, undefined, state);

          // Double push from start rank
          if (y === startRank) {
            const dy = y + pawnDir * 2;
            const dSq = toSquare(x, dy, width);
            if (pieces[dSq] === null) {
              pushMove(moves, sq, dSq, piece, undefined, state);
            }
          }
        }
      }

      // Captures (diagonal)
      for (const dx of [-1, 1]) {
        const cx = x + dx;
        const cy = y + pawnDir;
        if (!inBounds(cx, cy, width, height)) continue;
        const cSq = toSquare(cx, cy, width);
        const target = pieces[cSq];
        if (target !== null && target.color === enemy) {
          pushMove(moves, sq, cSq, piece, target, state);
        }
      }
      continue;
    }

    // ── Regular pieces via PIECE_DEFS ─────────────────────────────────────
    const def = PIECE_DEFS[piece.type];

    if (def.slider) {
      for (const [dx, dy] of def.directions) {
        let cx = x + dx;
        let cy = y + dy;
        while (inBounds(cx, cy, width, height)) {
          const tSq = toSquare(cx, cy, width);
          const target = pieces[tSq];
          if (target === null) {
            pushMove(moves, sq, tSq, piece, undefined, state);
          } else {
            if (target.color === enemy) {
              pushMove(moves, sq, tSq, piece, target, state);
            }
            break;
          }
          cx += dx;
          cy += dy;
        }
      }
    } else {
      // Jumper (knight, king)
      for (const [dx, dy] of def.directions) {
        const cx = x + dx;
        const cy = y + dy;
        if (!inBounds(cx, cy, width, height)) continue;
        const tSq = toSquare(cx, cy, width);
        const target = pieces[tSq];
        if (target === null || target.color === enemy) {
          pushMove(moves, sq, tSq, piece, target ?? undefined, state);
        }
      }
    }
  }

  return moves;
}

function pushMove(
  moves: Move[],
  from: number,
  to: number,
  piece: Piece,
  captured: Piece | undefined,
  state: GameState,
): void {
  moves.push({
    from,
    to,
    piece,
    captured,
    prevCastling: copyCastling(state.castlingRights),
    prevEpSquare: state.enPassantSquare,
    prevHalfmove: state.halfMoveClock,
  });
}
