import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initApp, getRouter } from '@/main';
import { globalStore } from '@/state/store';
import { parseFEN } from '@/core';

describe('Stage A2c-1: Undo restriction and Show Summary button', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '#/';
    document.body.innerHTML = '<div id="app"></div>';
    if (globalStore.isFlipped()) {
      globalStore.toggleFlip();
    }
    globalStore.setClockMode('rapid-10-0');
    globalStore.newGame(undefined, { mode: 'pvp' });
    initApp();
  });

  afterEach(() => {
    getRouter()?.destroy();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('canUndo is false and undo button is disabled after checkmate', () => {
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Fool's mate: 1. f3 e5 2. g4 Qh4#
    globalStore.makeMove(globalStore.coordsToSquare(5, 6), globalStore.coordsToSquare(5, 5));
    globalStore.makeMove(globalStore.coordsToSquare(4, 1), globalStore.coordsToSquare(4, 3));
    globalStore.makeMove(globalStore.coordsToSquare(6, 6), globalStore.coordsToSquare(6, 4));
    globalStore.makeMove(globalStore.coordsToSquare(3, 0), globalStore.coordsToSquare(7, 4));

    expect(globalStore.getGameResult().type).toBe('checkmate');
    expect(globalStore.isGameOver()).toBe(true);
    expect(globalStore.canUndo()).toBe(false);

    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
    expect(undoBtn.title).toBe('Партия окончена');

    expect(globalStore.undo()).toBe(false);
    expect(globalStore.getGameResult().type).toBe('checkmate');
  });

  it('canUndo is false and undo button is disabled after stalemate', () => {
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Stalemate position: White Qg1 to Qg6 -> stalemate
    const preStalemateFen = '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1';
    globalStore.newGame(parseFEN(preStalemateFen));

    const g1 = globalStore.coordsToSquare(6, 7);
    const g6 = globalStore.coordsToSquare(6, 2);
    globalStore.makeMove(g1, g6);

    expect(globalStore.getGameResult().type).toBe('stalemate');
    expect(globalStore.isGameOver()).toBe(true);
    expect(globalStore.canUndo()).toBe(false);

    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
    expect(undoBtn.title).toBe('Партия окончена');

    expect(globalStore.undo()).toBe(false);
    expect(globalStore.getGameResult().type).toBe('stalemate');
  });

  it('canUndo is false and undo button is disabled after resignation', () => {
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const e2 = globalStore.coordsToSquare(4, 6);
    const e4 = globalStore.coordsToSquare(4, 4);
    globalStore.makeMove(e2, e4);

    globalStore.resign('white');
    expect(globalStore.isGameOver()).toBe(true);
    expect(globalStore.canUndo()).toBe(false);

    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
    expect(undoBtn.title).toBe('Партия окончена');

    expect(globalStore.undo()).toBe(false);
    expect(globalStore.getResignedPlayer()).toBe('white');
  });

  it('canUndo is false and undo button is disabled after time timeout', () => {
    globalStore.setClockMode('bullet-1-0');
    globalStore.newGame(undefined, { mode: 'pvp' });
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const e2 = globalStore.coordsToSquare(4, 6);
    const e4 = globalStore.coordsToSquare(4, 4);
    globalStore.makeMove(e2, e4);

    // Fast-forward past Black's clock (60s)
    const nowSpy = vi.spyOn(Date, 'now');
    const startTime = Date.now();
    nowSpy.mockReturnValue(startTime + 65_000);

    globalStore.tickClock();
    expect(globalStore.getTimedOutLoser()).toBe('black');
    expect(globalStore.isGameOver()).toBe(true);
    expect(globalStore.canUndo()).toBe(false);

    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
    expect(undoBtn.title).toBe('Партия окончена');

    expect(globalStore.undo()).toBe(false);
    expect(globalStore.getTimedOutLoser()).toBe('black');
  });

  it('undo remains forbidden after opening and closing review overlay', () => {
    globalStore.setReviewEngine({
      name: 'StubEngine',
      analyze: async () => ({
        engineName: 'StubEngine',
        bestMove: null,
        score: { type: 'cp', value: 0 },
        depth: 1,
        nodes: 1,
        timeMs: 1,
        pv: [],
        lines: [],
      }),
      dispose: () => {},
    });

    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Fool's mate
    globalStore.makeMove(globalStore.coordsToSquare(5, 6), globalStore.coordsToSquare(5, 5));
    globalStore.makeMove(globalStore.coordsToSquare(4, 1), globalStore.coordsToSquare(4, 3));
    globalStore.makeMove(globalStore.coordsToSquare(6, 6), globalStore.coordsToSquare(6, 4));
    globalStore.makeMove(globalStore.coordsToSquare(3, 0), globalStore.coordsToSquare(7, 4));

    expect(globalStore.isGameOver()).toBe(true);

    // Open review overlay
    const modalReviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    modalReviewBtn.click();
    expect(globalStore.isReviewMode()).toBe(true);
    expect(globalStore.canUndo()).toBe(false);

    // Close review overlay
    const closeOverlayBtn = document.getElementById('btn-close-review-overlay') as HTMLButtonElement;
    closeOverlayBtn.click();
    expect(globalStore.isReviewMode()).toBe(false);
    expect(globalStore.isGameOver()).toBe(true);
    expect(globalStore.canUndo()).toBe(false);

    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
    expect(undoBtn.title).toBe('Партия окончена');

    expect(globalStore.undo()).toBe(false);
    globalStore.setReviewEngine(undefined);
  });

  it('undo works during ongoing game in pvp mode', () => {
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
    expect(globalStore.canUndo()).toBe(false);

    // Move 1: e4
    globalStore.makeMove(globalStore.coordsToSquare(4, 6), globalStore.coordsToSquare(4, 4));
    expect(globalStore.canUndo()).toBe(true);
    expect(undoBtn.disabled).toBe(false);
    expect(undoBtn.title).toBe('');

    // Move 2: e5
    globalStore.makeMove(globalStore.coordsToSquare(4, 1), globalStore.coordsToSquare(4, 3));
    expect(globalStore.getLiveState().history.length).toBe(2);

    // Click undo
    undoBtn.click();
    expect(globalStore.getLiveState().history.length).toBe(1);
    expect(globalStore.getLiveState().turn).toBe('black');
  });

  it('undo rolls back two half-moves against bot during ongoing game', () => {
    // Synchronous mock worker for AI
    globalStore.setWorkerFactory(() => ({
      postMessage: (msg) => {
        if (msg.type === 'search') {
          const move = {
            from: globalStore.coordsToSquare(4, 1),
            to: globalStore.coordsToSquare(4, 3),
          };
          (globalStore as unknown as { handleWorkerResponse: (res: unknown) => void }).handleWorkerResponse({
            id: msg.id,
            type: 'result',
            move,
            elapsedMs: 10,
          });
        }
      },
      terminate: () => {},
      onmessage: null,
      onerror: null,
    }));

    globalStore.newGame(undefined, { mode: 'ai', level: 'club', playerColor: 'white' });
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Player moves e4 -> bot synchronously responds e5
    globalStore.makeMove(globalStore.coordsToSquare(4, 6), globalStore.coordsToSquare(4, 4));
    expect(globalStore.getLiveState().history.length).toBe(2);
    expect(globalStore.getLiveState().turn).toBe('white');
    expect(globalStore.canUndo()).toBe(true);

    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(false);

    // Undo rolls back both bot's move and player's move
    undoBtn.click();
    expect(globalStore.getLiveState().history.length).toBe(0);
    expect(globalStore.getLiveState().turn).toBe('white');
  });

  it('show summary button is hidden during ongoing game', () => {
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const showSummaryBtn = document.getElementById('btn-show-summary') as HTMLButtonElement;
    expect(showSummaryBtn.style.display).toBe('none');

    // Make 2 moves in ongoing game
    globalStore.makeMove(globalStore.coordsToSquare(4, 6), globalStore.coordsToSquare(4, 4));
    globalStore.makeMove(globalStore.coordsToSquare(4, 1), globalStore.coordsToSquare(4, 3));

    expect(globalStore.isGameOver()).toBe(false);
    expect(showSummaryBtn.style.display).toBe('none');
  });

  it('show summary button is visible during history view and opens modal', () => {
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Deliver Fool's mate
    globalStore.makeMove(globalStore.coordsToSquare(5, 6), globalStore.coordsToSquare(5, 5));
    globalStore.makeMove(globalStore.coordsToSquare(4, 1), globalStore.coordsToSquare(4, 3));
    globalStore.makeMove(globalStore.coordsToSquare(6, 6), globalStore.coordsToSquare(6, 4));
    globalStore.makeMove(globalStore.coordsToSquare(3, 0), globalStore.coordsToSquare(7, 4));

    expect(globalStore.isGameOver()).toBe(true);

    const gameOverOverlay = document.getElementById('game-over-overlay') as HTMLElement;
    expect(gameOverOverlay.style.display).toBe('flex');

    // Close modal via close button
    const closeBtn = document.getElementById('game-over-close-btn') as HTMLButtonElement;
    closeBtn.click();
    expect(gameOverOverlay.style.display).toBe('none');

    const showSummaryBtn = document.getElementById('btn-show-summary') as HTMLButtonElement;
    expect(showSummaryBtn.style.display).toBe('inline-flex');

    // Step back in history to first move (index 0)
    globalStore.setViewIndex(0);
    expect(globalStore.isViewingHistory()).toBe(true);
    expect(globalStore.isGameOver()).toBe(true);

    // Button MUST remain visible during history inspection of a finished game
    expect(showSummaryBtn.style.display).toBe('inline-flex');

    // Clicking button opens summary modal with accurate game-over details
    showSummaryBtn.click();
    expect(gameOverOverlay.style.display).toBe('flex');

    const titleEl = document.getElementById('game-over-title');
    expect(titleEl?.textContent).toBe('Мат. Победили чёрные');
  });
});

