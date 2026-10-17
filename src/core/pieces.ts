import type { PieceDef, PieceType } from './types';

const DIAGONALS: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const STRAIGHTS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const ALL_DIRS: [number, number][] = [...STRAIGHTS, ...DIAGONALS];

const KNIGHT_MOVES: [number, number][] = [
  [1, 2],
  [1, -2],
  [-1, 2],
  [-1, -2],
  [2, 1],
  [2, -1],
  [-2, 1],
  [-2, -1],
];

export const PIECE_DEFS: Record<PieceType, PieceDef> = {
  king: { type: 'king', slider: false, directions: ALL_DIRS },
  queen: { type: 'queen', slider: true, directions: ALL_DIRS },
  rook: { type: 'rook', slider: true, directions: STRAIGHTS },
  bishop: { type: 'bishop', slider: true, directions: DIAGONALS },
  knight: { type: 'knight', slider: false, directions: KNIGHT_MOVES },
  // Pawn directions are handled by the specialised pawn generator
  pawn: { type: 'pawn', slider: false, directions: [] },
};
