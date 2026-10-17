import type {
  GameState,
  Move,
  Square,
  GameResult,
  RuleSet,
  PieceType,
} from '@/core';
import { classicalRuleSet } from '@/core';

export type StoreListener = (state: GameState, store: ChessStore) => void;

export class ChessStore {
  private ruleSet: RuleSet;
  private state: GameState;
  private flipped: boolean = false;
  private selectedSquare: Square | null = null;
  private listeners: Set<StoreListener> = new Set();
  private pendingPromotion: { from: Square; to: Square } | null = null;

  constructor(ruleSet: RuleSet = classicalRuleSet) {
    this.ruleSet = ruleSet;
    this.state = this.ruleSet.getInitialState();
  }

  getState(): GameState {
    return this.state;
  }

  isFlipped(): boolean {
    return this.flipped;
  }

  getSelectedSquare(): Square | null {
    return this.selectedSquare;
  }

  getPendingPromotion(): { from: Square; to: Square } | null {
    return this.pendingPromotion;
  }

  getLegalMoves(): Move[] {
    if (this.ruleSet.generateLegalMoves) {
      return this.ruleSet.generateLegalMoves(this.state);
    }
    return this.ruleSet.generateMoves(this.state);
  }

  getGameResult(): GameResult {
    return this.ruleSet.getGameResult(this.state);
  }

  isInCheck(): boolean {
    return this.ruleSet.isInCheck(this.state, this.state.turn);
  }

  getKingSquare(color = this.state.turn): Square | null {
    const { pieces } = this.state.board;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      if (p && p.type === 'king' && p.color === color) {
        return i;
      }
    }
    return null;
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    listener(this.state, this);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state, this);
    }
  }

  newGame(initialState?: GameState): void {
    this.state = initialState ?? this.ruleSet.getInitialState();
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.notify();
  }

  toggleFlip(): void {
    this.flipped = !this.flipped;
    this.notify();
  }

  selectSquare(sq: Square | null): void {
    this.selectedSquare = sq;
    this.notify();
  }

  setPendingPromotion(promo: { from: Square; to: Square } | null): void {
    this.pendingPromotion = promo;
    this.notify();
  }

  /**
   * Attempts to move from one square to another.
   * If move requires promotion and promoPiece is omitted, sets pendingPromotion and returns false.
   */
  makeMove(from: Square, to: Square, promoPiece?: PieceType): boolean {
    const legalMoves = this.getLegalMoves();
    const candidateMoves = legalMoves.filter((m) => m.from === from && m.to === to);

    if (candidateMoves.length === 0) {
      this.selectedSquare = null;
      this.notify();
      return false;
    }

    const needsPromotion = candidateMoves.some((m) => m.promotion !== undefined);

    if (needsPromotion && !promoPiece) {
      this.pendingPromotion = { from, to };
      this.notify();
      return true;
    }

    const chosenMove = needsPromotion
      ? candidateMoves.find((m) => m.promotion === promoPiece)
      : candidateMoves[0];

    if (!chosenMove) {
      this.selectedSquare = null;
      this.pendingPromotion = null;
      this.notify();
      return false;
    }

    this.state = this.ruleSet.applyMove(this.state, chosenMove);
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.notify();
    return true;
  }

  undo(): boolean {
    if (this.state.history.length === 0) return false;
    this.state = this.ruleSet.undoMove(this.state);
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.notify();
    return true;
  }

  /**
   * Helper to check if a square is a valid destination for the currently selected square.
   */
  getValidDestinationsFor(sq: Square): Square[] {
    const moves = this.getLegalMoves();
    return moves.filter((m) => m.from === sq).map((m) => m.to);
  }

  getLastMove(): Move | null {
    if (this.state.history.length === 0) return null;
    return this.state.history[this.state.history.length - 1];
  }

  coordsToSquare(x: number, y: number): Square {
    return toCoordsSquare(x, y, this.state.board.width);
  }
}

function toCoordsSquare(x: number, y: number, width: number): Square {
  return y * width + x;
}

export const globalStore = new ChessStore();
