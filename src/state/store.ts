import type {
  GameState,
  Move,
  Square,
  GameResult,
  RuleSet,
  PieceType,
} from '@/core';
import { classicalRuleSet, parseFEN, parsePGN, serializeFEN, exportPGN } from '@/core';

export type StoreListener = (state: GameState, store: ChessStore) => void;

export class ChessStore {
  private ruleSet: RuleSet;
  private state: GameState;
  private flipped: boolean = false;
  private selectedSquare: Square | null = null;
  private listeners: Set<StoreListener> = new Set();
  private pendingPromotion: { from: Square; to: Square } | null = null;
  private viewIndex: number | null = null; // null means viewing latest live position
  private lastError: string | null = null;

  constructor(ruleSet: RuleSet = classicalRuleSet) {
    this.ruleSet = ruleSet;
    this.state = this.ruleSet.getInitialState();
  }

  getState(): GameState {
    if (this.viewIndex === null) {
      return this.state;
    }
    let tempState = this.ruleSet.getInitialState();
    for (let i = 0; i <= this.viewIndex && i < this.state.history.length; i++) {
      tempState = this.ruleSet.applyMove(tempState, this.state.history[i]);
    }
    return tempState;
  }

  getLiveState(): GameState {
    return this.state;
  }

  getViewIndex(): number | null {
    return this.viewIndex;
  }

  setViewIndex(index: number | null): void {
    if (index === null) {
      this.viewIndex = null;
    } else {
      const maxIndex = this.state.history.length - 1;
      if (index < -1) this.viewIndex = -1;
      else if (index > maxIndex) this.viewIndex = null;
      else this.viewIndex = index;
    }
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.notify();
  }

  isViewingHistory(): boolean {
    return this.viewIndex !== null && this.viewIndex < this.state.history.length - 1;
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

  getLastError(): string | null {
    return this.lastError;
  }

  clearError(): void {
    this.lastError = null;
  }

  getLegalMoves(): Move[] {
    const currentState = this.getState();
    if (this.ruleSet.generateLegalMoves) {
      return this.ruleSet.generateLegalMoves(currentState);
    }
    return this.ruleSet.generateMoves(currentState);
  }

  getGameResult(): GameResult {
    return this.ruleSet.getGameResult(this.getState());
  }

  isInCheck(): boolean {
    const currentState = this.getState();
    return this.ruleSet.isInCheck(currentState, currentState.turn);
  }

  getKingSquare(color = this.getState().turn): Square | null {
    const { pieces } = this.getState().board;
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
    listener(this.getState(), this);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const st = this.getState();
    for (const listener of this.listeners) {
      listener(st, this);
    }
  }

  newGame(initialState?: GameState): void {
    this.state = initialState ?? this.ruleSet.getInitialState();
    this.viewIndex = null;
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.lastError = null;
    this.notify();
  }

  toggleFlip(): void {
    this.flipped = !this.flipped;
    this.notify();
  }

  selectSquare(sq: Square | null): void {
    if (this.isViewingHistory()) return;
    this.selectedSquare = sq;
    this.notify();
  }

  setPendingPromotion(promo: { from: Square; to: Square } | null): void {
    this.pendingPromotion = promo;
    this.notify();
  }

  makeMove(from: Square, to: Square, promoPiece?: PieceType): boolean {
    if (this.viewIndex !== null) {
      this.viewIndex = null;
    }

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
    this.viewIndex = null;
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.lastError = null;
    this.notify();
    return true;
  }

  undo(): boolean {
    if (this.state.history.length === 0) return false;
    if (this.viewIndex !== null) {
      this.viewIndex = null;
    }
    this.state = this.ruleSet.undoMove(this.state);
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.notify();
    return true;
  }

  loadFEN(fen: string): boolean {
    try {
      const parsed = parseFEN(fen);
      let whiteKings = 0;
      let blackKings = 0;
      for (const p of parsed.board.pieces) {
        if (p?.type === 'king') {
          if (p.color === 'white') whiteKings++;
          else blackKings++;
        }
      }
      if (whiteKings !== 1 || blackKings !== 1) {
        throw new Error('FEN must contain exactly one white king and one black king.');
      }
      this.newGame(parsed);
      this.lastError = null;
      return true;
    } catch (e: unknown) {
      const err = e as Error;
      this.lastError = `Ошибка FEN: ${err?.message || 'неверный формат'}`;
      this.notify();
      return false;
    }
  }

  loadPGN(pgnText: string): boolean {
    try {
      const parsed = parsePGN(pgnText);
      this.newGame(parsed.state);
      this.lastError = null;
      return true;
    } catch (e: unknown) {
      const err = e as Error;
      this.lastError = `Ошибка PGN: ${err?.message || 'неверный формат'}`;
      this.notify();
      return false;
    }
  }

  getFEN(): string {
    return serializeFEN(this.getState());
  }

  getPGN(): string {
    return exportPGN(this.state);
  }

  getValidDestinationsFor(sq: Square): Square[] {
    if (this.isViewingHistory()) return [];
    const moves = this.getLegalMoves();
    return moves.filter((m) => m.from === sq).map((m) => m.to);
  }

  getLastMove(): Move | null {
    const st = this.getState();
    if (st.history.length === 0) return null;
    return st.history[st.history.length - 1];
  }

  coordsToSquare(x: number, y: number): Square {
    return toCoordsSquare(x, y, this.state.board.width);
  }
}

function toCoordsSquare(x: number, y: number, width: number): Square {
  return y * width + x;
}

export const globalStore = new ChessStore();
