import type { Color, GameResult, GameState, Move, Piece } from '../types';
import type { RuleSet } from './ruleset';
import { parseFEN } from '../notation/fen';
import { generateLegal, isInCheck, isCheckmate, isStalemate } from '../moves/legal';
import { applyMove, undoMove } from '../moves/apply';
import { toCoords } from '../board';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Checks for threefold repetition.
 * Returns true if the current position key has appeared at least 3 times in history.
 */
export function isThreefoldRepetition(state: GameState): boolean {
  if (state.positionHistory.length < 3) return false;
  const currentKey = state.positionHistory[state.positionHistory.length - 1];
  let count = 0;
  for (const key of state.positionHistory) {
    if (key === currentKey) {
      count++;
      if (count >= 3) return true;
    }
  }
  return false;
}

/**
 * Checks the fifty-move rule: 100 half-moves without pawn moves or captures.
 */
export function isFiftyMoveRule(state: GameState): boolean {
  return state.halfMoveClock >= 100;
}

/**
 * Checks insufficient material:
 * - K vs K
 * - K+B vs K or K+N vs K
 * - K+B vs K+B where bishops are on the same square color
 */
export function isInsufficientMaterial(state: GameState): boolean {
  const { board } = state;
  const { width, pieces } = board;

  const nonKings: { piece: Piece; square: number }[] = [];
  let whiteKingSq: number | null = null;
  let blackKingSq: number | null = null;

  for (let sq = 0; sq < pieces.length; sq++) {
    const p = pieces[sq];
    if (p === null) continue;
    if (p.type === 'king') {
      if (p.color === 'white') whiteKingSq = sq;
      else blackKingSq = sq;
    } else {
      nonKings.push({ piece: p, square: sq });
    }
  }

  // Must have both kings
  if (whiteKingSq === null || blackKingSq === null) return false;

  // If there are queens, rooks, or pawns, material is sufficient
  for (const item of nonKings) {
    if (item.piece.type === 'queen' || item.piece.type === 'rook' || item.piece.type === 'pawn') {
      return false;
    }
  }

  // K vs K
  if (nonKings.length === 0) return true;

  // K+B vs K or K+N vs K
  if (nonKings.length === 1) {
    const only = nonKings[0].piece;
    return only.type === 'bishop' || only.type === 'knight';
  }

  // Two minor pieces
  if (nonKings.length === 2) {
    const [first, second] = nonKings;

    // K+B vs K+B
    if (
      first.piece.type === 'bishop' &&
      second.piece.type === 'bishop' &&
      first.piece.color !== second.piece.color
    ) {
      const c1 = toCoords(first.square, width);
      const c2 = toCoords(second.square, width);
      const color1 = (c1.x + c1.y) % 2;
      const color2 = (c2.x + c2.y) % 2;
      // Insufficient if bishops are on the same square color
      return color1 === color2;
    }

    // K+N vs K+N is technically not an automatic dead position according to standard FIDE
    // (checkmate is possible, though not forced), so standard rule treats K+B vs K+B same color.
    return false;
  }

  return false;
}

export class ClassicalRuleSet implements RuleSet {
  getInitialState(): GameState {
    return parseFEN(START_FEN);
  }

  generateLegalMoves(state: GameState): Move[] {
    return generateLegal(state);
  }

  generateMoves(state: GameState): Move[] {
    return generateLegal(state);
  }

  applyMove(state: GameState, move: Move): GameState {
    return applyMove(state, move);
  }

  undoMove(state: GameState): GameState {
    return undoMove(state);
  }

  isInCheck(state: GameState, color: Color): boolean {
    return isInCheck(state.board, color);
  }

  getGameResult(state: GameState): GameResult {
    // 1. Checkmate
    if (isCheckmate(state)) {
      const winner: Color = state.turn === 'white' ? 'black' : 'white';
      return { type: 'checkmate', winner };
    }

    // 2. Stalemate
    if (isStalemate(state)) {
      return { type: 'stalemate' };
    }

    // 3. Threefold repetition
    if (isThreefoldRepetition(state)) {
      return { type: 'threefoldRepetition' };
    }

    // 4. Fifty-move rule
    if (isFiftyMoveRule(state)) {
      return { type: 'fiftyMoveRule' };
    }

    // 5. Insufficient material
    if (isInsufficientMaterial(state)) {
      return { type: 'insufficientMaterial' };
    }

    return { type: 'ongoing' };
  }
}

export const classicalRuleSet = new ClassicalRuleSet();
