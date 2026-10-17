// ── Primitives ───────────────────────────────────────────────────────────────
export type Color = 'white' | 'black';
export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type Square = number; // y * width + x

export interface Coords {
  x: number;
  y: number;
}

// ── Piece ────────────────────────────────────────────────────────────────────
export interface Piece {
  type: PieceType;
  color: Color;
}

// ── Board ────────────────────────────────────────────────────────────────────
export interface Board {
  width: number;
  height: number;
  pieces: (Piece | null)[]; // length === width * height
}

// ── CastlingRights ───────────────────────────────────────────────────────────
export interface CastlingRights {
  white: { kingside: boolean; queenside: boolean };
  black: { kingside: boolean; queenside: boolean };
}

// ── Move (full object — sufficient for undo without a separate stack) ─────────
export interface Move {
  from: Square;
  to: Square;
  piece: Piece;
  // undo data
  captured?: Piece;
  capturedAt?: Square; // en passant: differs from `to`
  prevCastling: CastlingRights;
  prevEpSquare: Square | null;
  prevHalfmove: number;
  prevPositionHistory: string[];
  // flags
  promotion?: PieceType;
  castling?: 'kingside' | 'queenside';
  isEnPassant?: boolean;
}

// ── GameState ─────────────────────────────────────────────────────────────────
export interface GameState {
  board: Board;
  turn: Color;
  castlingRights: CastlingRights;
  enPassantSquare: Square | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  history: Move[];
  positionHistory: string[]; // position key (no counters) for threefold repetition
}

// ── PieceDef (data-driven, no if-chains) ─────────────────────────────────────
export interface PieceDef {
  type: PieceType;
  slider: boolean; // true → slides along direction until blocked
  directions: [number, number][]; // [dx, dy] in board coords
}

// ── GameResult ────────────────────────────────────────────────────────────────
export type GameResultType =
  | 'checkmate'
  | 'stalemate'
  | 'threefoldRepetition'
  | 'fiftyMoveRule'
  | 'insufficientMaterial'
  | 'ongoing';

export interface GameResult {
  type: GameResultType;
  winner?: Color; // only set for checkmate
}

// ── RuleSet ───────────────────────────────────────────────────────────────────
export interface RuleSet {
  getInitialState(): GameState;
  generateMoves(state: GameState): Move[];
  applyMove(state: GameState, move: Move): GameState;
  undoMove(state: GameState): GameState;
  getGameResult(state: GameState): GameResult;
  isInCheck(state: GameState, color: Color): boolean;
}
