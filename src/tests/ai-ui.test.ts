import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChessStore, STORAGE_KEYS, globalStore } from '@/state/store';
import { findBestMove, type WorkerRequest, type WorkerResponse } from '@/ai';
import { initApp } from '@/main';

/**
 * Synchronous Worker stub that invokes findBestMove(state, level) immediately.
 */
class SyncAIWorkerStub {
  public static totalSearchCalls = 0;
  public onmessage: ((ev: MessageEvent<WorkerResponse>) => void) | null = null;
  public onerror: ((ev: ErrorEvent) => void) | null = null;

  postMessage(msg: WorkerRequest): void {
    if (msg.type === 'search') {
      SyncAIWorkerStub.totalSearchCalls++;
      const move = findBestMove(msg.state, msg.level);
      this.onmessage?.({
        data: {
          type: 'result',
          id: msg.id,
          move,
          elapsedMs: 1,
        },
      } as MessageEvent<WorkerResponse>);
    }
  }

  terminate(): void {
    // no-op
  }
}

/**
 * Deferred Worker stub that holds the search request until manually resolved.
 */
class DeferredAIWorkerStub {
  public onmessage: ((ev: MessageEvent<WorkerResponse>) => void) | null = null;
  public onerror: ((ev: ErrorEvent) => void) | null = null;
  public pendingRequest: Extract<WorkerRequest, { type: 'search' }> | null = null;
  public cancelReceived = false;

  postMessage(msg: WorkerRequest): void {
    if (msg.type === 'search') {
      this.pendingRequest = msg;
    } else if (msg.type === 'cancel') {
      this.cancelReceived = true;
    }
  }

  flushSync(): void {
    if (!this.pendingRequest) return;
    const req = this.pendingRequest;
    this.pendingRequest = null;
    const move = findBestMove(req.state, req.level);
    this.onmessage?.({
      data: {
        type: 'result',
        id: req.id,
        move,
        elapsedMs: 5,
      },
    } as MessageEvent<WorkerResponse>);
  }

  terminate(): void {
    // no-op
  }
}

