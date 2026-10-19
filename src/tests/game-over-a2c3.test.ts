import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChessStore } from '@/state/store';
import { GameOverModalUI } from '@/ui/gameovermodal';
import type { ReviewRunResult } from '@/analysis';
import { parseFEN, type Move } from '@/core';

function playFoolsMate(store: ChessStore): void {
  const f2 = store.coordsToSquare(5, 6);
  const f3 = store.coordsToSquare(5, 5);
  const e7 = store.coordsToSquare(4, 1);
  const e5 = store.coordsToSquare(4, 3);
  const g2 = store.coordsToSquare(6, 6);
  const g4 = store.coordsToSquare(6, 4);
  const d8 = store.coordsToSquare(3, 0);
  const h4 = store.coordsToSquare(7, 4);

  store.makeMove(f2, f3);
  store.makeMove(e7, e5);
  store.makeMove(g2, g4);
  store.makeMove(d8, h4);
}

function createStubReview(): ReviewRunResult {
  return {
    engineName: 'StockfishStub',
    reanalyzed: 0,
    accuracy: {
      white: 82.4,
      black: 95.1,
    },
    counts: {
      white: { best: 1, excellent: 0, good: 0, inaccuracy: 1, mistake: 0, blunder: 1 },
      black: { best: 2, excellent: 1, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
    },
    moves: [
      {
        ply: 1,
        san: 'f3',
        color: 'white',
        move: { from: 53, to: 45 } as unknown as Move,
        evalBefore: { type: 'cp', value: 20 },
        evalAfter: { type: 'cp', value: -50 },
        bestMove: { from: 52, to: 36 } as unknown as Move,
        bestSan: 'e4',
        winBefore: 52,
        winAfter: 45,
        loss: 7,
        accuracy: 78,
        class: 'inaccuracy',
        onlyMove: false,
      },
    ],
    keyMoments: [],
    evalHistory: [],
  };
}

describe('Stage A2c-3: GameOverModal Flicker Fix & Solar Design', () => {
  let container: HTMLElement;
  let store: ChessStore;
  let modal: GameOverModalUI;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    store = new ChessStore();
  });

  afterEach(() => {
    modal?.destroy();
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('DOM nodes of player cards remain identical across 10 progress updates', () => {
    vi.useFakeTimers();
    modal = new GameOverModalUI(container, store);
    playFoolsMate(store);
    expect(modal.isOpen()).toBe(true);

    const whiteCard = container.querySelector('.game-over-card[data-side="white"]');
    const blackCard = container.querySelector('.game-over-card[data-side="black"]');
    expect(whiteCard).not.toBeNull();
    expect(blackCard).not.toBeNull();

    // Mark review as active in store
    store.setReviewInProgress(true);

    for (let i = 1; i <= 10; i++) {
      vi.advanceTimersByTime(120);
      store.setReviewProgress({ completed: i, total: 10, ply: i });
      vi.advanceTimersByTime(20);

      const currentWhite = container.querySelector('.game-over-card[data-side="white"]');
      const currentBlack = container.querySelector('.game-over-card[data-side="black"]');

      // The exact same DOM instances must be preserved across all progress notifications
      expect(currentWhite).toBe(whiteCard);
      expect(currentBlack).toBe(blackCard);

      const progressLabel = container.querySelector('.analysis-progress-label');
      expect(progressLabel?.textContent).toBe(`Анализ партии: ${i} из 10`);
    }

    vi.useRealTimers();
  });

  it('entrance animation class is added once upon open and removed on animationend', () => {
    modal = new GameOverModalUI(container, store);
    playFoolsMate(store);

    const dialog = container.querySelector('.game-over-dialog');
    const whiteCard = container.querySelector('.game-over-card[data-side="white"]');
    expect(dialog?.classList.contains('modal-anim-enter')).toBe(true);
    expect(whiteCard?.classList.contains('card-anim-enter')).toBe(true);

    // Dispatch animationend event
    dialog?.dispatchEvent(new Event('animationend'));
    whiteCard?.dispatchEvent(new Event('animationend'));

    expect(dialog?.classList.contains('modal-anim-enter')).toBe(false);
    expect(whiteCard?.classList.contains('card-anim-enter')).toBe(false);

    // Updating store should NOT re-add animation classes
    store.setReviewProgress({ completed: 1, total: 4, ply: 1 });
    expect(dialog?.classList.contains('modal-anim-enter')).toBe(false);
    expect(whiteCard?.classList.contains('card-anim-enter')).toBe(false);
  });

  it('cards are not recreated when review result completes and displays values', () => {
    modal = new GameOverModalUI(container, store);
    playFoolsMate(store);

    const whiteCard = container.querySelector('.game-over-card[data-side="white"]');
    const blackCard = container.querySelector('.game-over-card[data-side="black"]');

    // Simulate completion with stub results
    const stubResult = createStubReview();
    store.setReviewResult(stubResult);

    const afterWhite = container.querySelector('.game-over-card[data-side="white"]');
    const afterBlack = container.querySelector('.game-over-card[data-side="black"]');

    expect(afterWhite).toBe(whiteCard);
    expect(afterBlack).toBe(blackCard);

    // Accuracies and fade-in are applied
    const whiteAcc = whiteCard?.querySelector('.card-accuracy-val');
    const blackAcc = blackCard?.querySelector('.card-accuracy-val');
    expect(whiteAcc?.textContent).toBe('82.4%');
    expect(blackAcc?.textContent).toBe('95.1%');
    expect(whiteAcc?.classList.contains('fade-in')).toBe(true);
  });

  it('SVG ring stroke-dashoffset accurately reflects player accuracy percentage', () => {
    modal = new GameOverModalUI(container, store);
    playFoolsMate(store);

    const stubResult = createStubReview();
    store.setReviewResult(stubResult);

    const whiteCard = container.querySelector('.game-over-card[data-side="white"]');
    const blackCard = container.querySelector('.game-over-card[data-side="black"]');

    const whiteRing = whiteCard?.querySelector('.ring-progress') as SVGCircleElement | null;
    const blackRing = blackCard?.querySelector('.ring-progress') as SVGCircleElement | null;

    expect(whiteRing).not.toBeNull();
    expect(blackRing).not.toBeNull();

    // Circumference = 175.93. White acc = 82.4% -> offset = 175.93 * (1 - 0.824) = 30.96
    const expectedWhiteOffset = (175.93 * (1 - 0.824)).toFixed(2);
    expect(whiteRing?.style.strokeDashoffset).toBe(expectedWhiteOffset);
    expect(whiteRing?.classList.contains('ring-mid')).toBe(true); // 70 <= 82.4 < 85

    // Black acc = 95.1% -> offset = 175.93 * (1 - 0.951) = 8.62
    const expectedBlackOffset = (175.93 * (1 - 0.951)).toFixed(2);
    expect(blackRing?.style.strokeDashoffset).toBe(expectedBlackOffset);
    expect(blackRing?.classList.contains('ring-high')).toBe(true); // 95.1 >= 85
  });

  it('verdict banner renders correct text and SVG icon for win, loss, and draw', () => {
    modal = new GameOverModalUI(container, store);

    // 1. Loss for player when White loses in AI mode
    playFoolsMate(store);
    store.configureGame({ mode: 'ai', playerColor: 'white' });
    modal.renderContent();

    const verdictEl = container.querySelector('#game-over-verdict');
    expect(verdictEl?.textContent).toBe('Вы проиграли');
    expect(verdictEl?.classList.contains('verdict-loss')).toBe(true);
    expect(verdictEl?.querySelector('.verdict-icon')).not.toBeNull();

    // 2. Win for player when player was Black
    store.configureGame({ mode: 'ai', playerColor: 'black' });
    modal.renderContent();

    expect(verdictEl?.textContent).toBe('Вы выиграли');
    expect(verdictEl?.classList.contains('verdict-win')).toBe(true);
    expect(verdictEl?.querySelector('.verdict-icon')).not.toBeNull();

    // 3. Draw via stalemate
    store.newGame(parseFEN('7k/5K2/8/8/8/8/8/6Q1 w - - 0 1'), { mode: 'ai', playerColor: 'white' });
    const g1 = store.coordsToSquare(6, 7);
    const g6 = store.coordsToSquare(6, 2);
    store.makeMove(g1, g6);

    expect(verdictEl?.textContent).toBe('Ничья');
    expect(verdictEl?.classList.contains('verdict-draw')).toBe(true);
    expect(verdictEl?.querySelector('.verdict-icon')).not.toBeNull();
  });

  it('decorative solar layers have aria-hidden and pointer-events none', () => {
    modal = new GameOverModalUI(container, store);
    playFoolsMate(store);

    const decorEl = container.querySelector('.game-over-solar-decor') as HTMLElement | null;
    expect(decorEl).not.toBeNull();
    expect(decorEl?.getAttribute('aria-hidden')).toBe('true');
    expect(decorEl?.style.pointerEvents).toBe('none');

    const svgEl = decorEl?.querySelector('svg');
    expect(svgEl?.getAttribute('aria-hidden')).toBe('true');
  });

  it('game over modal contains no emojis across all elements', () => {
    modal = new GameOverModalUI(container, store);
    playFoolsMate(store);
    store.setReviewResult(createStubReview());

    const html = container.innerHTML;
    // Regex matching actual emoji codepoint ranges (faces, pictographs, symbols)
    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/u;
    expect(emojiRegex.test(html)).toBe(false);
  });

  it('game over dialog styles contain no backdrop-filter or blur filters', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Extract section for .game-over-dialog
    const dialogSectionMatch = cssContent.match(/\.game-over-dialog\s*\{[^}]*\}/);
    expect(dialogSectionMatch).not.toBeNull();

    const dialogCss = dialogSectionMatch ? dialogSectionMatch[0] : '';
    expect(dialogCss).not.toContain('backdrop-filter');
    expect(dialogCss).not.toContain('filter: blur');
  });

  it('reduced motion media query disables game over animations and transitions', () => {
    const cssPath = path.resolve(__dirname, '../ui/styles.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Find prefers-reduced-motion block
    const reducedMotionMatch = cssContent.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/);
    expect(reducedMotionMatch).not.toBeNull();

    const block = reducedMotionMatch ? reducedMotionMatch[1] : '';
    expect(block).toContain('.game-over-dialog');
    expect(block).toContain('.game-over-card');
    expect(block).toContain('.ring-progress');
  });

  it('reopening modal via show rebuilds structure once and triggers entry animation', () => {
    modal = new GameOverModalUI(container, store);
    playFoolsMate(store);

    const firstWhiteCard = container.querySelector('.game-over-card[data-side="white"]');
    expect(firstWhiteCard).not.toBeNull();

    // Close modal
    modal.hide();
    expect(modal.isOpen()).toBe(false);

    // Reopen modal via show()
    modal.show();
    expect(modal.isOpen()).toBe(true);

    const dialog = container.querySelector('.game-over-dialog');
    expect(dialog?.classList.contains('modal-anim-enter')).toBe(true);

    const secondWhiteCard = container.querySelector('.game-over-card[data-side="white"]');
    // On explicit re-open via show(), structure is freshly rebuilt once
    expect(secondWhiteCard).not.toBeNull();
  });
});
