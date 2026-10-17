import type { Board, Coords, Piece, Square } from './types';

export function toSquare(x: number, y: number, width: number): Square {
  return y * width + x;
}

export function toCoords(sq: Square, width: number): Coords {
  return { x: sq % width, y: Math.floor(sq / width) };
}

export function inBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

export function getPiece(board: Board, sq: Square): Piece | null {
  return board.pieces[sq] ?? null;
}

export function setPiece(board: Board, sq: Square, piece: Piece | null): void {
  board.pieces[sq] = piece;
}

export function cloneBoard(board: Board): Board {
  return {
    width: board.width,
    height: board.height,
    pieces: board.pieces.slice(),
  };
}

export function emptyBoard(width: number, height: number): Board {
  return {
    width,
    height,
    pieces: new Array<Piece | null>(width * height).fill(null),
  };
}
