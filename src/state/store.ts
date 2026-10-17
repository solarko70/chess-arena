import type {
  GameState,
  Move,
  Square,
  GameResult,
  RuleSet,
  PieceType,
  Color,
} from '@/core';
import { classicalRuleSet, parseFEN, parsePGN, serializeFEN, exportPGN } from '@/core';

export type TimeControlMode = 'none' | 'bullet-1-0' | 'blitz-3-2' | 'blitz-5-0' | 'rapid-10-0' | 'rapid-15-10';

export interface TimeControlConfig {
  initialMs: number;
  incrementMs: number;
}

export const TIME_CONTROLS: Record<TimeControlMode, TimeControlConfig> = {
  'none': { initialMs: 0, incrementMs: 0 },
  'bullet-1-0': { initialMs: 60 * 1000, incrementMs: 0 },
  'blitz-3-2': { initialMs: 3 * 60 * 1000, incrementMs: 2 * 1000 },
  'blitz-5-0': { initialMs: 5 * 60 * 1000, incrementMs: 0 },
  'rapid-10-0': { initialMs: 10 * 60 * 1000, incrementMs: 0 },
  'rapid-15-10': { initialMs: 15 * 60 * 1000, incrementMs: 10 * 1000 },
};

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

  // Clock state inside store
  private clockMode: TimeControlMode = 'none';
  private whiteMs: number = 0;
  private blackMs: number = 0;
  private incrementMs: number = 0;
  private clockSnapshots: { whiteMs: number; blackMs: number }[] = [{ whiteMs: 0, blackMs: 0 }];
  private clockActive: boolean = false;
  private clockStarted: boolean = false;
  private lastTickTime: number = 0;
  private onTimeOutCallback?: (loser: Color) => void;

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

  // ── Clock methods ──────────────────────────────────────────────────────────

  setClockMode(mode: TimeControlMode, onTimeout?: (loser: Color) => void): void {
    this.clockMode = mode;
    this.onTimeOutCallback = onTimeout;
    const cfg = TIME_CONTROLS[mode];
    this.whiteMs = cfg.initialMs;
    this.blackMs = cfg.initialMs;
    this.incrementMs = cfg.incrementMs;
    this.clockSnapshots = [{ whiteMs: this.whiteMs, blackMs: this.blackMs }];
    this.clockActive = false;
    this.clockStarted = false;
    this.syncClock();
    this.notify();
  }

  getClockMode(): TimeControlMode {
    return this.clockMode;
  }

  getTime(color: Color): number {
    this.tickClock();
    return color === 'white' ? this.whiteMs : this.blackMs;
  }

  isClockActive(): boolean {
    this.tickClock();
    return this.clockActive;
  }

  public tickClock(): void {
    if (!this.clockActive || this.clockMode === 'none') return;
    const now = Date.now();
    const elapsed = now - this.lastTickTime;
    if (elapsed <= 0) return;
    this.lastTickTime = now;

    if (this.state.turn === 'white') {
      this.whiteMs = Math.max(0, this.whiteMs - elapsed);
      if (this.whiteMs === 0) {
        this.clockActive = false;
        this.onTimeOutCallback?.('white');
      }
    } else {
      this.blackMs = Math.max(0, this.blackMs - elapsed);
      if (this.blackMs === 0) {
        this.clockActive = false;
        this.onTimeOutCallback?.('black');
      }
    }
  }

  public syncClock(): void {
    this.tickClock();
    if (this.clockMode === 'none') {
      this.clockActive = false;
      return;
    }

    const result = this.getGameResult();
    const historyLen = this.state.history.length;

    if (result.type !== 'ongoing' || historyLen === 0) {
      this.clockActive = false;
    } else {
      this.clockActive = true;
      this.lastTickTime = Date.now();
    }
  }

  // ── Store methods ──────────────────────────────────────────────────────────

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

    const cfg = TIME_CONTROLS[this.clockMode];
    this.whiteMs = cfg.initialMs;
    this.blackMs = cfg.initialMs;
    this.clockSnapshots = [{ whiteMs: this.whiteMs, blackMs: this.blackMs }];
    this.clockStarted = false;
    this.syncClock();

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

    if (this.getGameResult().type !== 'ongoing') {
      return false;
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

    if (this.clockMode !== 'none') {
      this.tickClock();
    }

    const movingColor = this.state.turn;
    this.state = this.ruleSet.applyMove(this.state, chosenMove);

    if (this.clockMode !== 'none') {
      if (!this.clockStarted) {
        this.clockStarted = true;
      }
      if (movingColor === 'white') {
        this.whiteMs += this.incrementMs;
      } else {
        this.blackMs += this.incrementMs;
      }

      this.clockSnapshots.push({ whiteMs: this.whiteMs, blackMs: this.blackMs });
      this.syncClock();
    }

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

    if (this.clockMode !== 'none') {
      if (this.clockSnapshots.length > 1) {
        this.clockSnapshots.pop();
      }
      const prevSnap = this.clockSnapshots[this.clockSnapshots.length - 1];
      if (prevSnap) {
        this.whiteMs = prevSnap.whiteMs;
        this.blackMs = prevSnap.blackMs;
      }
      this.syncClock();
    }

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

      const cfg = TIME_CONTROLS[this.clockMode];
      this.clockSnapshots = [{ whiteMs: cfg.initialMs, blackMs: cfg.initialMs }];
      for (let i = 0; i < parsed.state.history.length; i++) {
        this.clockSnapshots.push({ whiteMs: cfg.initialMs, blackMs: cfg.initialMs });
      }

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