describe('Stage 4b: Play vs AI in Store and UI', () => {
  let store: ChessStore;

  beforeEach(() => {
    localStorage.clear();
    SyncAIWorkerStub.totalSearchCalls = 0;
    vi.stubGlobal('Worker', SyncAIWorkerStub);
    store = new ChessStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('after player move, AI makes a move automatically and turn returns to player', () => {
    store.newGame(undefined, { mode: 'ai', level: 'novice', playerColor: 'white' });
    expect(store.getState().turn).toBe('white');
    expect(store.isFlipped()).toBe(false);

    // Player plays 1. e4
    const e2 = store.coordsToSquare(4, 6);
    const e4 = store.coordsToSquare(4, 4);
    const moved = store.makeMove(e2, e4);

    expect(moved).toBe(true);
    // Sync worker stub replied immediately, so AI already moved as black
    expect(store.getState().history.length).toBe(2);
    expect(store.getState().turn).toBe('white');
    expect(store.isAIThinking()).toBe(false);
    expect(store.isPlayerTurn()).toBe(true);
  });

  it('blocks player input while AI is thinking', () => {
    const deferred = new DeferredAIWorkerStub();
    store.setWorkerFactory(() => deferred);
    store.newGame(undefined, { mode: 'ai', level: 'novice', playerColor: 'white' });

    // Player plays 1. e4 -> AI starts thinking (deferred stub holds response)
    const e2 = store.coordsToSquare(4, 6);
    const e4 = store.coordsToSquare(4, 4);
    expect(store.makeMove(e2, e4)).toBe(true);
    expect(store.isAIThinking()).toBe(true);
    expect(store.isPlayerTurn()).toBe(false);

    // Attempt to select a square or make another move while AI is thinking
    const d7 = store.coordsToSquare(3, 1);
    const d5 = store.coordsToSquare(3, 3);
    store.selectSquare(d7);
    expect(store.getSelectedSquare()).toBeNull();
    expect(store.getValidDestinationsFor(d7)).toEqual([]);
    expect(store.makeMove(d7, d5)).toBe(false);
    expect(store.getState().history.length).toBe(1);

    // Now let AI finish thinking
    deferred.flushSync();
    expect(store.isAIThinking()).toBe(false);
    expect(store.getState().history.length).toBe(2);
    expect(store.getState().turn).toBe('white');
  });

  it('undo in AI mode rolls back two half-moves (AI move and player move)', () => {
    store.newGame(undefined, { mode: 'ai', level: 'novice', playerColor: 'white' });

    const e2 = store.coordsToSquare(4, 6);
    const e4 = store.coordsToSquare(4, 4);
    store.makeMove(e2, e4);

    // Both player and AI have moved
    expect(store.getState().history.length).toBe(2);
    expect(store.getState().turn).toBe('white');

    const undone = store.undo();
    expect(undone).toBe(true);
    expect(store.getState().history.length).toBe(0);
    expect(store.getState().turn).toBe('white');
    expect(store.isAIThinking()).toBe(false);
  });

  it('undo during active AI search cancels search and ignores late worker response', () => {
    const deferred = new DeferredAIWorkerStub();
    store.setWorkerFactory(() => deferred);
    store.newGame(undefined, { mode: 'ai', level: 'novice', playerColor: 'white' });

    const e2 = store.coordsToSquare(4, 6);
    const e4 = store.coordsToSquare(4, 4);
    store.makeMove(e2, e4);

    expect(store.isAIThinking()).toBe(true);
    expect(store.getState().history.length).toBe(1);

    // Player presses Undo while AI is still searching
    const undone = store.undo();
    expect(undone).toBe(true);
    expect(store.isAIThinking()).toBe(false);
    expect(deferred.cancelReceived).toBe(true);
    expect(store.getState().history.length).toBe(0);
    expect(store.getState().turn).toBe('white');

    // Late response arrives from the worker for the already undone position
    deferred.flushSync();
    expect(store.getState().history.length).toBe(0);
    expect(store.getState().turn).toBe('white');
  });

  it('loading FEN where it is AI turn immediately triggers AI move', () => {
    store.newGame(undefined, { mode: 'ai', level: 'novice', playerColor: 'white' });

    // Load FEN where it is Black's (AI's) turn after 1. e4
    const fenBlackToMove = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const loaded = store.loadFEN(fenBlackToMove);

    expect(loaded).toBe(true);
    // AI should have immediately made its move as Black, returning turn to White
    expect(store.getState().history.length).toBe(1);
    expect(store.getState().turn).toBe('white');
  });

  it('checkmate and stalemate stop the game and do not trigger AI search', () => {
    store.newGame(undefined, { mode: 'ai', level: 'novice', playerColor: 'white' });
    const callsBefore = SyncAIWorkerStub.totalSearchCalls;

    // 1. Position one move before Scholar's Mate (White to play Qxf7#)
    const preMateFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    store.loadFEN(preMateFen);
    // White to move -> AI should not search yet
    const callsAfterLoad = SyncAIWorkerStub.totalSearchCalls;
    expect(callsAfterLoad).toBe(callsBefore);

    // White delivers checkmate: Qxf7# (h5 = x:7, y:3 -> f7 = x:5, y:1)
    const h5 = store.coordsToSquare(7, 3);
    const f7 = store.coordsToSquare(5, 1);
    expect(store.makeMove(h5, f7)).toBe(true);
    expect(store.getGameResult().type).toBe('checkmate');
    expect(store.isAIThinking()).toBe(false);
    expect(SyncAIWorkerStub.totalSearchCalls).toBe(callsAfterLoad);

    // 2. Load a stalemate position where it would be Black's (AI's) turn
    const stalemateFen = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
    store.loadFEN(stalemateFen);
    expect(store.getGameResult().type).toBe('stalemate');
    expect(store.isAIThinking()).toBe(false);
    expect(SyncAIWorkerStub.totalSearchCalls).toBe(callsAfterLoad);
  });

  it('persists AI mode settings in localStorage, flips board for black, and handles worker error gracefully', () => {
    document.body.innerHTML = '<div id="app"></div>';
    store.configureGame({ mode: 'ai', level: 'expert', playerColor: 'black' });
    expect(localStorage.getItem(STORAGE_KEYS.mode)).toBe('ai');
    expect(localStorage.getItem(STORAGE_KEYS.level)).toBe('expert');
    expect(localStorage.getItem(STORAGE_KEYS.playerColor)).toBe('black');

    const restored = new ChessStore();
    restored.loadSettingsFromStorage();
    expect(restored.getGameMode()).toBe('ai');
    expect(restored.getAILevel()).toBe('expert');
    expect(restored.getPlayerColorChoice()).toBe('black');

    // When player chooses black, board is flipped and AI (white) moves first
    restored.newGame();
    expect(restored.isFlipped()).toBe(true);
    expect(restored.getState().history.length).toBe(1);
    expect(restored.getState().turn).toBe('black');

    // Worker error is displayed in UI status bar without crashing
    initApp();
    globalStore.setWorkerFactory(() => ({
      onmessage: null,
      onerror: null,
      postMessage() {
        throw new Error('Тестовый сбой воркера');
      },
    }));
    globalStore.newGame(undefined, { mode: 'ai', level: 'novice', playerColor: 'black' });
    const statusText = document.getElementById('status-text');
    expect(statusText?.textContent).toContain('Ошибка ИИ:');
    globalStore.setWorkerFactory(undefined);
    globalStore.newGame(undefined, { mode: 'pvp' });
  });
});
