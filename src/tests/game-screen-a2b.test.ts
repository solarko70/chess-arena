import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { initApp, getRouter } from '@/main';
import { globalStore } from '@/state/store';
import { BOT_LEVELS } from '@/ui/setupmodals';

describe('Stage A2b: New Game Screen & Review Overlay', () => {
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

  it('game screen has no FEN/PGN fields, setup dropdowns, or start review button', () => {
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const gameScreen = document.getElementById('screen-game') as HTMLElement;
    expect(gameScreen).not.toBeNull();

    // No FEN/PGN textarea or IO buttons on game screen
    expect(gameScreen.querySelector('.io-textarea')).toBeNull();
    expect(gameScreen.querySelector('#io-mount')).toBeNull();

    // No mode, level, color, or time dropdowns on game screen
    expect(gameScreen.querySelector('#game-mode-select')).toBeNull();
    expect(gameScreen.querySelector('#ai-level-select')).toBeNull();
    expect(gameScreen.querySelector('#player-color-select')).toBeNull();
    expect(gameScreen.querySelector('#clock-mode-select')).toBeNull();
    expect(gameScreen.querySelectorAll('select').length).toBe(0);

    // No start review button or deep toggle on game screen
    expect(gameScreen.querySelector('#btn-start-review')).toBeNull();
    expect(gameScreen.querySelector('#review-deep-toggle')).toBeNull();

    // Eval bar is hidden during live game
    const evalBar = gameScreen.querySelector('#eval-bar-wrapper') as HTMLElement;
    expect(evalBar.style.display).toBe('none');
  });

  it('board column has top bar, board, bottom bar in DOM order and flip swaps bars', () => {
    globalStore.newGame(undefined, { mode: 'ai', level: 'master', playerColor: 'white' });
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const boardCol = document.getElementById('game-board-col') as HTMLElement;
    const children = Array.from(boardCol.children);
    expect(children.length).toBe(3);
    expect(children[0].id).toBe('player-bar-top');
    expect(children[1].id).toBe('board-mount');
    expect(children[2].id).toBe('player-bar-bottom');

    const topBar = document.getElementById('player-bar-top') as HTMLElement;
    const bottomBar = document.getElementById('player-bar-bottom') as HTMLElement;
    const topName = document.getElementById('player-name-top') as HTMLElement;
    const bottomName = document.getElementById('player-name-bottom') as HTMLElement;

    // Default orientation: White at bottom (Вы), Black at top (Компьютер: Мастер)
    expect(topBar.dataset.side).toBe('black');
    expect(bottomBar.dataset.side).toBe('white');
    expect(topName.textContent).toBe('Компьютер: Мастер');
    expect(bottomName.textContent).toBe('Вы');

    // Flip board -> bars swap sides and labels
    document.getElementById('btn-flip')?.click();
    expect(globalStore.isFlipped()).toBe(true);
    expect(topBar.dataset.side).toBe('white');
    expect(bottomBar.dataset.side).toBe('black');
    expect(topName.textContent).toBe('Вы');
    expect(bottomName.textContent).toBe('Компьютер: Мастер');
  });

  it('hides clocks in none mode and displays selected clock time in timed modes', () => {
    // 1. No-clock mode
    globalStore.setClockMode('none');
    globalStore.newGame(undefined, { mode: 'pvp' });
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const topClock = document.getElementById('player-clock-top') as HTMLElement;
    const bottomClock = document.getElementById('player-clock-bottom') as HTMLElement;

    expect(topClock.style.display).toBe('none');
    expect(bottomClock.style.display).toBe('none');

    // 2. Timed mode (Blitz 3+2 -> 03:00)
    globalStore.setClockMode('blitz-3-2');
    globalStore.newGame(undefined, { mode: 'pvp' });

    expect(topClock.style.display).toBe('inline-flex');
    expect(bottomClock.style.display).toBe('inline-flex');
    expect(topClock.textContent).toBe('03:00');
    expect(bottomClock.textContent).toBe('03:00');
  });

  it('right panel has move list, nav buttons, undo, resign; move click and F key work', () => {
    globalStore.newGame(undefined, { mode: 'pvp' });
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const sidePanel = document.getElementById('game-side-panel') as HTMLElement;
    expect(sidePanel.querySelector('.history-list')).not.toBeNull();
    expect(sidePanel.querySelector('#hist-first')).not.toBeNull();
    expect(sidePanel.querySelector('#hist-prev')).not.toBeNull();
    expect(sidePanel.querySelector('#hist-next')).not.toBeNull();
    expect(sidePanel.querySelector('#hist-last')).not.toBeNull();
    expect(sidePanel.querySelector('#btn-undo')).not.toBeNull();
    expect(sidePanel.querySelector('#btn-resign')).not.toBeNull();

    // Play 2 moves: 1. e4 e5
    const e2 = globalStore.coordsToSquare(4, 6);
    const e4 = globalStore.coordsToSquare(4, 4);
    const e7 = globalStore.coordsToSquare(4, 1);
    const e5 = globalStore.coordsToSquare(4, 3);
    globalStore.makeMove(e2, e4);
    globalStore.makeMove(e7, e5);

    const moves = sidePanel.querySelectorAll('.history-move');
    expect(moves.length).toBe(2);

    // Click on first move (index 0) -> jumps to viewIndex 0
    (moves[0] as HTMLElement).click();
    expect(globalStore.getViewIndex()).toBe(0);
    const updatedMoves = sidePanel.querySelectorAll('.history-move');
    expect(updatedMoves[0].classList.contains('active')).toBe(true);

    // Press F key -> flips board
    expect(globalStore.isFlipped()).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF' }));
    expect(globalStore.isFlipped()).toBe(true);
  });

  it('summary modal play again goes home and review opens and closes review overlay', () => {
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
    globalStore.newGame(undefined, { mode: 'pvp' });
    window.location.hash = '#/game';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Fool's mate: 1. f3 e5 2. g4 Qh4#
    globalStore.makeMove(globalStore.coordsToSquare(5, 6), globalStore.coordsToSquare(5, 5));
    globalStore.makeMove(globalStore.coordsToSquare(4, 1), globalStore.coordsToSquare(4, 3));
    globalStore.makeMove(globalStore.coordsToSquare(6, 6), globalStore.coordsToSquare(6, 4));
    globalStore.makeMove(globalStore.coordsToSquare(3, 0), globalStore.coordsToSquare(7, 4));

    const gameOverOverlay = document.getElementById('game-over-overlay') as HTMLElement;
    expect(gameOverOverlay.style.display).toBe('flex');

    const playAgainBtn = document.getElementById('btn-modal-new-game') as HTMLButtonElement;
    expect(playAgainBtn.textContent).toBe('Играть снова');

    // Click "Разбор партии" -> opens #review-overlay with ReviewPanelUI
    const reviewBtn = document.getElementById('btn-modal-review') as HTMLButtonElement;
    reviewBtn.click();

    const reviewOverlay = document.getElementById('review-overlay') as HTMLElement;
    expect(reviewOverlay.style.display).toBe('flex');
    expect(gameOverOverlay.style.display).toBe('none');
    expect(reviewOverlay.querySelector('.review-panel')).not.toBeNull();

    // Close review overlay via ✕ -> returns to summary modal
    const closeOverlayBtn = document.getElementById('btn-close-review-overlay') as HTMLButtonElement;
    closeOverlayBtn.click();

    expect(reviewOverlay.style.display).toBe('none');
    expect(gameOverOverlay.style.display).toBe('flex');

    // Click "Играть снова" -> navigates to #/
    playAgainBtn.click();
    expect(window.location.hash).toBe('#/');
    globalStore.setReviewEngine(undefined);
  });

  it('bot setup modal level descriptions do not contain Elo', () => {
    for (const lvl of BOT_LEVELS) {
      expect(lvl.desc).not.toContain('Elo');
    }

    const playBotBtn = document.getElementById('btn-play-bot') as HTMLButtonElement;
    playBotBtn.click();

    const overlay = document.getElementById('setup-modal-overlay') as HTMLElement;
    expect(overlay.textContent).not.toContain('Elo');
  });

  it('styles.css includes @media (max-width: 800px) rule for mobile game layout', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('@media (max-width: 800px)');
  });
});

