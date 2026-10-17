import type { GameState, Move, PieceType } from '../types';
import { toCoords } from '../board';
import { applyMove } from '../moves/apply';
import { generateLegal, isCheckmate, isInCheck } from '../moves/legal';

const PIECE_LETTERS: Record<PieceType, string> = {
  pawn: '',
  knight: 'N',
  bishop: 'B',
  rook: 'R',
  queen: 'Q',
  king: 'K',
};

function squareToAlg(sq: number, width: number, height: number): string {
  const { x, y } = toCoords(sq, width);
  const fileChar = String.fromCharCode(97 + x);
  const rankNum = height - y;
  return `${fileChar}${rankNum}`;
}

export function moveToSAN(state: GameState, move: Move): string {
  const { board, turn } = state;
  const { width, height } = board;

  // 1. Castling
  if (move.castling === 'kingside') return 'O-O';
  if (move.castling === 'queenside') return 'O-O-O';

  const pieceType = move.piece.type;
  const isCapture = move.captured !== undefined || move.isEnPassant;
  const targetAlg = squareToAlg(move.to, width, height);

  let sanPrefix = '';

  if (pieceType === 'pawn') {
    if (isCapture) {
      const fromCoords = toCoords(move.from, width);
      sanPrefix = String.fromCharCode(97 + fromCoords.x) + 'x';
    }
    sanPrefix += targetAlg;

    if (move.promotion) {
      sanPrefix += '=' + PIECE_LETTERS[move.promotion];
    }
  } else {
    sanPrefix = PIECE_LETTERS[pieceType];

    // Disambiguation
    const legalMoves = generateLegal(state);
    const ambiguousMoves = legalMoves.filter(
      (m) =>
        m.piece.type === pieceType &&
        m.piece.color === turn &&
        m.to === move.to &&
        m.from !== move.from,
    );

    if (ambiguousMoves.length > 0) {
      const fromCoords = toCoords(move.from, width);
      const sameFile = ambiguousMoves.some((m) => toCoords(m.from, width).x === fromCoords.x);
      const sameRank = ambiguousMoves.some((m) => toCoords(m.from, width).y === fromCoords.y);

      const fileChar = String.fromCharCode(97 + fromCoords.x);
      const rankNum = height - fromCoords.y;

      if (!sameFile) {
        sanPrefix += fileChar;
      } else if (!sameRank) {
        sanPrefix += rankNum;
      } else {
        sanPrefix += fileChar + rankNum;
      }
    }

    if (isCapture) {
      sanPrefix += 'x';
    }
    sanPrefix += targetAlg;
  }

  // Check / Checkmate suffix
  const nextState = applyMove(state, move);
  if (isCheckmate(nextState)) {
    sanPrefix += '#';
  } else if (isInCheck(nextState.board, nextState.turn)) {
    sanPrefix += '+';
  }

  return sanPrefix;
}
