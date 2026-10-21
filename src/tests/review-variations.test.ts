import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChessStore } from '@/state/store';
import { ChessBoardUI } from '@/ui/board';
import { HistoryUI } from '@/ui/history';
import { ReviewPanelUI } from '@/ui/reviewpanel';
import type { GameReviewResult } from '@/analysis';
import type { Move } from '@/core';

if (typeof globalThis.PointerEvent === 'undefined') {
  class MockPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? 'mouse';
    }
  }
  globalThis.PointerEvent = MockPointerEvent as unknown as typeof globalThis.PointerEvent;
}

function createMockReview(): GameReviewResult {
  return {
    engineName: 'MockEngine',
    reanalyzed: 0,
    keyMoments: [],
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
        move: { from: 52, to: 36 } as unknown as Move, // e2-e4
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
        move: { from: 12, to: 28 } as unknown as Move, // e7-e5
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
        san: 'Nf3',
        color: 'white',
        move: { from: 62, to: 45 } as unknown as Move, // g1-f3
        evalBefore: { type: 'cp', value: 35 },
        evalAfter: { type: 'cp', value: 40 },
        bestMove: { from: 62, to: 45 } as unknown as Move,
        bestSan: 'Nf3',
        winBefore: 53.5,
        winAfter: 54,
        loss: 0,
        accuracy: 98,
        class: 'best',
        onlyMove: false,
      },
      {
        ply: 4,
        san: 'Ke7??',
        color: 'black',
        move: { from: 4, to: 12 } as unknown as Move, // e8-e7 (blunder)
        evalBefore: { type: 'cp', value: 40 },
        evalAfter: { type: 'cp', value: 350 },
        bestMove: { from: 1, to: 18 } as unknown as Move, // b8-c6
        bestSan: 'Nc6',
        winBefore: 46,
        winAfter: 15,
        loss: 31,
        accuracy: 15,
        class: 'blunder',
        onlyMove: false,
      },
    ],
    evalHistory: [
      { ply: 0, score: { type: 'cp', value: 20 }, cp: 20, whiteWinChance: 52 },
      { ply: 1, score: { type: 'cp', value: 30 }, cp: 30, whiteWinChance: 53 },
      { ply: 2, score: { type: 'cp', value: 35 }, cp: 35, whiteWinChance: 53.5 },
      { ply: 3, score: { type: 'cp', value: 40 }, cp: 40, whiteWinChance: 54 },
      { ply: 4, score: { type: 'cp', value: 350 }, cp: 350, whiteWinChance: 85 },
    ],
  };
}

