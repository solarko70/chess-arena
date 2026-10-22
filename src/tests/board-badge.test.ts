import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChessStore } from '@/state/store';
import { ChessBoardUI } from '@/ui/board';
import { GameOverModalUI } from '@/ui/gameovermodal';
import { ReviewPanelUI } from '@/ui/reviewpanel';
import type { GameReviewResult } from '@/analysis';
import type { Move } from '@/core';

function createMockReview(): GameReviewResult {
  return {
    engineName: 'MockEngine',
    reanalyzed: 0,
    accuracy: { white: 85.5, black: 72.0 },
    counts: {
      white: { best: 1, excellent: 1, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
      black: { best: 0, excellent: 0, good: 1, inaccuracy: 0, mistake: 0, blunder: 1 },
    },
    moves: [
      {
        ply: 1,
        san: 'e4',
        color: 'white',
        move: { from: 52, to: 36 } as unknown as Move, // e2 to e4 (to: 36, x: 4, y: 4)
        evalBefore: { type: 'cp', value: 20 },
        evalAfter: { type: 'cp', value: 30 },
        bestMove: { from: 52, to: 36 } as unknown as Move,
        bestSan: 'e4',
        winBefore: 52,
        winAfter: 53,
        loss: 0,
        accuracy: 100,
        class: 'best',
        onlyMove: false,
      },
      {
        ply: 2,
        san: 'e5',
        color: 'black',
        move: { from: 12, to: 28 } as unknown as Move, // e7 to e5 (to: 28, x: 4, y: 3)
        evalBefore: { type: 'cp', value: 30 },
        evalAfter: { type: 'cp', value: 35 },
        bestMove: { from: 12, to: 28 } as unknown as Move,
        bestSan: 'e5',
        winBefore: 47,
        winAfter: 46.5,
        loss: 0.5,
        accuracy: 98,
        class: 'good',
        onlyMove: false,
      },
      {
        ply: 3,
        san: 'Qh5',
        color: 'white',
        move: { from: 59, to: 39 } as unknown as Move, // d1 to h5 (to: 39, x: 7, y: 4)
        evalBefore: { type: 'cp', value: 35 },
        evalAfter: { type: 'cp', value: 40 },
        bestMove: { from: 62, to: 45 } as unknown as Move,
        bestSan: 'Nf3',
        winBefore: 53.5,
        winAfter: 54,
        loss: 0,
        accuracy: 95,
        class: 'excellent',
        onlyMove: false,
      },
      {
        ply: 4,
        san: 'g6??',
        color: 'black',
        move: { from: 14, to: 22 } as unknown as Move, // g7 to g6 (to: 22, x: 6, y: 2)
        evalBefore: { type: 'cp', value: 40 },
        evalAfter: { type: 'cp', value: 350 },
        bestMove: { from: 1, to: 18 } as unknown as Move,
        bestSan: 'Nc6',
        winBefore: 46,
        winAfter: 15,
        loss: 31,
        accuracy: 15,
        class: 'blunder',
        onlyMove: false,
      },
    ],
    keyMoments: [],
    evalHistory: [],
  };
}

describe('Board Classification Badge & Performance Rating UI (Stage A3.1)', () => {
  let store: ChessStore;
  let boardContainer: HTMLElement;
  let boardUI: ChessBoardUI;

  beforeEach(() => {
    store = new ChessStore();
    boardContainer = document.createElement('div');
    document.body.appendChild(boardContainer);
    boardUI = new ChessBoardUI(boardContainer, store);
    expect(boardUI).toBeDefined();
  });

  afterEach(() => {
    boardContainer.remove();
    document.body.innerHTML = '';
  });

  it('board badge layer has pointer-events none and aria-hidden', () => {
    const layer = boardContainer.querySelector('.board-badge-layer') as HTMLElement;
    expect(layer).not.toBeNull();
    expect(layer.style.pointerEvents).toBe('none');
    expect(layer.getAttribute('aria-hidden')).toBe('true');
  });

  it('right-click planning preserves mounted badges and pieces throughout repeated gestures', () => {
    store.makeMove(52, 36);
    store.setReviewResult(createMockReview());
    store.setReviewMode(true);
    store.setViewIndex(0);
    const badge = boardContainer.querySelector('.move-badge');
    const square = boardContainer.querySelector('[data-square="36"].chess-square')!;
    const piece = square.querySelector('.piece-wrapper');
    expect(badge).not.toBeNull();
    expect(piece).not.toBeNull();
    const render = vi.spyOn(boardUI as unknown as { render(): void }, 'render');
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver(records => mutations.push(...records));
    observer.observe(boardContainer.querySelector('.board-badge-layer')!, { childList: true, subtree: true });
    const gesture = (to: Element, contextFirst: boolean) => {
      square.dispatchEvent(new MouseEvent('pointerdown', { button: 2, bubbles: true, cancelable: true }));
      expect(boardContainer.querySelector('.move-badge')).toBe(badge);
      const context = () => square.dispatchEvent(new MouseEvent('contextmenu', {
        button: 2, bubbles: true, cancelable: true,
      }));
      if (contextFirst) context();
      to.dispatchEvent(new MouseEvent('pointerup', { button: 2, bubbles: true, cancelable: true }));
      if (!contextFirst) context();
      expect(boardContainer.querySelector('.move-badge')).toBe(badge);
      expect(square.querySelector('.piece-wrapper')).toBe(piece);
    };
    try {
      gesture(square, true);
      expect(boardContainer.querySelector('.square-planning-highlight')).not.toBeNull();
      gesture(square, false);
      expect(boardContainer.querySelector('.square-planning-highlight')).toBeNull();
      const target = boardContainer.querySelector('[data-square="28"].chess-square')!;
      gesture(target, true);
      expect(boardContainer.querySelector('.board-planning-overlay line')).not.toBeNull();
      gesture(target, false);
      expect(boardContainer.querySelector('.board-planning-overlay line')).toBeNull();
      expect([...mutations, ...observer.takeRecords()]).toHaveLength(0);
      expect(render).not.toHaveBeenCalled();
    } finally {
      observer.disconnect();
      render.mockRestore();
    }
  });

  it('in start position viewIndex -1 the board badge is absent', () => {
    const mockReview = createMockReview();
    // Simulate active game with 4 moves
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3));
    store.makeMove(store.coordsToSquare(3, 7), store.coordsToSquare(7, 4));
    store.makeMove(store.coordsToSquare(6, 1), store.coordsToSquare(6, 2));

    store.setReviewResult(mockReview);
    store.setReviewMode(true);

    // Navigate to start position before move 1 (ply 0 / index -1)
    store.setViewIndex(-1);

    const badge = boardContainer.querySelector('.board-move-badge');
    expect(badge).toBeNull();
  });

  it('on move navigation badge appears on target square with class', () => {
    const mockReview = createMockReview();
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3));
    store.makeMove(store.coordsToSquare(3, 7), store.coordsToSquare(7, 4));
    store.makeMove(store.coordsToSquare(6, 1), store.coordsToSquare(6, 2));

    store.setReviewResult(mockReview);
    store.setReviewMode(true);

    // Navigate to ply 1 (move 0: e4, toSquare = 36, class = best)
    store.setViewIndex(0);
    let badge = boardContainer.querySelector('.board-move-badge') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.dataset.square).toBe('36');
    expect(badge.dataset.class).toBe('best');
    expect(badge.classList.contains('badge-best')).toBe(true);

    // Navigate to ply 4 (move 3: g6, toSquare = 22, class = blunder)
    store.setViewIndex(3);
    badge = boardContainer.querySelector('.board-move-badge') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.dataset.square).toBe('22');
    expect(badge.dataset.class).toBe('blunder');
    expect(badge.classList.contains('badge-blunder')).toBe(true);
  });

  it('when board is flipped badge slot coordinates are inverted', () => {
    const mockReview = createMockReview();
    store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
    store.setReviewResult(mockReview);
    store.setReviewMode(true);
    store.setViewIndex(0);

    // toSquare = 36 -> x = 4, y = 4 on 8x8 board
    // When unflipped: col = 4, row = 4 -> left = 50%, top = 50%
    const slotUnflipped = boardContainer.querySelector('.board-badge-slot') as HTMLElement;
    expect(slotUnflipped).not.toBeNull();
    expect(slotUnflipped.style.left).toBe('50%');
    expect(slotUnflipped.style.top).toBe('50%');

    // Flip board: col = 8 - 1 - 4 = 3, row = 8 - 1 - 4 = 3 -> left = 37.5%, top = 37.5%
    store.toggleFlip();
    const slotFlipped = boardContainer.querySelector('.board-badge-slot') as HTMLElement;
    expect(slotFlipped).not.toBeNull();
    expect(slotFlipped.style.left).toBe('37.5%');
    expect(slotFlipped.style.top).toBe('37.5%');
  });

  it('game over modal and review panel render performance rating', () => {
    const modalContainer = document.createElement('div');
    const panelContainer = document.createElement('div');
    document.body.appendChild(modalContainer);
    document.body.appendChild(panelContainer);

    const modal = new GameOverModalUI(modalContainer, store);
    const panel = new ReviewPanelUI(panelContainer, store);
    expect(panel).toBeDefined();

    // Create 12 moves game
    for (let i = 0; i < 6; i++) {
      store.makeMove(store.coordsToSquare(4, 6), store.coordsToSquare(4, 4));
      store.makeMove(store.coordsToSquare(4, 1), store.coordsToSquare(4, 3));
    }
    store.resign('black');

    const review = createMockReview();
    // Add 12 moves so totalMoves is 6 per side
    review.moves = [];
    for (let i = 0; i < 12; i++) {
      review.moves.push({
        ply: i + 1,
        san: 'e4',
        color: i % 2 === 0 ? 'white' : 'black',
        move: { from: 52, to: 36 } as unknown as Move,
        evalBefore: { type: 'cp', value: 20 },
        evalAfter: { type: 'cp', value: 20 },
        bestMove: null,
        bestSan: null,
        winBefore: 50,
        winAfter: 50,
        loss: 0,
        accuracy: 90,
        class: 'best',
        onlyMove: false,
      });
    }

    store.setReviewResult(review);
    store.setReviewMode(true);
    modal.show();

    // Check modal rating badge
    const modalWhiteRating = modalContainer.querySelector('.game-over-card[data-side="white"] .card-performance-rating');
    const modalBlackRating = modalContainer.querySelector('.game-over-card[data-side="black"] .card-performance-rating');
    expect(modalWhiteRating).not.toBeNull();
    expect(modalBlackRating).not.toBeNull();
    expect(modalWhiteRating?.textContent).toMatch(/Рейтинг:\s*~\d+/);
    expect(modalBlackRating?.textContent).toMatch(/Рейтинг:\s*~\d+/);

    // Check review panel rating badge
    const panelWhiteRating = panelContainer.querySelector('#review-rating-white');
    const panelBlackRating = panelContainer.querySelector('#review-rating-black');
    expect(panelWhiteRating).not.toBeNull();
    expect(panelBlackRating).not.toBeNull();
    expect(panelWhiteRating?.textContent).toMatch(/Рейтинг:\s*~\d+/);
    expect(panelBlackRating?.textContent).toMatch(/Рейтинг:\s*~\d+/);

    modal.destroy();
    modalContainer.remove();
    panelContainer.remove();
  });
});