describe('Stage 6a: Review Variations & Best Move button', () => {
  let store: ChessStore;
  let boardContainer: HTMLElement;
  let historyContainer: HTMLElement;
  let reviewNavContainer: HTMLElement;
  let boardUI: ChessBoardUI;
  let historyUI: HistoryUI;
  let reviewUI: ReviewPanelUI;

  beforeEach(() => {
    document.body.innerHTML = '';

    boardContainer = document.createElement('div');
    boardContainer.id = 'board-container';
    document.body.appendChild(boardContainer);

    historyContainer = document.createElement('div');
    historyContainer.id = 'history-container';
    document.body.appendChild(historyContainer);

    reviewNavContainer = document.createElement('div');
    reviewNavContainer.id = 'review-board-nav';
    reviewNavContainer.className = 'review-board-nav';
    document.body.appendChild(reviewNavContainer);

    const reviewMount = document.createElement('div');
    reviewMount.id = 'review-mount';
    document.body.appendChild(reviewMount);

    store = new ChessStore();
    // Play: 1. e4 (52->36), 1... e5 (12->28), 2. Nf3 (62->45), 2... Ke7 (4->12)
    store.makeMove(52, 36);
    store.makeMove(12, 28);
    store.makeMove(62, 45);
    store.makeMove(4, 12);

    store.setReviewResult(createMockReview());
    store.setReviewMode(true);

    boardUI = new ChessBoardUI(boardContainer, store);
    historyUI = new HistoryUI(historyContainer, store);
    reviewUI = new ReviewPanelUI(reviewMount, store, { navContainer: reviewNavContainer });
    expect(boardUI).toBeDefined();
    expect(historyUI).toBeDefined();
    expect(reviewUI).toBeDefined();
  });

  afterEach(() => {
    store.setReviewMode(false);
    document.body.innerHTML = '';
  });

  it('Разбор партии: клик и ход на доске создают ответвление (variation) с классом и бейджем', () => {
    // Navigate to position after 1. e4 (viewIndex = 0)
    store.setViewIndex(0);

    // Play alternative move 1... c5 (c7 to c5: from 10 to 26 in standard 8x8 coords: c7=10, c5=26)
    // In 8x8: c7 = 1 * 8 + 2 = 10, c5 = 3 * 8 + 2 = 26
    const success = store.makeMove(10, 26);
    expect(success).toBe(true);

    const activeVar = store.getActiveVariationNode();
    expect(activeVar).toBeTruthy();
    expect(activeVar?.san).toBe('c5');
    expect(activeVar?.rootPly).toBe(0);

    // Check that history table rendered .history-variation with .variation-move
    const varEl = historyContainer.querySelector('.history-variation');
    expect(varEl).toBeTruthy();
    const varMove = varEl?.querySelector('.variation-move');
    expect(varMove).toBeTruthy();
    expect(varMove?.textContent).toContain('c5');
    expect(varMove?.classList.contains('active')).toBe(true);

    // Check that board badge is rendered on toSquare (26)
    const badgeSlot = boardContainer.querySelector('.board-move-badge');
    expect(badgeSlot).toBeTruthy();
    expect(badgeSlot?.getAttribute('data-square')).toBe('26');
  });

  it('Разбор партии: повторение хода основной партии просто продвигает позицию вперед без ответвления', () => {
    // Navigate to position after 1. e4 (viewIndex = 0)
    store.setViewIndex(0);
    expect(store.getViewIndex()).toBe(0);

    // Play main line move 1... e5 (e7 to e5: from 12 to 28)
    const success = store.makeMove(12, 28);
    expect(success).toBe(true);

    // Should simply step forward to viewIndex 1 without creating any variations
    expect(store.getViewIndex()).toBe(1);
    expect(store.getActiveVariationNode()).toBeNull();
    expect(store.getVariations().length).toBe(0);
    expect(historyContainer.querySelector('.history-variation')).toBeNull();
  });

  it('Кнопка "Лучший ход" в разборе разыгрывает рекомендованный движком ход как ветку с бейджем best', () => {
    // Navigate to move 4 (2... Ke7?? blunder, viewIndex = 3)
    store.setViewIndex(3);

    const bestMoveBtn = reviewNavContainer.querySelector('#review-best-move-btn') as HTMLButtonElement;
    expect(bestMoveBtn).toBeTruthy();

    bestMoveBtn.click();

    // Best move for Black was 2... Nc6 (from 1 to 18)
    const activeVar = store.getActiveVariationNode();
    expect(activeVar).toBeTruthy();
    expect(activeVar?.class).toBe('best');
    expect(activeVar?.san).toBe('Nc6');
    expect(activeVar?.rootPly).toBe(2); // branched before move 4 (at ply 2, after 2. Nf3)

    // History UI renders the variation with badge-best
    const varEl = historyContainer.querySelector('.history-variation');
    expect(varEl).toBeTruthy();
    const badgeBest = varEl?.querySelector('.badge-best');
    expect(badgeBest).toBeTruthy();
  });

  it('Кнопка "Лучший ход", если ход уже идеален, показывает всплывающее уведомление "Этот ход уже лучший"', () => {
    // Navigate to move 1 (1. e4, viewIndex = 0, class: 'best')
    store.setViewIndex(0);

    const bestMoveBtn = reviewNavContainer.querySelector('#review-best-move-btn') as HTMLButtonElement;
    expect(bestMoveBtn).toBeTruthy();

    bestMoveBtn.click();

    // Since 1. e4 was already 'best', no variation should be created
    expect(store.getActiveVariationNode()).toBeNull();

    // Toast notification should appear with the message
    const toast = reviewNavContainer.querySelector('#review-best-move-toast') as HTMLElement;
    expect(toast).toBeTruthy();
    expect(toast.style.display).not.toBe('none');
    expect(toast.textContent).toContain('Этот ход уже лучший');
  });

  it('Кнопка "Вернуться в партию" и клавиша ArrowLeft выводят из ответвления в основную партию', () => {
    store.setViewIndex(0);
    // Play variation 1... c5
    store.makeMove(10, 26);
    expect(store.getActiveVariationNode()).toBeTruthy();

    // Click "Вернуться в партию"
    const returnBtn = historyContainer.querySelector('.btn-return-mainline') as HTMLButtonElement;
    expect(returnBtn).toBeTruthy();
    returnBtn.click();

    expect(store.getActiveVariationNode()).toBeNull();
    expect(store.getViewIndex()).toBe(0);
    // Verify .history-variation is completely removed from DOM
    expect(historyContainer.querySelector('.history-variation')).toBeNull();

    // Re-play variation 1... c5
    store.makeMove(10, 26);
    expect(store.getActiveVariationNode()).toBeTruthy();
    expect(historyContainer.querySelector('.history-variation')).toBeTruthy();

    // Press ArrowLeft at root of variation -> exits to main line
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(store.getActiveVariationNode()).toBeNull();
    expect(store.getViewIndex()).toBe(0);
    expect(historyContainer.querySelector('.history-variation')).toBeNull();
  });

  it('Стрелки навигации и клавиатура корректно перемещают фокус по последовательности ходов в ответвлении', () => {
    store.setViewIndex(0);
    // Play 1... c5 (Black, ply 1, id: var1)
    store.makeMove(10, 26);
    const var1 = store.getActiveVariationNode();
    expect(var1).toBeTruthy();

    // In 8x8: White plays 2. Nf3 (62 to 45)
    store.makeMove(62, 45);
    const var2 = store.getActiveVariationNode();
    expect(var2).toBeTruthy();
    expect(var2?.id).not.toBe(var1?.id);
    expect(var2?.san).toBe('Nf3');

    // Click Prev button -> navigates back to 1... c5
    const prevBtn = reviewNavContainer.querySelector('#review-nav-prev') as HTMLButtonElement;
    expect(prevBtn).toBeTruthy();
    prevBtn.click();
    expect(store.getActiveVariationNode()?.id).toBe(var1?.id);

    // Click Next button -> navigates forward to 2. Nf3
    const nextBtn = reviewNavContainer.querySelector('#review-nav-next') as HTMLButtonElement;
    expect(nextBtn).toBeTruthy();
    nextBtn.click();
    expect(store.getActiveVariationNode()?.id).toBe(var2?.id);
  });

  it('Выполнение хода кликом (click-to-move) на доске в разборе партии создает ответвление', () => {
    store.setViewIndex(0); // after 1. e4, black's turn
    expect(store.getViewIndex()).toBe(0);

    const sq10 = boardContainer.querySelector('[data-square="10"]') as HTMLElement;
    expect(sq10).toBeTruthy();
    // First click: select c7 (square 10)
    sq10.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
    expect(store.getSelectedSquare()).toBe(10);

    const sq26 = boardContainer.querySelector('[data-square="26"]') as HTMLElement;
    expect(sq26).toBeTruthy();
    // Second click: destination c5 (square 26)
    sq26.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 200 }));

    // Move is made, creating variation
    const activeVar = store.getActiveVariationNode();
    expect(activeVar).toBeTruthy();
    expect(activeVar?.san).toBe('c5');
    expect(activeVar?.move.from).toBe(10);
    expect(activeVar?.move.to).toBe(26);
  });

  it('Drag & Drop на доске в разборе партии успешно совершает ход и создает ветку вариации', () => {
    store.setViewIndex(0);

    const sq10 = boardContainer.querySelector('[data-square="10"]') as HTMLElement;
    const sq26 = boardContainer.querySelector('[data-square="26"]') as HTMLElement;
    expect(sq10).toBeTruthy();
    expect(sq26).toBeTruthy();

    // Start drag on square 10
    sq10.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
    expect(store.getSelectedSquare()).toBe(10);

    // Mock elementFromPoint to return square 26
    const origElementFromPoint = document.elementFromPoint;
    try {
      document.elementFromPoint = () => sq26;
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 100, clientY: 200 }));
    } finally {
      document.elementFromPoint = origElementFromPoint;
    }

    const activeVar = store.getActiveVariationNode();
    expect(activeVar).toBeTruthy();
    expect(activeVar?.san).toBe('c5');
    expect(activeVar?.move.from).toBe(10);
    expect(activeVar?.move.to).toBe(26);
  });

  it('Разбор партии с окончанием по таймауту/сдаче не блокирует выбор фигур и ходы вариаций', () => {
    // Simulate game over by timeout and resignation
    (store as unknown as { timedOutLoser: string | null }).timedOutLoser = 'white';
    (store as unknown as { resignedPlayer: string | null }).resignedPlayer = 'black';

    store.setViewIndex(0);

    // Selecting square must not be blocked
    store.selectSquare(10);
    expect(store.getSelectedSquare()).toBe(10);

    // Valid destinations must not be empty
    const dests = store.getValidDestinationsFor(10);
    expect(dests).toContain(26);

    // Move must succeed in review mode
    const success = store.makeMove(10, 26);
    expect(success).toBe(true);
    expect(store.getActiveVariationNode()?.san).toBe('c5');
  });

  it('Кнопка "Лучший ход" применяет анимацию скольжения .piece-sliding к фигуре на доске', () => {
    // Navigate to move 4 (2... Ke7 blunder, viewIndex = 3)
    store.setViewIndex(3);

    const bestMoveBtn = reviewNavContainer.querySelector('#review-best-move-btn') as HTMLButtonElement;
    expect(bestMoveBtn).toBeTruthy();

    bestMoveBtn.click();

    // Best move was 2... Nc6 (from 1 to 18)
    const activeVar = store.getActiveVariationNode();
    expect(activeVar).toBeTruthy();
    expect(activeVar?.san).toBe('Nc6');
    expect(activeVar?.move.to).toBe(18);

    // Piece wrapper on square 18 must receive .piece-sliding class
    const targetSq = boardContainer.querySelector('[data-square="18"]') as HTMLElement;
    expect(targetSq).toBeTruthy();
    const pieceWrapper = targetSq.querySelector('.piece-wrapper');
    expect(pieceWrapper).toBeTruthy();
    expect(pieceWrapper?.classList.contains('piece-sliding')).toBe(true);

    // Quality badge must be mounted
    const badge = boardContainer.querySelector('.board-move-badge.badge-best');
    expect(badge).toBeTruthy();
    expect(badge?.getAttribute('data-square')).toBe('18');
  });

  it('Переключение viewIndex на другой ход основной партии очищает блок вариаций из DOM', () => {
    store.setViewIndex(0);
    // Play variation 1... c5
    store.makeMove(10, 26);
    expect(store.getActiveVariationNode()).toBeTruthy();
    expect(historyContainer.querySelector('.history-variation')).toBeTruthy();

    // Switch viewIndex to next main line move (1... e5, index 1)
    store.setViewIndex(1);

    expect(store.getActiveVariationNode()).toBeNull();
    expect(store.getVariations().length).toBe(0);
    expect(historyContainer.querySelector('.history-variation')).toBeNull();
  });

  it('Кнопка "Лучший ход" внутри вариации рассчитывает и разыгрывает лучший ответный ход', async () => {
    store.setViewIndex(0); // after 1. e4
    // Black plays variation 1... c5 (from 10 to 26)
    store.makeMove(10, 26);
    const var1 = store.getActiveVariationNode();
    expect(var1).toBeTruthy();
    expect(var1?.san).toBe('c5');

    // Mock engine to recommend 2. Nf3 (from 62 to 45) for White in this Sicilian position
    const engine = store.getOrCreateReviewEngine();
    const origAnalyze = engine.analyze.bind(engine);
    engine.analyze = (async () => ({
      engineName: 'MockStockfish',
      score: { type: 'cp', value: 40 },
      bestMove: { from: 62, to: 45 } as Move,
      pv: [{ from: 62, to: 45 } as Move],
      depth: 14,
      nodes: 1000,
      timeMs: 10,
      lines: [],
    })) as unknown as typeof engine.analyze;

    const bestMoveBtn = reviewNavContainer.querySelector('#review-best-move-btn') as HTMLButtonElement;
    expect(bestMoveBtn).toBeTruthy();

    try {
      await reviewUI.handleBestMoveClick();

      // Should create child variation node 2. Nf3
      const var2 = store.getActiveVariationNode();
      expect(var2).toBeTruthy();
      expect(var2?.parentId).toBe(var1?.id);
      expect(var2?.san).toBe('Nf3');
      expect(var2?.class).toBe('best');

      // Check piece on square 45 has sliding class and badge is mounted
      const targetSq = boardContainer.querySelector('[data-square="45"]') as HTMLElement;
      expect(targetSq).toBeTruthy();
      const pieceWrapper = targetSq.querySelector('.piece-wrapper');
      expect(pieceWrapper?.classList.contains('piece-sliding')).toBe(true);

      const badge = boardContainer.querySelector('.board-move-badge.badge-best');
      expect(badge).toBeTruthy();
      expect(badge?.getAttribute('data-square')).toBe('45');
    } finally {
      engine.analyze = origAnalyze;
    }
  });
});
